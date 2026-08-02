// @vitest-environment jsdom
//
// End-to-end determinism check for the replay feature (REPLAY_PLAN.md,
// section 13): play a short scripted game under the real DomRenderer with a
// ReplayRecorder attached, capture its RNG trace, then decode the produced
// replay code and drive it through runReplay() (ReplayRenderer, a real
// animated DomRenderer subclass) -- and assert the second RNG trace is
// byte-identical to the first. This is the strongest possible check: it
// proves a replay reproduces not just the final score, but every single RNG
// draw in the same order.
//
// Real DOM is loaded from the actual index.html (not a hand-rolled stand-in)
// so this exercises the same markup the browser serves. Animation timers are
// faked and fast-forwarded -- roll() always turns animation back on
// (Util.animationOn()), so there's no way to keep a real game's spin/delay
// timers from firing; faking them just makes waiting for them instant.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as Rng from '../../src/core/rng.js';
import { Game } from '../../src/game.js';
import { Catalog } from '../../src/catalog.js';
import { DomRenderer } from '../../src/render/DomRenderer.js';
import { ReplayRecorder, runReplay, parseReplay } from '../../src/replay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);

const REPLAY_SETTINGS = {
  boardX: 3,
  boardY: 3,
  gameLength: 3,
  startingSet: '🪙🪙',
  symbolSources: ['./symbols/money.js', './symbols/ui.js'],
  resultLookup: { 0: '🥉' },
  textLookup: {},
  initiallyLockedCells: {},
};

const fakeProgression = { updateUi() {} };
const noop = () => {};

function loadDom() {
  // Mirror what the browser does on page load: dump index.html's body into
  // the jsdom document so every selector DomRenderer's view classes touch
  // (`.game .grid`, `.replay-panel`, `.achievements-list`, ...) resolves
  // exactly like it would for a real player.
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

async function buildRecordingGame() {
  const catalog = new Catalog([...REPLAY_SETTINGS.symbolSources]);
  await catalog.updateSymbols();
  const rngState = Rng.exportState();
  const game = new Game(
    fakeProgression,
    REPLAY_SETTINGS,
    catalog,
    new DomRenderer(),
    noop
  );
  game.recorder = new ReplayRecorder({
    seedPhrase: window.seedPhrase ?? 'test-seed',
    rngState,
    settings: REPLAY_SETTINGS,
  });
  return game;
}

// Runs to game over, buying the first affordable offer whenever the shop is
// open. vi's fake timers own every animation-related setTimeout the render
// layer schedules, so each roll needs its pending timers drained before the
// next one is issued (game.roll() awaits the whole spin/evaluate/shop-open
// chain, so a single flush after each roll is enough).
// A promise chained onto a pending setTimeout only resolves once that timer
// fires -- with fake timers, nothing fires on its own. So each call below
// has to run concurrently with vi.runAllTimersAsync() (which advances fake
// time and drains microtasks in a loop), never sequentially after it, or
// the two just deadlock each other.
async function drain(promise) {
  const [result] = await Promise.all([promise, vi.runAllTimersAsync()]);
  return result;
}

async function playScriptedGame(game) {
  while (!game.isOver) {
    await drain(game.roll());
    if (game.isOver) break;
    const offer = game.shop.currentOffers.find((o) => o.symbol);
    if (offer && game.shop.canAfford(game, offer.cost)) {
      const offerId = game.shop.currentOffers.indexOf(offer);
      await drain(game.shop.attemptPurchase(game, offerId));
    }
  }
}

describe('replay round-trip determinism', () => {
  beforeEach(async () => {
    loadDom();
    await Rng.setSeed('replay-roundtrip');
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reproduces the exact same RNG trace on replay', async () => {
    cloneTemplateIntoGame();
    const game = await buildRecordingGame();

    globalThis.__RNG_TRACE__ = [];
    await playScriptedGame(game);
    const recordedTrace = globalThis.__RNG_TRACE__;
    delete globalThis.__RNG_TRACE__;

    expect(game.isOver).toBe(true);
    const code = game.recorder.serialize();
    const parsed = parseReplay(code);
    expect(parsed.events.length).toBeGreaterThan(0);

    globalThis.__RNG_TRACE__ = [];
    const replayed = await drain(
      runReplay(code, { progression: fakeProgression, onGameOver: noop })
    );
    const replayedTrace = globalThis.__RNG_TRACE__;
    delete globalThis.__RNG_TRACE__;

    expect(replayed.isOver).toBe(true);
    expect(replayedTrace).toEqual(recordedTrace);
  });

  it('detects tampering (a swapped buy emoji) as a divergence', async () => {
    cloneTemplateIntoGame();
    const game = await buildRecordingGame();
    await playScriptedGame(game);

    const parsed = parseReplay(game.recorder.serialize());
    const buyEvent = parsed.events.find((e) => e[0] === 'b');
    if (!buyEvent) {
      // This scripted run never bought anything -- nothing to tamper with.
      return;
    }
    buyEvent[2] = '💩'; // an emoji that will never be the real offer
    const tampered = btoa(unescape(encodeURIComponent(JSON.stringify(parsed))));

    await expect(
      drain(
        runReplay(tampered, {
          progression: fakeProgression,
          onGameOver: noop,
        })
      )
    ).rejects.toThrow(/shop offers/);
  });
});
