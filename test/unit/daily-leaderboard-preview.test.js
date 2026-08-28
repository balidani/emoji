// @vitest-environment jsdom
// render/dailyLeaderboardPreview.js -- the pre-roll leaderboard shown by
// default underneath the board before Daily Challenge's first roll
// (app/bootstrap.js). DOM-only, no game/RNG involved -- mirrors
// progression-bar.test.js's approach for its sibling status-bar mount.
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
import { renderDailyLeaderboardPreview } from '../../src/render/dailyLeaderboardPreview.js';

describe('renderDailyLeaderboardPreview', () => {
  it('fills a given container with a titled panel, replacing prior content', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span')); // stale content
    renderDailyLeaderboardPreview(container, [
      { rank: 1, name: 'dan', score: 100 },
    ]);

    expect(container.children).toHaveLength(1); // .daily-leaderboard-panel
    const panel = container.querySelector('.daily-leaderboard-panel');
    expect(panel).not.toBeNull();
    expect(panel.querySelector('.daily-leaderboard-title').textContent).toBe(
      "Today's leaderboard"
    );
  });

  it('renders one row per entry, in the given order', () => {
    const container = document.createElement('div');
    renderDailyLeaderboardPreview(container, [
      { rank: 1, name: 'alice', score: 300 },
      { rank: 2, name: 'bob', score: 200 },
    ]);
    const entries = container.querySelectorAll('.daily-leaderboard-entry');
    expect(entries).toHaveLength(2);
    expect(
      entries[0].querySelector('.daily-leaderboard-name').textContent
    ).toBe('alice');
    expect(
      entries[1].querySelector('.daily-leaderboard-name').textContent
    ).toBe('bob');
  });

  it('never highlights a row as "you" -- no run has been submitted yet this round', () => {
    const container = document.createElement('div');
    renderDailyLeaderboardPreview(container, [
      { rank: 1, name: 'dan', score: 100 },
    ]);
    expect(container.querySelector('.daily-leaderboard-entry.you')).toBeNull();
  });

  it('shows an empty-state note instead of a list when there are no rows yet', () => {
    const container = document.createElement('div');
    renderDailyLeaderboardPreview(container, []);
    expect(container.querySelector('.daily-leaderboard-list')).toBeNull();
    expect(container.querySelector('.daily-leaderboard-empty')).not.toBeNull();
  });
});

// game.js's roll() -- verifies the mount app/bootstrap.js populates gets
// faded (not removed) on the round's first roll, mirroring
// progression-game-over.test.js's identical coverage for .progression-bar,
// the sibling mount this shares its declutter-on-play behavior with.
describe('daily leaderboard preview fade-out on first roll', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const indexHtml = readFileSync(
    path.resolve(__dirname, '../../index.html'),
    'utf8'
  );

  const SETTINGS = {
    boardX: 3,
    boardY: 3,
    gameLength: 2,
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

  function buildDailyProgression() {
    const p = new Progression(
      { render() {} },
      { registerOpener() {} },
      () => {}
    );
    p.mode = 'daily';
    p.unlockedBags = [];
    p.pendingBagOffer = [];
    return p;
  }

  beforeEach(async () => {
    loadDom();
    await Rng.setSeed('daily-leaderboard-preview-fade');
    animationOff();
  });
  afterEach(() => {
    animationOn();
  });

  it('stays visible until rolled, then fades (without being removed)', async () => {
    cloneTemplateIntoGame();
    // Mount the preview the same way app/bootstrap.js's loadSettings does
    // -- game.js only ever toggles the .faded class on whatever's already
    // there, it doesn't render the preview itself.
    const mount = document.querySelector('.game .daily-leaderboard-preview');
    renderDailyLeaderboardPreview(mount, [{ rank: 1, name: 'dan', score: 5 }]);
    mount.classList.remove('hidden');

    const catalog = new Catalog([...SETTINGS.symbolSources]);
    await catalog.updateSymbols();
    const game = new Game(
      buildDailyProgression(),
      SETTINGS,
      catalog,
      new DomRenderer(),
      () => {}
    );

    expect(mount.classList.contains('faded')).toBe(false);

    // gameLength: 2, so this first roll fades the preview without ending
    // the round -- a second roll would end it and drive game.js's
    // Daily Challenge game-over flow (name prompt awaiting a real click),
    // which is out of scope here; the fade itself never un-fades once set,
    // so one roll is enough to cover it.
    await game.roll();
    expect(game.isOver).toBe(false);
    expect(mount.classList.contains('faded')).toBe(true);
    // Faded, not removed -- the element (and its content) is still there.
    expect(document.querySelector('.game .daily-leaderboard-preview')).toBe(
      mount
    );
    expect(mount.querySelector('.daily-leaderboard-panel')).not.toBeNull();
  }, 15000);
});
