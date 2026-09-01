// @vitest-environment jsdom
//
// Balance-testing playtest harness -- NOT part of the regular suite (lives
// outside test/unit, so vitest.config.mjs's include glob skips it; run it
// explicitly with `npx vitest run test/playtest/cocktail-strategy.test.js`).
// Drives the real Board/Shop/Inventory/Catalog on production GameSettings
// (5x5 board, 50 turns, full symbol pool) with an adaptive, per-turn
// decision policy -- not a fixed buy-list -- implementing the "cocktail
// engine" strategy: pin Cocktail in a high-neighbor-count cell, feed it
// Cherry/Pineapple/Champagne/Multiplier, use Eye to make Refresh/PostBox/
// ShoppingBag/Luck passive to save board space, refresh hard while it's
// affordable, and stop refreshing to dump Champagne in the last turns.
// Prints per-game diagnostics and summary stats via console.log rather than
// asserting anything -- it's a measurement tool for tuning, not a
// pass/fail regression test. A naive "buy first affordable thing" baseline
// runs alongside it for comparison.
import { describe, it } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { animationOff } from '../../src/render/animations.js';
animationOff();
import * as Const from '../../src/consts.js';
import { GameSettings } from '../../src/game_settings.js';
import { Catalog } from '../../src/catalog.js';
import { Board } from '../../src/board.js';
import { Inventory } from '../../src/inventory.js';
import { Shop } from '../../src/shop.js';
import { EventLog } from '../../src/eventlog.js';
import { SimRenderer } from '../../src/render/SimRenderer.js';

const COCKTAIL = '🍹';
const CHAMPAGNE = '🍾';
const PINEAPPLE = '🍍';
const CHERRY = '🍒';
const MULT = '❎';
const TREE = '🌳';
const ICE = '🧊';
const PIN = '📌';
const EYE = '🧿';
const REFRESH = '🔀';
const BAG = '🛍️';
const POSTBOX = '📮';
const CLOVER = '🍀';
const CRYSTAL = '🔮';

const FEED_PRIORITY = [CHAMPAGNE, MULT, PINEAPPLE, CHERRY, TREE, ICE];
const UTILITY_SET = new Set([REFRESH, BAG, POSTBOX]);
const EYE_TARGET_PRIORITY = [REFRESH, POSTBOX, BAG, CRYSTAL, CLOVER];
const MONEY_ENGINES = new Set(['🪙', '🏦', '💼', '💰', '🫙', '🌽', '🍿', '🧈']);

function ensureShopDom() {
  document.body.innerHTML = '';
  const gameDiv = document.createElement('div');
  gameDiv.classList.add('game');
  const shopDiv = document.createElement('div');
  shopDiv.classList.add('shop');
  gameDiv.appendChild(shopDiv);
  document.body.appendChild(gameDiv);
}

async function buildGame(settings, catalog) {
  ensureShopDom();
  const view = new SimRenderer();
  const game = { settings, catalog, view, isOver: false };
  game.inventory = new Inventory(settings, catalog, view);
  game.board = new Board(game);
  game.eventlog = new EventLog(view);
  game.shop = new Shop(catalog, view);
  return game;
}

function deriveCocktailState(game) {
  const cocktailOwned = game.inventory.symbols.some(
    (s) => s.emoji() === COCKTAIL
  );
  let cocktailPinned = false;
  let pinnedAt = null;
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() === COCKTAIL) {
      cocktailPinned = true;
      pinnedAt = addr.split(',').map(Number);
    }
  }
  return { cocktailOwned, cocktailPinned, pinnedAt };
}

function bestCocktailCell(game) {
  let coord = null;
  let neighbors = -1;
  game.board.forAllCells((cell, x, y) => {
    if (cell.emoji() === COCKTAIL && !game.board.lockedAt(x, y)) {
      const n = game.board.nextToCoords(x, y).length;
      if (n > neighbors) {
        neighbors = n;
        coord = [x, y];
      }
    }
  });
  return { coord, neighbors };
}

