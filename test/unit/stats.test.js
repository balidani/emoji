import { describe, it, expect } from 'vitest';
import { Stats, RunStats, ProfileStats } from '../../src/stats.js';

describe('stats.js', () => {
  describe('RunStats.topMoneyEmoji', () => {
    it('returns [] when nothing has earned money this run', () => {
      const run = new RunStats();
      expect(run.topMoneyEmoji(3)).toEqual([]);
    });

    it('returns entries descending by money, capped at n', () => {
      const run = new RunStats();
      run.moneyByEmoji = { '🪙': 10, '💎': 500, '🎁': 100, '🐔': 1 };
      expect(run.topMoneyEmoji(3)).toEqual([
        { emoji: '💎', money: 500 },
        { emoji: '🎁', money: 100 },
        { emoji: '🪙', money: 10 },
      ]);
    });

    it('returns fewer than n entries when fewer than n emoji earned money', () => {
      const run = new RunStats();
      run.moneyByEmoji = { '🪙': 10, '💎': 20 };
      expect(run.topMoneyEmoji(3)).toEqual([
        { emoji: '💎', money: 20 },
        { emoji: '🪙', money: 10 },
      ]);
    });

    it('breaks ties by insertion order (whichever emoji earned first)', () => {
      const run = new RunStats();
      run.moneyByEmoji = { '🎁': 5, '🪙': 5, '💎': 5 };
      expect(run.topMoneyEmoji(3)).toEqual([
        { emoji: '🎁', money: 5 },
        { emoji: '🪙', money: 5 },
        { emoji: '💎', money: 5 },
      ]);
    });

    it('defaults to n = 3', () => {
      const run = new RunStats();
      run.moneyByEmoji = { '🪙': 1, '💎': 2, '🎁': 3, '🐔': 4 };
      expect(run.topMoneyEmoji()).toHaveLength(3);
    });
  });

  describe('Stats.recordMoneySourced', () => {
    it('accumulates into run.moneyByEmoji, summing repeated calls for the same emoji', () => {
      const stats = new Stats(new ProfileStats());
      stats.recordMoneySourced('🪙', 5);
      stats.recordMoneySourced('🪙', 3);
      stats.recordMoneySourced('💎', 100);
      expect(stats.run.moneyByEmoji).toEqual({ '🪙': 8, '💎': 100 });
    });

    it('never touches profile (lifetime) stats -- this is run-scoped only', () => {
      const profile = new ProfileStats();
      const stats = new Stats(profile);
      stats.recordMoneySourced('🪙', 5);
      expect(profile.toJSON()).not.toHaveProperty('moneyByEmoji');
      expect(profile.lifetimeMoneyEarned).toBe(0);
    });
  });
});
