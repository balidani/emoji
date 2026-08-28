// @vitest-environment jsdom
//
// Server-side validation coverage for Daily Challenge submissions
// (DAILY_CHALLENGE_DESIGN.md #3, DAILY_CHALLENGE_AWS_SETUP.md #7.5).
// validateReplay() is the trust boundary: it reconstructs the canonical
// daily game from a server-owned seed + the pinned app version, and trusts
// only the replay's event list. This proves that reconstruction actually
// reproduces a genuine client run's score, and that every rejection path
// (version mismatch, tampering, an incomplete run) fails closed.
//
// validateReplay() always reconstructs from the real DAILY_SETTINGS
// singleton (src/daily.js) -- by design, the client's own settings are
// never trusted (DAILY_CHALLENGE_DESIGN.md #3) -- so a recording built
// against anything else could never validate. Rather than play a full
// 50-turn/11-symbol-file game here (slow, and pulls in tools.js's
// pickCellForTool, which waits on a real player click DomRenderer can't get
// headlessly), this shrinks the shared singleton's fields for the duration
// of this file, same idea as replay-roundtrip.test.js's REPLAY_SETTINGS --
// both the recording and validateReplay end up using the identical
// (shrunk) canonical settings, so the property under test is unchanged.
// Vitest isolates each test file's module graph by default, so this never
// leaks into daily.test.js's own (unmodified) DAILY_SETTINGS.
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import * as Rng from '../../src/core/rng.js';
import * as Const from '../../src/consts.js';
import { Game } from '../../src/game.js';
import { Catalog } from '../../src/catalog.js';
import { DomRenderer } from '../../src/render/DomRenderer.js';
import {
  ReplayRecorder,
  parseReplay,
  validateReplay,
} from '../../src/replay.js';
import { DAILY_SETTINGS, dailyAllowedEmoji } from '../../src/daily.js';
import { CURRENT_VERSION } from '../../src/progression.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);

// Recorded with mode: 'sandbox', not 'daily' -- Game's constructor/roll()
// never consult progression.mode for anything RNG- or gameplay-affecting
// (only over() does, to trigger the game-over name-prompt UI, which under a
// real DomRenderer waits on an actual player click a scripted run can't
// provide). The catalog is restricted via dailyAllowedEmoji() directly
// below regardless of this stub, matching bootstrap.js's loadSettings for
// mode === 'daily' -- that's the only part of "daily mode" that's actually
// RNG-affecting (DAILY_CHALLENGE_DESIGN.md #5). The recorder is separately
// tagged mode: 'daily' below so the produced replay looks like a real
// client's, even though validateReplay ignores that field regardless.
const recordingProgression = {
  mode: 'sandbox',
  updateUi() {},
  checkGateAndRollOffer() {},
};
const noop = () => {};

let originalDailySettings;

beforeAll(() => {
  originalDailySettings = {
    boardX: DAILY_SETTINGS.boardX,
    boardY: DAILY_SETTINGS.boardY,
    gameLength: DAILY_SETTINGS.gameLength,
    startingSet: DAILY_SETTINGS.startingSet,
    symbolSources: DAILY_SETTINGS.symbolSources,
  };
  DAILY_SETTINGS.boardX = 3;
  DAILY_SETTINGS.boardY = 3;
  // Long enough that the "ignores replay-supplied seed" test below is
  // robust: money.js's Coin has rarity 1 (always offered), so a short game
  // built only from money.js+ui.js can coincidentally offer the exact same
  // symbol at the exact same offer index under a completely different seed
  // -- with enough turns/buys, some non-Coin offer eventually has to appear
  // and a genuinely different seed diverges on it.
  DAILY_SETTINGS.gameLength = 15;
  DAILY_SETTINGS.startingSet = '🪙🪙';
  DAILY_SETTINGS.symbolSources = ['./symbols/money.js', './symbols/ui.js'];
});

afterAll(() => {
  Object.assign(DAILY_SETTINGS, originalDailySettings);
});

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

// game.roll() unconditionally calls Util.animationOn() for a live
// (non-replay) game -- see game.js -- so animationOff() alone can't keep a
// scripted live recording fast; fake timers + draining them (same pattern
// as test/unit/replay-roundtrip.test.js) is what actually skips the wait.
async function drain(promise) {
  const [result] = await Promise.all([promise, vi.runAllTimersAsync()]);
  return result;
}

