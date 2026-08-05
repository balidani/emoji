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
import * as Const from '../../src/consts.js';
import { Game } from '../../src/game.js';
import { Catalog } from '../../src/catalog.js';
import { DomRenderer } from '../../src/render/DomRenderer.js';
import { ReplayRecorder, runReplay, parseReplay } from '../../src/replay.js';
import { unlockedEmoji } from '../../src/progression-roster.js';

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

const fakeProgression = { updateUi() {}, checkGateAndRollOffer() {} };
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

async function buildRecordingGame(
  settings = REPLAY_SETTINGS,
  progression = fakeProgression
) {
  const catalog = new Catalog([...settings.symbolSources]);
  await catalog.updateSymbols();
  // Mirrors bootstrap.js's loadSettings -- Progression mode narrows the
  // buyable pool before the shop ever draws from it.
  if (progression.mode === 'progression') {
    catalog.restrictTo(unlockedEmoji(progression.unlockedBags));
  }
  const rngState = Rng.exportState();
  const game = new Game(
    progression,
    settings,
    catalog,
    new DomRenderer(),
    noop
  );
  game.recorder = new ReplayRecorder({
    seedPhrase: window.seedPhrase ?? 'test-seed',
    rngState,
    settings,
    progression,
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

  it('hands control back to the player instead of freezing when the replay ends with turns left', async () => {
    cloneTemplateIntoGame();
    // A longer game than REPLAY_SETTINGS' -- recording just one roll (not
    // playing to completion) leaves turns on the table, same shape as a
    // player pasting a short replay code into a 50-turn game.
    const settings = { ...REPLAY_SETTINGS, gameLength: 5 };
    const game = await buildRecordingGame(settings);
    await drain(game.roll());
    expect(game.isOver).toBe(false);
    const code = game.recorder.serialize();

    const replayed = await drain(
      runReplay(code, { progression: fakeProgression, onGameOver: noop })
    );

    expect(replayed.isOver).toBe(false);
    // The grid's roll listener must be re-attached for real -- before the
    // fix, ReplayRenderer.addRollListener() permanently no-op'd it, so a
    // click here would have done nothing and the board stayed frozen.
    const grid = document.querySelector('.game #grid');
    const rollSpy = vi.spyOn(replayed, 'roll');
    const turnsBefore = replayed.inventory.getResource(Const.TURNS);
    grid.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(rollSpy).toHaveBeenCalledTimes(1);
    await drain(rollSpy.mock.results[0].value);
    expect(replayed.inventory.getResource(Const.TURNS)).toBe(turnsBefore - 1);
  });

  it('gives the continued game its own recorder covering the whole run, not just the part played live', async () => {
    cloneTemplateIntoGame();
    const settings = { ...REPLAY_SETTINGS, gameLength: 5 };
    const game = await buildRecordingGame(settings);
    await drain(game.roll());
    const code = game.recorder.serialize();
    const recordedEvents = parseReplay(code).events;
    expect(recordedEvents.length).toBeGreaterThan(0);

    const replayed = await drain(
      runReplay(code, { progression: fakeProgression, onGameOver: noop })
    );
    expect(replayed.isOver).toBe(false);
    // Nothing new played yet -- the continuation's recorder should already
    // reproduce exactly the replayed prefix.
    expect(replayed.recorder.events).toEqual(recordedEvents);

    await drain(replayed.roll());
    // And now the live continuation's own action is appended after it, so
    // exporting from here reproduces the whole run from the original start.
    expect(replayed.recorder.events).toEqual([...recordedEvents, ['r']]);
  });

  it("continuing a Progression-mode replay keeps the recorded mode/unlockedBags in its new recorder, not the live player's", async () => {
    cloneTemplateIntoGame();
    const recordingProgression = {
      mode: 'progression',
      unlockedBags: [0],
      updateUi() {},
      checkGateAndRollOffer() {},
    };
    const settings = { ...REPLAY_SETTINGS, gameLength: 5 };
    const game = await buildRecordingGame(settings, recordingProgression);
    await drain(game.roll());
    const code = game.recorder.serialize();

    const liveProgression = {
      mode: 'progression',
      unlockedBags: [0, 1, 2, 3],
      updateUi() {},
      checkGateAndRollOffer() {},
    };
    const replayed = await drain(
      runReplay(code, { progression: liveProgression, onGameOver: noop })
    );
    expect(replayed.isOver).toBe(false);
    expect(replayed.recorder.mode).toBe('progression');
    expect(replayed.recorder.unlockedBags).toEqual([0]);
  });

  it("records Progression mode + unlocked bags, and reproduces the exact same RNG trace regardless of the live player's current unlocks", async () => {
    cloneTemplateIntoGame();
    // Recorded with only bag 0 unlocked -- narrows generateShop()'s draw
    // pool (Catalog.restrictTo), which changes the RNG draw sequence itself
    // (see catalog.js's isOffered()/generateShop()), not just what's shown.
    const recordingProgression = {
      mode: 'progression',
      unlockedBags: [0],
      updateUi() {},
      checkGateAndRollOffer() {},
    };
    const game = await buildRecordingGame(
      REPLAY_SETTINGS,
      recordingProgression
    );

    globalThis.__RNG_TRACE__ = [];
    await playScriptedGame(game);
    const recordedTrace = globalThis.__RNG_TRACE__;
    delete globalThis.__RNG_TRACE__;

    expect(game.isOver).toBe(true);
    const code = game.recorder.serialize();
    const parsed = parseReplay(code);
    expect(parsed.mode).toBe('progression');
    expect(parsed.unlockedBags).toEqual([0]);

    // The player may have unlocked more bags since this replay was
    // recorded -- runReplay() must reproduce the pool as it stood at
    // record time, not whatever's live now.
    const liveProgression = {
      mode: 'progression',
      unlockedBags: [0, 1, 2, 3],
      updateUi() {},
      checkGateAndRollOffer() {},
    };

    globalThis.__RNG_TRACE__ = [];
    const replayed = await drain(
      runReplay(code, { progression: liveProgression, onGameOver: noop })
    );
    const replayedTrace = globalThis.__RNG_TRACE__;
    delete globalThis.__RNG_TRACE__;

    expect(replayed.isOver).toBe(true);
    expect(replayedTrace).toEqual(recordedTrace);

    // Launches visually in the right mode too, not just RNG-correct.
    const bar = document.querySelector('.game .progression-bar');
    expect(bar.classList.contains('hidden')).toBe(false);
    expect(bar.querySelector('.progression-bar-fill')).toBeTruthy();
  });

  it('defaults an old replay code with no mode field to Sandbox (unrestricted)', async () => {
    cloneTemplateIntoGame();
    const game = await buildRecordingGame();
    await playScriptedGame(game);

    const parsed = parseReplay(game.recorder.serialize());
    delete parsed.mode;
    delete parsed.unlockedBags;
    const legacyCode = btoa(
      unescape(encodeURIComponent(JSON.stringify(parsed)))
    );

    const replayed = await drain(
      runReplay(legacyCode, { progression: fakeProgression, onGameOver: noop })
    );
    expect(replayed.isOver).toBe(true);
    const bar = document.querySelector('.game .progression-bar');
    expect(bar.classList.contains('hidden')).toBe(true);
  });
});
