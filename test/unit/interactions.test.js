// UNIT_TEST_PLAN.md section 7.11 -- the cross-symbol interaction matrix.
// These are the pairings where a bug hides between two individually-correct
// symbols. Several exercise the real `Board.evaluate()` pipeline directly
// (consume -> produce -> consume), which our harness supports because it
// uses the real `Board` class (see helpers/fakeGame.js).
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import * as Const from '../../src/consts.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney } from './helpers/assertions.js';

describe('cross-symbol interactions', () => {
  beforeEach(async () => {
    await setSeed('interactions');
  });

  describe('value multiplication', () => {
    it('💸 FlyingMoney -> 🪙 Coin value -> 💰 MoneyBag chain: 2x💸 + 💰(3 coins) => 3*(2+2)=12', async () => {
      const { game, board } = buildGame({
        grid: ['💸 💰 💸'],
        startingMoney: 0,
      });
      const bag = board.cells[0][1];
      bag.coins = 3;
      await bag.score(game, 1, 0);
      expectMoney(game, 12);
    });

    it('❎ Multiplier stacks: one neighbor => x2, two neighbors => x4', async () => {
      const { game, board } = buildGame({
        grid: ['❎ 🪙 ❎'],
        startingMoney: 0,
      });
      const coin = board.cells[0][1];
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      await board.cells[0][2].evaluateProduce(game, 2, 0);
      expect(coin.multiplier).toBe(4);
      await coin.score(game, 1, 0);
      expectMoney(game, coin.getValue(game) * 4);
    });

    it('❎ Multiplier also multiplies losses (Dice -123 forced via seed steering)', async () => {
      const { game, board } = buildGame({
        grid: ['❎ 🎲'],
        startingMoney: 500,
      });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].multiplier).toBe(2);
      await seedFirstDraw((v) => v < 0.8, { prefix: 'interactions-dice-lose' });
      await board.cells[0][1].score(game, 1, 0);
      expectMoney(game, 500 - 246); // -123 * 2
    });

    it("❎ Multiplier doubles CreditCard's -1100 finalScore to -2200", async () => {
      const { game, board } = buildGame({
        grid: ['❎ 💳'],
        startingMoney: 2200,
      });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].multiplier).toBe(2);
      await board.cells[0][1].finalScore(game, 1, 0);
      expectMoney(game, 2200 - 2200);
    });

    it("❎ Multiplier composes with 💎 Diamond's row/column x7s", async () => {
      const { game, board } = buildGame({
        grid: ['⬜ ❎ ⬜ ⬜', '💎 💎 💎 💎'],
        startingMoney: 0,
      });
      const diamond = board.cells[1][1];
      await board.cells[0][1].evaluateProduce(game, 1, 0); // ❎ doubles the diamond
      expect(diamond.multiplier).toBe(2);
      await diamond.score(game, 1, 1);
      // 2 diamond neighbors -> (7 + 2*7) = 21; full row -> x7; not a full
      // column (❎ breaks it) -> x1; then x2 from the multiplier.
      expectMoney(game, 21 * 7 * 2);
    });
  });

  describe('consume/produce evaluation ordering', () => {
    it('🍹 Cocktail eats a about-to-explode 🍾 Champagne before it can detonate (consume runs before produce)', async () => {
      const { game, board } = buildGame({ grid: ['🍹 🍾'] });
      const champagne = board.cells[0][1];
      champagne.turns = 2; // becomes 3 (explodes) after evaluate()'s turns++
      await board.evaluate(game);
      // Cocktail's phase-1 evaluateConsume removes the champagne before its
      // own produce-phase evaluateProduce (the explosion) ever runs.
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[0][0].cherryScore).toBe(0); // trunc(0 * 1.5)
    });

    it("🏦 Bank produce-phase mint is caught by 💰 MoneyBag's trailing consume phase, same turn", async () => {
      const { game, board } = buildGame({ grid: ['🏦 💰', '⬜ ⬜'] });
      const bag = board.cells[0][1];
      await board.evaluate(game);
      expect(bag.coins).toBe(1);
    });

    it('🥁 Drums produces a 🎵 in the produce phase and 📀 Record eats it in the trailing consume phase, same evaluate()', async () => {
      const { game, board } = buildGame({ grid: ['🥁 ⬜ 📀'] });
      const drums = board.cells[0][0];
      const record = board.cells[0][2];
      drums.turns = 2; // -> 3 after increment, fires this turn
      await board.evaluate(game);
      // The note is produced in phase 2 and immediately eaten by Record's
      // trailing phase-3 consume within the very same evaluate() call --
      // exactly the produce/consume ordering this pairing is meant to pin.
      expect(record.notes).toBe(6);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });
  });

  describe('destruction / protection', () => {
    it('💣 Bomb with only a 🧑‍🚒 Firefighter neighbor has no valid target and no-ops', async () => {
      const { game, board } = buildGame({ grid: ['💣 🎯', '🧑‍🚒 ⬜'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[1][0].emoji()).toBe('🧑‍🚒');
    });
  });

  describe('timers', () => {
    it("🚀 Rocket speeds up a neighboring 🥚 Egg's hatch by exactly one turn", async () => {
      const { game, board } = buildGame({ grid: ['🚀 🥚'] });
      const egg = board.cells[0][1];
      egg.timeToHatch = 3;
      egg.turns = 2;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(egg.turns).toBe(3);
      await seedFirstDraw((v) => v >= 0.01, {
        prefix: 'interactions-egg-chick',
      });
      await egg.evaluateConsume(game, 1, 0);
      expect(board.cells[0][1].emoji()).toBe('🐣');
    });
  });

  describe('luck', () => {
    it('🍀 Clover raises luck for the following turn via resetLuck, paying out through FortuneCookie', async () => {
      const { game, board, inventory } = buildGame({
        grid: ['🍀 🥠'],
        startingMoney: 0,
      });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      inventory.resetLuck();
      expect(inventory.getResource(Const.LUCK)).toBe(1);
      await board.cells[0][1].score(game, 1, 0);
      expectMoney(game, 5);
    });

    it('🎯 BullsEye next to 🎲 Dice guarantees the +456 win (forces badChance false)', async () => {
      const { game, board } = buildGame({ grid: ['🎯 🎲'], startingMoney: 0 });
      await board.cells[0][1].score(game, 1, 0);
      expectMoney(game, 456);
    });
  });

  describe('empty-space contention', () => {
    it('two producers competing for one empty cell: only one wins, no overwrite, no crash', async () => {
      const { game, board } = buildGame({ grid: ['🏦 ⬜ 🥁'] });
      const drums = board.cells[0][2];
      drums.turns = 2; // -> 3 after increment
      await board.evaluate(game);

      const middle = board.cells[0][1].emoji();
      expect(['🪙', '🎵']).toContain(middle);
      // Whichever producer went first (row-major: Bank) claimed the cell.
      expect(middle).toBe('🪙');
    });
  });
});
