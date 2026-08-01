// UNIT_TEST_PLAN.md section 7.2
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { Chick, Egg, Fox } from '../../src/symbols/animals.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney } from './helpers/assertions.js';

describe('animals.js', () => {
  beforeEach(async () => {
    await setSeed('animals');
  });

  describe('Chick 🐣', () => {
    it('score pays 💵1', async () => {
      const { game, board } = buildGame({ grid: ['🐣 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 1);
    });

    it('below timeToGrow, does not transform', async () => {
      const { game, board } = buildGame({ grid: ['🐣 ⬜'] });
      board.cells[0][0].turns = 2;
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🐣');
    });

    it('at/after timeToGrow (default 3), becomes 🐔', async () => {
      const { game, board, eventlog } = buildGame({ grid: ['🐣 ⬜'] });
      board.cells[0][0].turns = 3;
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🐔');
      expect(eventlog.calls.some((c) => c.key === '🐔')).toBe(true);
    });

    it('counter() is 3 - turns; timeToGrow is copy-preserved', () => {
      const chick = new Chick(5);
      chick.turns = 1;
      expect(chick.counter()).toBe(2);
      expect(chick.copy().timeToGrow).toBe(5);
    });
  });

  describe('Chicken 🐔', () => {
    it('score pays 💵8', async () => {
      const { game, board } = buildGame({ grid: ['🐔 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 8);
    });

    it('10% chance: lays 1-4 🥚 only on empty neighbors, never overwriting occupied cells', async () => {
      const { game, board } = buildGame({
        grid: ['🐔 🎯', '⬜ 🪨'],
      });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      // Only (0,1) is empty among the neighbors of (0,0): (1,0)=🎯, (0,1)=⬜, (1,1)=🪨.
      expect(board.cells[1][0].emoji()).toBe('🥚');
      expect(board.cells[0][1].emoji()).toBe('🎯');
      expect(board.cells[1][1].emoji()).toBe('🪨');
    });

    it('does nothing when the 10% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['🐔 ⬜'] });
      await seedFirstDraw((v) => v >= 0.1, { prefix: 'chicken-nofire' });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });

    it('lays nothing when there are no empty neighbors, even on success', async () => {
      const { game, board } = buildGame({ grid: ['🐔 🎯', '🪨 🪨'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      for (const row of board.cells) {
        for (const cell of row) {
          expect(cell.emoji()).not.toBe('🥚');
        }
      }
    });
  });

  describe('Egg 🥚', () => {
    it('below timeToHatch, does not hatch', async () => {
      const { game, board } = buildGame({ grid: ['🥚 ⬜'] });
      const egg = board.cells[0][0];
      egg.timeToHatch = 3;
      egg.turns = 2;
      await egg.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🥚');
    });

    it('at timeToHatch, hatches into 🐣 (99% branch)', async () => {
      const { game, board } = buildGame({ grid: ['🥚 ⬜'] });
      const egg = board.cells[0][0];
      egg.timeToHatch = 3;
      egg.turns = 3;
      await seedFirstDraw((v) => v >= 0.01, { prefix: 'egg-chick' });
      await egg.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🐣');
    });

    it('at timeToHatch, the rare 1% branch hatches into 🐉 (forced via 🎯)', async () => {
      const { game, board } = buildGame({ grid: ['🥚 🎯'] });
      const egg = board.cells[0][0];
      egg.timeToHatch = 3;
      egg.turns = 3;
      await egg.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🐉');
    });

    it('counter() is timeToHatch - turns', () => {
      const egg = new Egg();
      egg.timeToHatch = 4;
      egg.turns = 1;
      expect(egg.counter()).toBe(3);
    });
  });

  describe('Fox 🦊', () => {
    it('score pays eatenScore (default 10), then resets it to 10', async () => {
      const { game, board } = buildGame({ grid: ['🦊 ⬜'], startingMoney: 0 });
      const fox = board.cells[0][0];
      await fox.score(game, 0, 0);
      expectMoney(game, 10);
      expect(fox.eatenScore).toBe(10);
    });

    it('eats a 🐣 for x2 and a 🐔 for x3, stacking to x6 (10 -> 60)', async () => {
      const { game, board } = buildGame({ grid: ['🦊 🐣', '🐔 ⬜'] });
      const fox = board.cells[0][0];
      await fox.evaluateConsume(game, 0, 0);
      expect(fox.eatenScore).toBe(60);
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[1][0].emoji()).toBe('⬜');
      expect(fox.turns).toBe(0);
    });

    it('ignores non-poultry neighbors', async () => {
      const { game, board } = buildGame({ grid: ['🦊 🪨'] });
      const fox = board.cells[0][0];
      await fox.evaluateConsume(game, 0, 0);
      expect(fox.eatenScore).toBe(10);
      expect(board.cells[0][1].emoji()).toBe('🪨');
    });

    it('removes itself after 5 turns with no food', async () => {
      const { game, board } = buildGame({ grid: ['🦊 ⬜'] });
      const fox = board.cells[0][0];
      fox.turns = 5;
      await fox.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });

    it('counter() is 5 - turns', () => {
      const fox = new Fox();
      fox.turns = 2;
      expect(fox.counter()).toBe(3);
    });
  });

  describe('Dragon 🐉', () => {
    it('pays 💵42', async () => {
      const { game, board } = buildGame({ grid: ['🐉 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 42);
    });
  });

  describe('Bug 🐛', () => {
    it('eats food-category neighbors (🍒), ignoring non-food (🪨)', async () => {
      const { game, board } = buildGame({ grid: ['🐛 🍒', '🪨 ⬜'] });
      const bug = board.cells[0][0];
      await bug.evaluateConsume(game, 0, 0);
      expect(bug.foodScore).toBe(8);
      expect(board.cells[0][1].emoji()).toBe('⬜'); // 🍒 eaten
      expect(board.cells[1][0].emoji()).toBe('🪨'); // untouched
      expect(bug.turns).toBe(0);
    });

    it('eats vegetables too (🌽), not just fruit', async () => {
      const { game, board } = buildGame({ grid: ['🐛 🌽'] });
      const bug = board.cells[0][0];
      await bug.evaluateConsume(game, 0, 0);
      expect(bug.foodScore).toBe(8);
    });

    it('pays foodScore next score(), then resets it to 0', async () => {
      const { game, board } = buildGame({ grid: ['🐛 🍒'], startingMoney: 0 });
      const bug = board.cells[0][0];
      await bug.evaluateConsume(game, 0, 0);
      await bug.score(game, 0, 0);
      expectMoney(game, 8);
      expect(bug.foodScore).toBe(0);
    });

    it('removes itself after 5 turns with no food', async () => {
      const { game, board } = buildGame({ grid: ['🐛 ⬜'] });
      const bug = board.cells[0][0];
      bug.turns = 5;
      await bug.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });
  });
});