function findEyeTarget(game, pinnedAt) {
  for (const want of EYE_TARGET_PRIORITY) {
    let found = null;
    game.board.forAllCells((cell, x, y) => {
      if (found) return;
      if (game.board.lockedAt(x, y)) return;
      if (pinnedAt && x === pinnedAt[0] && y === pinnedAt[1]) return;
      if (cell.emoji() === want) {
        found = [x, y];
      }
    });
    if (found) return found;
  }
  return null;
}

// Adaptive "cocktail engine" policy.
async function cocktailPolicy(game, diag, turn) {
  const turnsRemaining = game.inventory.getResource(Const.TURNS);
  // Board layout is fixed for the whole turn (refreshing only re-samples
  // shop offers), so whether Cocktail is currently reachable to pin is a
  // per-turn constant, not something that changes across refreshes.
  const cocktailSpot = bestCocktailCell(game);
  let offersRef = null;
  let boughtIds = new Set();
  let guard = 0;
  while (game.shop.buyCount > 0 && guard++ < 80) {
    if (game.shop.currentOffers !== offersRef) {
      offersRef = game.shop.currentOffers;
      boughtIds = new Set();
    }
    const state = deriveCocktailState(game);
    const available = game.shop.currentOffers
      .map((o, id) => ({ ...o, id }))
      .filter((o) => !boughtIds.has(o.id));

    let chosenId = -1;
    let toolTarget = undefined; // undefined = not a tool buy

    if (!state.cocktailOwned) {
      const hit = available.find((o) => o.symbol.emoji() === COCKTAIL);
      if (hit) {
        chosenId = hit.id;
        if (diag.cocktailBoughtTurn === null) diag.cocktailBoughtTurn = turn;
      }
    }

    // Throughput: ShoppingBag/PostBox/Refresh compound (each copy stacks
    // +1 buy/line every turn), so more buy slots now means more chances to
    // grab Champagne/Multiplier/Pin later.
    if (chosenId === -1) {
      const hit = available.find((o) => UTILITY_SET.has(o.symbol.emoji()));
      if (hit) chosenId = hit.id;
    }

    // Patient pin: take an 8-neighbor interior cell when we can get one,
    // but don't stall the whole game chasing it -- settle for wherever
    // Cocktail is standing once turns start running short. Opportunistic
    // only -- never held above throughput/feed buys the way an earlier
    // version of this policy tried (that made things *worse*, see notes).
    if (
      chosenId === -1 &&
      state.cocktailOwned &&
      !state.cocktailPinned &&
      cocktailSpot.coord &&
      (cocktailSpot.neighbors === 8 || turnsRemaining <= 30)
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = cocktailSpot.coord;
      }
    }

    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === EYE);
      if (hit) {
        const target = findEyeTarget(game, state.pinnedAt);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    if (chosenId === -1) {
      for (const want of FEED_PRIORITY) {
        const hit = available.find((o) => o.symbol.emoji() === want);
        if (hit) {
          chosenId = hit.id;
          break;
        }
      }
    }

    if (chosenId === -1 && !state.cocktailPinned && turnsRemaining > 2) {
      const hit = available.find(
        (o) =>
          MONEY_ENGINES.has(o.symbol.emoji()) &&
          game.shop.canAfford(game, o.cost)
      );
      if (hit) chosenId = hit.id;
    }

    if (chosenId !== -1) {
      boughtIds.add(chosenId);
      if (toolTarget !== undefined) {
        game.view.primeToolTarget(toolTarget);
        if (game.shop.currentOffers[chosenId]?.symbol.emoji() === PIN) {
          diag.pinTurn = turn;
        }
      }
      await game.shop.attemptPurchase(game, chosenId);
      continue;
    }

    // Nothing worth buying is currently offered -- refresh if it's cheap
    // enough and we still have turns left to make use of a better shop.
    const canRefresh =
      game.shop.allowRefresh &&
      (game.shop.haveRefreshSymbol || game.shop.refreshCount === 0);
    const money = game.inventory.getResource(Const.MONEY);
    if (
      turnsRemaining > 2 &&
      canRefresh &&
      game.shop.refreshCost <= money * 0.6
    ) {
      await game.shop.attemptRefresh(game);
      continue;
    }
    break;
  }
}

