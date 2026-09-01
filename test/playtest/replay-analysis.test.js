// @vitest-environment jsdom
//
// Local-only analysis tool (not part of the regular suite, not meant to be
// committed) -- decodes a pasted replay code and drives it through the real
// Game via replay.js's own playEvent(), logging a human-readable action
// log: what was bought each turn, what a tool (Pin/Eye/Axe) targeted (by
// emoji, resolved from the live board at the moment of the buy), and the
// board neighborhood around Cocktail whenever it changes. This is ground
// truth for reverse-engineering a strong human run, not a synthetic bot.
import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as Rng from '../../src/core/rng.js';
import * as Const from '../../src/consts.js';
import { Catalog } from '../../src/catalog.js';
import { Game } from '../../src/game.js';
import { GameSettings } from '../../src/game_settings.js';
import { SimRenderer } from '../../src/render/SimRenderer.js';
import { parseReplay, playEvent } from '../../src/replay.js';
import { dailyAllowedEmoji } from '../../src/daily.js';
import { animationOff } from '../../src/render/animations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);

const REPLAY_B64 = readFileSync(
  path.resolve(__dirname, 'replay.b64.txt'),
  'utf8'
).trim();

function loadDom() {
  const bodyMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);
  document.body.innerHTML = bodyMatch[1];
}
function cloneTemplateIntoGame() {
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const clone = template.cloneNode(true);
  clone.classList.remove('hidden');
  gameDiv.appendChild(clone.children[0]);
}

const COCKTAIL = '🍹';

function describeCocktailNeighborhood(game) {
  let coord = null;
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() === COCKTAIL) coord = addr.split(',').map(Number);
  }
  if (!coord) {
    // Not pinned -- find it loose on the board, if it's there this turn.
    game.board.forAllCells((cell, x, y) => {
      if (!coord && cell.emoji() === COCKTAIL) coord = [x, y];
    });
  }
  if (!coord) return null;
  const [x, y] = coord;
  const neighbors = game.board
    .nextToCoords(x, y)
    .map(([nx, ny]) => game.board.getSymbol(nx, ny).emoji())
    .join('');
  return `@${x},${y} pinned=${game.board.lockedAt(x, y)} neighbors=${neighbors}`;
}

describe('replay analysis (local only)', () => {
  it('drives the pasted replay and logs a human-readable action trace', async () => {
    const parsed = parseReplay(REPLAY_B64);

    loadDom();
    cloneTemplateIntoGame();

    const mode = parsed.mode ?? null;
    // Mirror validateReplay()'s reconstruction (src/replay.js), the one
    // path actually proven against daily replays (test/unit/daily-
    // validate.test.js): re-derive from the seed phrase rather than
    // importing parsed.rng, and force the cosmetic RNG draw to redo so a
    // catalog built later in this same process still consumes it. The
    // runReplay()-style importState() approach diverges on the very first
    // shop (tried it -- offers didn't match at turn 1).
    await Rng.setSeed(parsed.seed);
    const catalog = new Catalog([...parsed.settings.symbolSources], {
      forceCosmeticReroll: true,
    });
    await catalog.updateSymbols();
    if (mode === 'daily') {
      catalog.restrictTo(dailyAllowedEmoji(catalog));
    }

    const settings = new GameSettings(
      'Replay',
      parsed.settings.boardX,
      parsed.settings.boardY,
      parsed.settings.gameLength,
      parsed.settings.startingSet,
      parsed.settings.symbolSources,
      undefined,
      undefined,
      parsed.settings.initiallyLockedCells
    );

    const progression = {
      mode,
      updateUi() {},
      checkGateAndRollOffer() {},
    };
    const game = new Game(
      progression,
      settings,
      catalog,
      new SimRenderer(),
      () => {},
      /* isReplay= */ true
    );
    animationOff();

    console.log('DEBUG rng after import:', JSON.stringify(Rng.exportState()));
    console.log('DEBUG expected rng:', JSON.stringify(parsed.rng));
    console.log('DEBUG catalog symbol count:', catalog.symbols.size);

    let turn = 0;
    let lastCocktailDesc = null;
    const log = [];
    for (const event of parsed.events) {
      if (event[0] === 'r') {
        turn++;
      }
      const preOffer =
        event[0] === 'b' ? game.shop.currentOffers[event[1]] : null;
      const preTarget =
        event.length > 3
          ? event[3] === null
            ? null
            : [event[3], event[4]]
          : undefined;
      // Resolve the tool target's emoji BEFORE playing the event -- the
      // buy's effect (Eye/Axe/Pin) mutates that cell as part of applying it.
      let targetEmoji = null;
      if (preTarget) {
        targetEmoji = game.board.getSymbol(preTarget[0], preTarget[1]).emoji();
      }
      const moneyBefore = game.inventory.getResource(Const.MONEY);

      await playEvent(game, event);

      if (event[0] === 'r' && turn === 1) {
        console.log(
          'DEBUG offers after first roll:',
          JSON.stringify(game.shop.currentOffers.map((o) => o.symbol.emoji()))
        );
        console.log('DEBUG buyLines:', game.shop.buyLines);
        console.log('DEBUG luck:', game.inventory.getResource(Const.LUCK));
        console.log(
          'DEBUG inventory:',
          game.inventory.symbols.map((s) => s.emoji()).join('')
        );
        console.log(
          'DEBUG board:',
          JSON.stringify(
            game.board.cells.map((row) => row.map((c) => c.emoji()))
          )
        );
        const cocktailSym = catalog.symbols.get('🍹');
        const cherrySym = catalog.symbols.get('🍒');
        console.log(
          'DEBUG rarity cocktail/cherry:',
          cocktailSym?.rarity,
          cherrySym?.rarity
        );
      }

      if (event[0] === 'b') {
        const emoji = event[2];
        const moneyAfter = game.inventory.getResource(Const.MONEY);
        let line = `turn ${turn}\tBUY  ${emoji}`;
        if (preTarget !== undefined) {
          line +=
            preTarget === null
              ? ' -> no target'
              : ` -> target ${targetEmoji}@${preTarget[0]},${preTarget[1]}`;
        }
        line += `\tmoney ${moneyBefore}->${moneyAfter}`;
        log.push(line);
      } else if (event[0] === 'f') {
        log.push(`turn ${turn}\tREFRESH\tcost=${game.shop.refreshCost}`);
      }

      const desc = describeCocktailNeighborhood(game);
      if (desc !== lastCocktailDesc) {
        log.push(`turn ${turn}\tCOCKTAIL ${desc}`);
        lastCocktailDesc = desc;
      }
    }

    console.log('\n=== Replay action log ===');
    console.log(log.join('\n'));
    console.log('\n=== Final state ===');
    console.log('isOver:', game.isOver);
    console.log('score:', game.inventory.getResource(Const.MONEY));
    console.log(
      'inventory size:',
      game.inventory.symbols.length,
      'passives:',
      game.board.passiveCells.map((s) => s.emoji()).join('')
    );
    const invCounts = {};
    for (const s of game.inventory.symbols) {
      invCounts[s.emoji()] = (invCounts[s.emoji()] || 0) + 1;
    }
    console.log('final inventory:', JSON.stringify(invCounts));
    console.log(
      'locked cells:',
      JSON.stringify(
        Object.fromEntries(
          Object.entries(game.board.lockedCells).map(([addr, lc]) => [
            addr,
            lc.symbol.emoji(),
          ])
        )
      )
    );
  }, 120000);
});
