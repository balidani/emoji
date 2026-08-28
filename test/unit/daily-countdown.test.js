// daily.js's nextSeedTime()/formatTimeUntilNextSeed(): the "time left"
// countdown shown under the leaderboard entries (render/
// dailyLeaderboardList.js). Pure functions, no DOM/RNG -- take `now` as a
// parameter instead of reading the global clock, so these are trivial to
// test at fixed instants.
import { describe, it, expect } from 'vitest';
import { nextSeedTime, formatTimeUntilNextSeed } from '../../src/daily.js';

describe('nextSeedTime', () => {
  it('is the next UTC midnight after `now`', () => {
    const now = new Date('2026-08-28T14:32:10.000Z');
    expect(nextSeedTime(now).toISOString()).toBe('2026-08-29T00:00:00.000Z');
  });

  it('rolls over correctly at the end of a month/year', () => {
    const now = new Date('2025-12-31T23:59:59.000Z');
    expect(nextSeedTime(now).toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('formatTimeUntilNextSeed', () => {
  it('formats whole hours and minutes remaining', () => {
    const now = new Date('2026-08-28T09:15:00.000Z');
    expect(formatTimeUntilNextSeed(now)).toBe('Next challenge in 14h 45m');
  });

  it('rounds down to whole minutes rather than up', () => {
    const now = new Date('2026-08-28T23:58:30.000Z');
    // 1m30s left -- floors to 0h 1m, never claims a minute that hasn't
    // fully elapsed yet.
    expect(formatTimeUntilNextSeed(now)).toBe('Next challenge in 0h 1m');
  });

  it('reads a full day right at the boundary -- the new seed just started', () => {
    const now = new Date('2026-08-29T00:00:00.000Z');
    expect(formatTimeUntilNextSeed(now)).toBe('Next challenge in 24h 0m');
  });

  it('never goes negative a moment before the boundary', () => {
    const now = new Date('2026-08-28T23:59:59.500Z');
    expect(formatTimeUntilNextSeed(now)).toBe('Next challenge in 0h 0m');
  });
});
