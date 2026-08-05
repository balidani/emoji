// @vitest-environment jsdom
// Verifies the game-over screen never shows a progression bar (it was
// dropped -- the in-game one under the board is enough, see game.js's
// over()) and the in-game bar's fade-out-on-first-roll behavior. Mirrors
// replay-roundtrip.test.js's real-DOM/real-Game harness rather than the
// fake `{ updateUi() {} }` progression stub other game.js tests use, since
// this specifically needs a real Progression with mode/unlockedBags wired
// up.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as Rng from '../../src/core/rng.js';
import { Game } from '../../src/game.js';
import { Catalog } from '../../src/catalog.js';
import { Progression } from '../../src/progression.js';
import { DomRenderer } from '../../src/render/DomRenderer.js';
import { animationOff, animationOn } from '../../src/render/animations.js';

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

describe('game-over screen has no progression bar', () => {
  beforeEach(async () => {
    loadDom();
    await Rng.setSeed('game-over-progression-status');
    // Not animation-related slowness, but keeps this test's DOM/timer state
    // clean regardless (matches the isReplay-off code path's own default).
    animationOff();
  });
  afterEach(() => {
    animationOn();
  });

  // A real DomRenderer + jsdom board/shop build genuinely takes a few
  // seconds (dynamic symbol-module imports, real DOM construction) -- give
  // this headroom above the 5s default so it doesn't flake under parallel
  // test-runner load the way a tight timeout would.
  it('never appears in Progression mode', async () => {
    const game = await buildAndEndGame(buildProgression('progression'));
    expect(game.isOver).toBe(true);
    expect(
      document.querySelector('.scoreContainer .progression-bar')
    ).toBeNull();
  }, 15000);

  it('never appears in Sandbox mode', async () => {
    const game = await buildAndEndGame(buildProgression('sandbox'));
    expect(game.isOver).toBe(true);
    expect(
      document.querySelector('.scoreContainer .progression-bar')
    ).toBeNull();
  }, 15000);
});

describe('in-game progression bar fade-out on first roll', () => {
  beforeEach(async () => {
    loadDom();
    await Rng.setSeed('progression-bar-fade');
    animationOff();
  });
  afterEach(() => {
    animationOn();
  });

  it('stays visible until rolled, then fades (without being removed)', async () => {
    cloneTemplateIntoGame();
    // Mount the bar the same way bootstrap.js's loadSettings does --
    // game.js only ever toggles the .faded class on whatever's already
    // there, it doesn't render the bar itself.
    const { renderProgressionBar } = await import(
      '../../src/render/progressionBar.js'
    );
    const mount = document.querySelector('.game .progression-bar');
    renderProgressionBar(mount, [0, 1]);

    const catalog = new Catalog([...SETTINGS.symbolSources]);
    await catalog.updateSymbols();
    const game = new Game(
      buildProgression('progression'),
      { ...SETTINGS, gameLength: 2 },
      catalog,
      new DomRenderer(),
      () => {}
    );

    expect(mount.classList.contains('faded')).toBe(false);

    await game.roll(); // first of two rolls -- fades, doesn't end the game
    expect(game.isOver).toBe(false);
    expect(mount.classList.contains('faded')).toBe(true);
    // Faded, not removed -- the element (and its content) is still there.
    expect(document.querySelector('.game .progression-bar')).toBe(mount);
    expect(mount.querySelector('.progression-bar-text')).not.toBeNull();

    await game.roll(); // second roll ends the game -- stays faded
    expect(game.isOver).toBe(true);
    expect(mount.classList.contains('faded')).toBe(true);
  }, 15000);
});