// Plays a real client-side Daily Challenge game to completion (or for
// `maxRolls`, if given, to leave it unfinished), recording it exactly as
// bootstrap.js's loadSettings would -- same canonical DAILY_SETTINGS
// instance and dailyAllowedEmoji() restriction validateReplay() reconstructs
// server-side, so a genuine recording actually validates.
async function recordDailyRun(seedPhrase, { maxRolls = Infinity } = {}) {
  loadDom();
  await Rng.setSeed(seedPhrase);
  cloneTemplateIntoGame();
  const catalog = new Catalog([...DAILY_SETTINGS.symbolSources]);
  await catalog.updateSymbols();
  catalog.restrictTo(dailyAllowedEmoji(catalog));
  const rngState = Rng.exportState();
  const game = new Game(
    recordingProgression,
    DAILY_SETTINGS,
    catalog,
    new DomRenderer(),
    noop
  );
  game.recorder = new ReplayRecorder({
    seedPhrase,
    rngState,
    settings: DAILY_SETTINGS,
    progression: { mode: 'daily', unlockedBags: [] },
  });

  let rolls = 0;
  while (!game.isOver && rolls < maxRolls) {
    await drain(game.roll());
    rolls++;
    if (game.isOver) {
      break;
    }
    const offer = game.shop.currentOffers.find((o) => o.symbol);
    if (offer && game.shop.canAfford(game, offer.cost)) {
      const offerId = game.shop.currentOffers.indexOf(offer);
      await drain(game.shop.attemptPurchase(game, offerId));
    }
  }
  return game;
}

describe('validateReplay (Daily Challenge server validator)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a genuine daily run and computes the same score the client saw', async () => {
    const game = await recordDailyRun('daily-validate-accept');
    expect(game.isOver).toBe(true);
    const code = game.recorder.serialize();

    const result = await validateReplay(code, {
      seed: 'daily-validate-accept',
      appVersion: CURRENT_VERSION,
    });

    expect(result.valid).toBe(true);
    expect(result.score).toBe(game.inventory.getResource(Const.MONEY));
    // Server-computed from the same reconstructed game the score itself
    // comes from -- matches what the client's own (real) run tracked.
    expect(result.topEmoji).toEqual(game.stats.run.topMoneyEmoji(3));
    expect(result.topEmoji.length).toBeGreaterThan(0);
    for (let i = 1; i < result.topEmoji.length; i++) {
      expect(result.topEmoji[i - 1].money).toBeGreaterThanOrEqual(
        result.topEmoji[i].money
      );
    }
  });

  it('rejects a replay from a different app version', async () => {
    const game = await recordDailyRun('daily-validate-version');
    const code = game.recorder.serialize();

    const result = await validateReplay(code, {
      seed: 'daily-validate-version',
      appVersion: '0.0.1-not-current',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/different game version/);
  });

  it('rejects a tampered replay (swapped buy emoji) as a divergence', async () => {
    const game = await recordDailyRun('daily-validate-tamper');
    const parsed = parseReplay(game.recorder.serialize());
    const buyEvent = parsed.events.find((e) => e[0] === 'b');
    if (!buyEvent) {
      // This particular seeded run never bought anything -- nothing to
      // tamper with; not a failure of the property under test.
      return;
    }
    buyEvent[2] = '💩'; // never a real offer
    const tampered = btoa(unescape(encodeURIComponent(JSON.stringify(parsed))));

    const result = await validateReplay(tampered, {
      seed: 'daily-validate-tamper',
      appVersion: CURRENT_VERSION,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects a replay that never reaches game over', async () => {
    const game = await recordDailyRun('daily-validate-truncated', {
      maxRolls: 1,
    });
    expect(game.isOver).toBe(false);
    const code = game.recorder.serialize();

    const result = await validateReplay(code, {
      seed: 'daily-validate-truncated',
      appVersion: CURRENT_VERSION,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/game was over/);
  });

  it('ignores the replay-supplied seed/settings/mode -- only the server seed decides the board', async () => {
    // Record honestly under one seed, then validate against several
    // completely different ones -- the server must derive the start state
    // from `seed` (its own, authoritative value), not from the replay's own
    // `seed` field, so a mismatched claim here must fail exactly like a
    // tampered run would. Checked against several wrong seeds, not just
    // one: this scope's tiny catalog/short game (see the file header) means
    // any single wrong seed has a small but real chance of coincidentally
    // reproducing the same recorded offers -- requiring every one of
    // several unrelated wrong seeds to independently diverge makes that
    // coincidence astronomically unlikely without weakening what's actually
    // being proven.
    const game = await recordDailyRun('daily-validate-real-seed');
    const parsed = parseReplay(game.recorder.serialize());
    expect(parsed.seed).toBe('daily-validate-real-seed');

    const wrongSeeds = [
      'a-completely-different-seed',
      'another-wrong-seed',
      'yet-another-wrong-one',
      'nope-still-not-it',
      'one-more-for-good-measure',
    ];
    for (const seed of wrongSeeds) {
      const result = await validateReplay(game.recorder.serialize(), {
        seed,
        appVersion: CURRENT_VERSION,
      });
      expect(result.valid).toBe(false);
    }
  });
});
