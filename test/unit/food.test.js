// UNIT_TEST_PLAN.md section 7.3
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { Butter, Bubble, Champagne, Tree } from '../../src/symbols/food.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney, matchingCalls } from './helpers/assertions.js';

describe('food.js', () => {
  beforeEach(async () => {
    await setSeed('food');
  });

  describe('Butter 🧈', () => {
    it("has no payout of its own (inherits Symb's no-op score)", async () => {
      const { game, board } = buildGame({ grid: ['🧈 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
    });

    it('melts after 7 turns (code), even though the description text says 5', async () => {
      const { game, board } = buildGame({ grid: ['🧈 ⬜'] });
      const butter = board.cells[0][0];

      butter.turns = 6;
      await butter.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🧈');

      butter.turns = 7;
      await butter.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');

      // Doc/behavior mismatch (flagged, not fixed -- see plan section 11):
      expect(new Butter().description()).toContain('5 turns');
    });

    it('counter() is 7 - turns', () => {
      const butter = new Butter();
      butter.turns = 2;
      expect(butter.counter()).toBe(5);
    });
  });

  describe('Cherry 🍒', () => {
    it('an isolated cherry pays nothing and does not animate', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🍒 ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
      expect(matchingCalls(spy, 'animateCell', { name: 'flip' }).length).toBe(
        0
      );
    });

    it('two adjacent cherries each pay 💵2', async () => {
      const { game, board } = buildGame({
        grid: ['🍒 🍒'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 2);
    });

    it('in a cluster, each cherry pays 2 per neighboring cherry', async () => {
      const { game, board } = buildGame({
        grid: ['🍒 🍒 🍒'],
        startingMoney: 0,
      });
      await board.cells[0][1].score(game, 1, 0); // middle: 2 neighbors
      expectMoney(game, 4);
    });
  });

  describe('Corn 🌽', () => {
    it('pays 💵21', async () => {
      const { game, board } = buildGame({ grid: ['🌽 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 21);
    });

    it('15% chance: pops 🍿 onto ALL empty neighbors, not just one', async () => {
      const { game, board } = buildGame({
        grid: ['⬜ ⬜ ⬜', '⬜ 🌽 🎯', '⬜ ⬜ ⬜'],
      });
      await board.cells[1][1].evaluateProduce(game, 1, 1);
      let popcornCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '🍿') popcornCount++;
        }
      }
      // 8 neighbors, one is the 🎯 itself (not empty) -> 7 empties popped.
      expect(popcornCount).toBe(7);
    });

    it('does nothing when the 15% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['🌽 ⬜'] });
      await seedFirstDraw((v) => v >= 0.15, { prefix: 'corn-nofire' });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });
  });

  describe('Pineapple 🍍', () => {
    it('pays 12 on an empty board (no neighbors)', async () => {
      const { game, board } = buildGame({
        grid: ['⬜ ⬜ ⬜', '⬜ 🍍 ⬜', '⬜ ⬜ ⬜'],
        startingMoney: 0,
      });
      await board.cells[1][1].score(game, 1, 1);
      expectMoney(game, 12);
    });

    it('pays 12 - 2 per non-empty neighbor, and can go negative', async () => {
      const { game, board } = buildGame({
        grid: ['🪨 🪨 🪨', '🪨 🍍 🪨', '🪨 🪨 🪨'],
        startingMoney: 0,
      });
      await board.cells[1][1].score(game, 1, 1);
      expectMoney(game, 12 - 8 * 2); // -4
    });
  });

  describe('Popcorn 🍿', () => {
    it('pays 17 with no butter neighbors', async () => {
      const { game, board } = buildGame({ grid: ['🍿 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 17);
    });

    it('x4 per neighboring 🧈, so two butters give x16', async () => {
      const { game, board } = buildGame({
        grid: ['🧈 🍿 🧈'],
        startingMoney: 0,
      });
      await board.cells[0][1].score(game, 1, 0);
      expectMoney(game, 17 * 16);
    });

    it('disappears after timeToLive turns; counter() tracks it', async () => {
      const { game, board } = buildGame({ grid: ['🍿 ⬜'] });
      const popcorn = board.cells[0][0];
      popcorn.timeToLive = 2;
      popcorn.turns = 1;
      expect(popcorn.counter()).toBe(1);
      await popcorn.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🍿');

      popcorn.turns = 2;
      await popcorn.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });
  });

  describe('Bubble 🫧', () => {
    it('has no payout and is CATEGORY_UNBUYABLE', () => {
      const bubble = new Bubble();
      expect(bubble.categories()).toContain(CATEGORY_UNBUYABLE);
    });

    it('disappears after 3 turns', async () => {
      const { game, board } = buildGame({ grid: ['🫧 ⬜'] });
      const bubble = board.cells[0][0];
      bubble.turns = 2;
      await bubble.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🫧');

      bubble.turns = 3;
      await bubble.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });
  });

  describe('Cocktail 🍹', () => {
    it('removes neighboring 🍒 (+2) and 🍍 (+4) into permanent cherryScore', async () => {
      const { game, board } = buildGame({ grid: ['🍹 🍒', '🍍 ⬜'] });
      const cocktail = board.cells[0][0];
      await cocktail.evaluateConsume(game, 0, 0);
      expect(cocktail.cherryScore).toBe(6);
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[1][0].emoji()).toBe('⬜');
    });

    it('removes 🍾 for x1.5 (truncated)', async () => {
      const { game, board } = buildGame({ grid: ['🍹 🍾'] });
      const cocktail = board.cells[0][0];
      cocktail.cherryScore = 5;
      await cocktail.evaluateConsume(game, 0, 0);
      expect(cocktail.cherryScore).toBe(7); // trunc(5 * 1.5) = trunc(7.5) = 7
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });

    it('score pays cherryScore; counter() and copy() preserve it cumulatively', async () => {
      const { game, board } = buildGame({
        grid: ['🍹 🍒'],
        startingMoney: 0,
      });
      const cocktail = board.cells[0][0];
      await cocktail.evaluateConsume(game, 0, 0);
      await cocktail.score(game, 0, 0);
      expectMoney(game, 2);
      expect(cocktail.counter()).toBe(2);
      expect(cocktail.copy().cherryScore).toBe(2);
    });
  });

  describe('Champagne 🍾', () => {
    it('pays 💵70', async () => {
      const { game, board } = buildGame({ grid: ['🍾 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 70);
    });

    it('before 3 turns, does not explode', async () => {
      const { game, board } = buildGame({ grid: ['🍾 ⬜'] });
      const champagne = board.cells[0][0];
      champagne.turns = 2;
      await champagne.evaluateProduce(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🍾');
    });

    it('after 3 turns, explodes into 🫧 on itself and every empty neighbor', async () => {
      const { game, board, eventlog } = buildGame({
        grid: ['⬜ ⬜ ⬜', '⬜ 🍾 ⬜', '⬜ ⬜ ⬜'],
      });
      const champagne = board.cells[1][1];
      champagne.turns = 3;
      await champagne.evaluateProduce(game, 1, 1);

      let bubbleCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '🫧') bubbleCount++;
        }
      }
      expect(bubbleCount).toBe(9); // itself + 8 empty neighbors
      expect(
        eventlog.calls.some((c) => c.key === '🫧' && c.value === '9')
      ).toBe(true);
    });

    it('with no empty neighbors, still becomes 🫧 itself but logs nothing further', async () => {
      const { game, board, eventlog } = buildGame({
        grid: ['🪨 🪨 🪨', '🪨 🍾 🪨', '🪨 🪨 🪨'],
      });
      const champagne = board.cells[1][1];
      champagne.turns = 3;
      await champagne.evaluateProduce(game, 1, 1);
      expect(board.cells[1][1].emoji()).toBe('🫧');
      expect(eventlog.calls.some((c) => c.key === '🫧')).toBe(false);
    });

    it('counter() is 3 - turns', () => {
      const champagne = new Champagne();
      champagne.turns = 1;
      expect(champagne.counter()).toBe(2);
    });
  });

  describe('Tree 🌳', () => {
    it('every 3rd turn, grows up to two 🍒 on empty neighbors', async () => {
      const { game, board } = buildGame({
        grid: ['⬜ ⬜ ⬜', '⬜ 🌳 ⬜', '⬜ ⬜ ⬜'],
      });
      const tree = board.cells[1][1];
      tree.turns = 0;
      await tree.evaluateProduce(game, 1, 1);
      let cherryCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '🍒') cherryCount++;
        }
      }
      expect(cherryCount).toBe(2);
    });

    it('does not grow on turns that are not a multiple of 3', async () => {
      const { game, board } = buildGame({ grid: ['🌳 ⬜'] });
      const tree = board.cells[0][0];
      tree.turns = 1;
      await tree.evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });

    it('grows only what fits when fewer than 2 empties are available', async () => {
      const { game, board } = buildGame({ grid: ['🌳 ⬜ 🪨'] });
      const tree = board.cells[0][0];
      tree.turns = 0;
      await tree.evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🍒');
      expect(board.cells[0][2].emoji()).toBe('🪨');
    });

    it('counter() is 3 - (turns % 3)', () => {
      const tree = new Tree();
      tree.turns = 4;
      expect(tree.counter()).toBe(2);
    });
  });
});