// Naive baseline for comparison: buy whatever's first & affordable, one
// refresh per turn if nothing looks buyable, no synergy awareness at all.
async function naivePolicy(game) {
  let guard = 0;
  while (game.shop.buyCount > 0 && guard++ < 20) {
    const offers = game.shop.currentOffers;
    const idx = offers.findIndex((o) => game.shop.canAfford(game, o.cost));
    if (idx !== -1) {
      if (offers[idx].symbol.categories?.().includes('category:Tool')) {
        game.view.primeToolTarget(null);
      }
      await game.shop.attemptPurchase(game, idx);
      continue;
    }
    if (
      game.shop.allowRefresh &&
      (game.shop.haveRefreshSymbol || game.shop.refreshCount === 0) &&
      game.shop.refreshCost <= game.inventory.getResource(Const.MONEY)
    ) {
      await game.shop.attemptRefresh(game);
      continue;
    }
    break;
  }
}

async function playTurn(game, policy, diag, turn) {
  if (game.isOver) return;
  if (game.inventory.getResource(Const.TURNS) > 0) {
    await game.inventory.addResource(Const.TURNS, -1);
    game.inventory.symbols.forEach((s) => s.reset());
    await game.shop.close(game);
    await game.board.roll(game);
    await game.board.transformWildcards(game);
    await game.board.evaluate(game);
    await game.board.score(game);
    await game.board.revertWildcards(game);
    await game.shop.open(game);
    game.inventory.resetLuck();
  } else {
    game.isOver = true;
    await game.board.finalScore(game);
    return;
  }
  await policy(game, diag, turn);
  if (game.inventory.getResource(Const.TURNS) <= 0) {
    game.isOver = true;
    await game.board.finalScore(game);
  }
}

async function playOneGame(seedPhrase, policy) {
  await setSeed(seedPhrase);
  const settings = GameSettings.instance();
  const catalog = new Catalog([...settings.symbolSources]);
  await catalog.updateSymbols();
  const game = await buildGame(settings, catalog);
  const diag = { pinTurn: null, cocktailBoughtTurn: null, champagneBought: 0 };
  let turn = 0;
  while (!game.isOver && turn < 60) {
    turn++;
    await playTurn(game, policy, diag, turn);
  }
  diag.champagneBought = game.inventory.graveyard
    .concat(game.inventory.symbols)
    .filter((s) => s.emoji() === CHAMPAGNE).length;
  const score = game.inventory.getResource(Const.MONEY);
  return { score, diag };
}

function getTrophy(settings, score) {
  const sortedThresholds = Object.keys(settings.resultLookup)
    .map(Number)
    .sort((a, b) => b - a);
  for (const t of sortedThresholds) {
    if (score >= t) return settings.resultLookup[t];
  }
  return '💩';
}

describe('scratch: cocktail strategy playtest', () => {
  it('plays N full games with the adaptive cocktail policy', async () => {
    const N = 40;
    const results = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(`cocktail-playtest-${i}`, cocktailPolicy);
      results.push(r);
    }
    const settings = GameSettings.instance();
    const scores = results.map((r) => r.score).sort((a, b) => a - b);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2
        ? scores[mid]
        : Math.round((scores[mid - 1] + scores[mid]) / 2);
    console.log('\n=== Cocktail strategy results ===');
    results.forEach((r, i) => {
      console.log(
        `game ${i}\tscore ${r.score}\tcocktailTurn=${r.diag.cocktailBoughtTurn}\tpinTurn=${r.diag.pinTurn}\tchampagne=${r.diag.champagneBought}\ttrophy=${getTrophy(settings, r.score)}`
      );
    });
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );
    const pinRate =
      results.filter((r) => r.diag.pinTurn !== null).length / results.length;
    console.log(`cocktail-pinned rate: ${(pinRate * 100).toFixed(0)}%`);
  }, 120000);

  it('plays N full games with a naive baseline for comparison', async () => {
    const N = 40;
    const scores = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(`naive-playtest-${i}`, naivePolicy);
      scores.push(r.score);
    }
    scores.sort((a, b) => a - b);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2
        ? scores[mid]
        : Math.round((scores[mid - 1] + scores[mid]) / 2);
    console.log('\n=== Naive baseline results ===');
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );
  }, 120000);
});
