// @vitest-environment jsdom
//
// Regression test for the URL-hash tampering bug: in Daily Challenge mode,
// bootstrap() must always seed the RNG from the server's canonical seed for
// today, never from whatever's sitting in window.location.hash. A stale
// bookmark (yesterday's hash) or a hand-edited one would otherwise silently
// start the RNG from the wrong phrase -- every draw from the very first
// roll onward would diverge from what the validate Lambda reconstructs, so
// the run's submission would be rejected outright (see
// design/DAILY_CHALLENGE_AWS_SETUP.md #4, #7.5, and app/bootstrap.js's
// seeding block).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CURRENT_VERSION } from '../../src/progression.js';
import { fetchDailySeed, fetchDailyLeaderboard } from '../../src/daily-api.js';
import { bootstrap } from '../../src/app/bootstrap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);

function loadDom() {
  const bodyMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);
  document.body.innerHTML = bodyMatch[1];
}

// jsdom has no ResizeObserver -- bootstrap() calls initGridScaling() (see
// render/layout.js) once it successfully builds a game, which is otherwise
// unreachable from a unit test since no other test drives bootstrap() this
// deep. A no-op stand-in is enough; this test doesn't exercise resize
// behavior.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('../../src/daily-api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, fetchDailySeed: vi.fn(), fetchDailyLeaderboard: vi.fn() };
});

describe('Daily Challenge boot-time RNG seeding', () => {
  beforeEach(() => {
    loadDom();
    window.localStorage.clear();
    // Otherwise Progression.load()'s version check (see progression.js)
    // treats this as a first-ever run and wipes localStorage right back out
    // -- including the ProgressionMode this test just set -- before
    // bootstrap() finishes. A returning daily player always has this set.
    window.localStorage.setItem('CurrentVersion', CURRENT_VERSION);
    window.ResizeObserver = FakeResizeObserver;
    fetchDailySeed.mockReset();
    // Not under test here (see daily-leaderboard-preview.test.js) -- just
    // needs to resolve so loadSettings' pre-roll leaderboard fetch (fired,
    // not awaited, whenever mode is 'daily') never reaches the real network
    // during this suite.
    fetchDailyLeaderboard.mockReset().mockResolvedValue({ top: [] });
  });

  it('ignores a tampered/stale hash and reseeds from the server, correcting the hash', async () => {
    fetchDailySeed.mockResolvedValue({
      date: '2026-08-28',
      seed: 'realseed',
    });
    window.localStorage.setItem('ProgressionMode', 'daily');
    window.location.hash = 'tamperedhash';

    await bootstrap();

    expect(fetchDailySeed).toHaveBeenCalled();
    expect(window.seedPhrase).toBe('realseed');
    expect(window.location.hash.slice(1)).toBe('realseed');
    expect(window.localStorage.getItem('ProgressionMode')).toBe('daily');
  });

  it('falls back to Sandbox with a fresh random seed if the backend is unreachable, instead of trusting the tampered hash', async () => {
    fetchDailySeed.mockRejectedValue(new Error('network down'));
    window.localStorage.setItem('ProgressionMode', 'daily');
    window.location.hash = 'tamperedhash';

    await bootstrap();

    expect(window.seedPhrase).not.toBe('tamperedhash');
    expect(window.localStorage.getItem('ProgressionMode')).toBe('sandbox');
  });

  it('still honors the hash for RNG seeding outside Daily Challenge mode', async () => {
    window.localStorage.setItem('ProgressionMode', 'sandbox');
    window.location.hash = 'myshareableseed';

    await bootstrap();

    expect(fetchDailySeed).not.toHaveBeenCalled();
    expect(window.seedPhrase).toBe('myshareableseed');
    expect(window.location.hash.slice(1)).toBe('myshareableseed');
  });
});
