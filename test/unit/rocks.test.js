// UNIT_TEST_PLAN.md section 7.5
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney, matchingCalls } from './helpers/assertions.js';

describe('rocks.js', () => {
  beforeEach(async () => {
    await setSeed('rocks');
  });

  describe('Diamond 💎 -- the richest arithmetic in the game', () => {
    it('a lone diamond (no neighbors, no row/col mult) pays 7', async () => {
      const { game, board } = buildGame({
        grid: ['⬜ ⬜ ⬜', '⬜ 💎 ⬜', '⬜ ⬜ ⬜'],
        startingMoney: 0,
      });
      await board.cells[1][1].score(game, 1, 1);
      expectMoney(game, 7);
    });

    it('one neighboring diamond pays 14', async () => {
      const { game, board } = buildGame({
        grid: ['💎 💎 ⬜', '⬜ ⬜ ⬜', '⬜ ⬜ ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 14);
    });

    it('a full row of 💎 multiplies by 7, with one extra flip animation', async () => {
      const { game, board, spy } = buildGame({
        grid: ['💎 💎 💎', '⬜ ⬜ ⬜', '⬜ ⬜ ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      // 1 neighbor -> (7 + 7) * rowMult(7) * colMult(1) = 98
      expectMoney(game, 98);
      expect(matchingCalls(spy, 'animateCell', { name: 'flip' }).length).toBe(
        1
      );
    });

    it('a full row AND full column multiplies by 49 (composes)', async () => {
      const { game, board, spy } = buildGame({
        grid: ['💎 💎 💎', '💎 💎 💎', '💎 💎 💎'],
        startingMoney: 0,
      });
      await board.cells[1][1].score(game, 1, 1);
      // 8 neighbors -> (7 + 8*7) * 7 * 7 = 63 * 49 = 3087
      expectMoney(game, 3087);
      expect(matchingCalls(spy, 'animateCell', { name: 'flip' }).length).toBe(
        2
      );
    });
  });

  describe('Rock 🪨', () => {
    it('pays 💵1', async () => {
      const { game, board } = buildGame({ grid: ['🪨 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 1);
    });
  });

  describe('Volcano 🌋', () => {
    it('10% chance: replaces a random tile with 🕳️ + 5x🪨 into inventory', async () => {
      const { game, board, eventlog, inventory } = buildGame({
        grid: ['🌋 🎯', '🪨 🪨'],
      });
      const rocksBefore = inventory.symbols.filter(
        (s) => s.emoji() === '🪨'
      ).length;

      await board.cells[0][0].evaluateProduce(game, 0, 0);

      const holeCells = board.cells.flat().filter((s) => s.emoji() === '🕳️');
      expect(holeCells.length).toBe(1);

      const rocksAfter = inventory.symbols.filter(
        (s) => s.emoji() === '🪨'
      ).length;
      expect(rocksAfter - rocksBefore).toBe(5);

      expect(eventlog.calls.some((c) => c.key === '🕳️')).toBe(true);
      expect(
        eventlog.calls.some((c) => c.key === '🪨' && c.value === '5')
      ).toBe(true);
    });

    it('does nothing when the 10% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['🌋 🪨'] });
      await seedFirstDraw((v) => v >= 0.1, { prefix: 'volcano-nofire' });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🌋');
      expect(board.cells[0][1].emoji()).toBe('🪨');
    });
  });

  describe('Worker 👷', () => {
    it('removes a neighboring 🪨 and, on the 50% chance, leaves a 💎', async () => {
      const { game, board } = buildGame({ grid: ['👷 🎯', '🪨 ⬜'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[1][0].emoji()).toBe('💎');
    });

    it('on the failing 50% chance, leaves the neighbor empty (no 💎)', async () => {
      const { game, board } = buildGame({ grid: ['👷 🪨'] });
      await seedFirstDraw((v) => v >= 0.5, { prefix: 'worker-nodiamond' });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });

    it('does not pay money directly -- only produces 💎, matching the description', async () => {
      const { game, board } = buildGame({
        grid: ['👷 🎯 🪨'],
        startingMoney: 0,
      });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      // No score()/addMoney call exists on Worker at all -- money never moves.
      expectMoney(game, 0);
    });
  });
});
