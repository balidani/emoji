// @vitest-environment jsdom
// Verifies the game-over screen's progression status line (game.js's
// over()) -- mirrors replay-roundtrip.test.js's real-DOM/real-Game harness
// rather than the fake `{ updateUi() {} }` progression stub other game.js
// tests use, since this specifically needs a real Progression with
// mode/unlockedBags wired up.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as Rng from '../../src/core/rng.js';
import { Game } from '../../src/game.js';
import { Catalog } from '../../src/catalog.js';
import { Progression } from '../../src/progression.js';
import { DomRenderer } from '../../src/render/DomRenderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);

const SETTINGS = {
  boardX: 3,
  boardY: 3,
  gameLength: 1,
  startingSet: '🪙🪙',
  symbolSources: ['./symbols/money.js', './symbols/ui.js'],
  resultLookup: { 0: '🥉' },
  textLookup: {},
  initiallyLockedCells: {},
};

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

function buildProgression(mode) {
  const p = new Progression({ render() {} }, { registerOpener() {} }, () => {});
  p.mode = mode;
  p.unlockedBags = [0, 1];
  p.pendingBagOffer = [];
  return p;
}

async function buildAndEndGame(progression) {
  cloneTemplateIntoGame();
  const catalog = new Catalog([...SETTINGS.symbolSources]);
  await catalog.updateSymbols();
  const game = new Game(
    progression,
    SETTINGS,
    catalog,
    new DomRenderer(),
    () => {}
  );
  await game.roll(); // gameLength: 1 -> this single roll ends the game
  return game;
}

describe('game-over screen progression status line', () => {
  beforeEach(async () => {
    loadDom();
    await Rng.setSeed('game-over-progression-status');
  });

  it('shows the shared progressionStatusText in Progression mode', async () => {
    const game = await buildAndEndGame(buildProgression('progression'));
    expect(game.isOver).toBe(true);
    const line = document.querySelector(
      '.scoreContainer .progression-status-line'
    );
    expect(line).not.toBeNull();
    expect(line.textContent).toBe(
      '📦 2/6 bags unlocked -- next: 🥈 Silver (💵25000)'
    );
  });

  it('is absent in Sandbox mode', async () => {
    const game = await buildAndEndGame(buildProgression('sandbox'));
    expect(game.isOver).toBe(true);
    expect(
      document.querySelector('.scoreContainer .progression-status-line')
    ).toBeNull();
  });
});
