// UNIT_TEST_PLAN.md section 7.6
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import * as Const from '../../src/consts.js';
import { CATEGORY_EMPTY_SPACE } from '../../src/symbol.js';
import { Hole, BullsEye } from '../../src/symbols/advanced.js';
import { Rock } from '../../src/symbols/rocks.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney } from './helpers/assertions.js';

describe('advanced.js', () => {
  beforeEach(async () => {
    await setSeed('advanced');
  });

  describe('MagicWand 🪄', () => {
    it('15% chance: copies a random non-empty neighbor onto a random empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['🪄 🎯', '🪨 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[1][1].emoji()).toBe('🪨');
      expect(board.cells[1][1]).not.toBe(board.cells[1][0]); // new instance
    });

    it('does nothing without an empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['🪄 🎯', '🪨 🪨'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[1][1].emoji()).toBe('🪨'); // unchanged, still original
    });

    it('does nothing without a non-empty neighbor (all neighbors empty)', async () => {
      const { game, board } = buildGame({ grid: ['🪄 ⬜', '⬜ ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🪄');
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[1][0].emoji()).toBe('⬜');
      expect(board.cells[1][1].emoji()).toBe('⬜');
    });

    it('does nothing when the 15% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['🪄 🪨', '⬜ ⬜'] });
      await seedFirstDraw((v) => v >= 0.15, { prefix: 'wand-nofire' });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[1][0].emoji()).toBe('⬜');
      expect(board.cells[1][1].emoji()).toBe('⬜');
    });
  });

  describe('Multiplier ❎', () => {
    it('doubles multiplier on every non-empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['❎ 🪨 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].multiplier).toBe(2);
    });

    it('leaves empty neighbors untouched', async () => {
      const { game, board } = buildGame({ grid: ['❎ ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });
  });

  describe('Refresh 🔀', () => {
    it('enables repeated shop refreshes', async () => {
      const { game, board } = buildGame({ grid: ['🔀 ⬜'] });
      game.shop.haveRefreshSymbol = false;
      game.shop.refreshCount = 5;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(game.shop.haveRefreshSymbol).toBe(true);
      expect(game.shop.refreshCount).toBe(0);
    });
  });

  describe('ShoppingBag 🛍️', () => {
    it('increments shop.buyCount', async () => {
      const { game, board } = buildGame({ grid: ['🛍️ ⬜'] });
      const before = game.shop.buyCount;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(game.shop.buyCount).toBe(before + 1);
    });
  });

  describe('PostBox 📮', () => {
    it('increments shop.buyLines', async () => {
      const { game, board } = buildGame({ grid: ['📮 ⬜'] });
      const before = game.shop.buyLines;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(game.shop.buyLines).toBe(before + 1);
    });
  });

  describe('Hole 🕳️', () => {
    it('is CATEGORY_EMPTY_SPACE, so nextToEmpty counts it', async () => {
      const { board } = buildGame({ grid: ['🪨 🕳️'] });
      expect(new Hole().categories()).toContain(CATEGORY_EMPTY_SPACE);
      const empties = board.nextToEmpty(0, 0);
      expect(empties).toEqual([[1, 0]]);
    });

    it('a symbol added onto a hole goes to inventory, board keeps showing 🕳️', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🕳️ ⬜'] });
      const before = inventory.symbols.length;
      await board.addSymbol(game, new Rock(), 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🕳️');
      expect(inventory.symbols.length).toBe(before + 1);
      expect(inventory.symbols.at(-1).emoji()).toBe('🪨');
    });
  });

  describe('Clover 🍀 / CrystalBall 🔮', () => {
    it('Clover adds +1% luck via addLuck, applied next turn through resetLuck', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🍀 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(inventory.tempLuckBonus).toBe(1);
      expect(inventory.getResource(Const.LUCK)).toBe(0); // not applied yet
      inventory.resetLuck();
      expect(inventory.getResource(Const.LUCK)).toBe(1);
    });

    it('CrystalBall adds +3% luck', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🔮 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(inventory.tempLuckBonus).toBe(3);
    });
  });

  describe('FortuneCookie 🥠', () => {
    it('pays 5 per point of luck', async () => {
      const { game, board } = buildGame({
        grid: ['🥠 ⬜'],
        luck: 4,
        startingMoney: 0,
      });
      expect(board.cells[0][0].counter(game)).toBe(20);
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 20);
    });

    it('pays 0 with 0 luck', async () => {
      const { game, board } = buildGame({
        grid: ['🥠 ⬜'],
        luck: 0,
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
    });
  });

  describe('BullsEye 🎯', () => {
    it('has no board hook of its own -- the effect lives entirely in chance()/badChance()', () => {
      const eye = new BullsEye();
      expect(eye.description()).toBeTruthy();
      expect(eye.copy()).toBeInstanceOf(BullsEye);
    });
  });

  describe('Rocket 🚀 / Ice 🧊', () => {
    it('Rocket speeds up every neighbor by 1 turn', async () => {
      const { game, board } = buildGame({ grid: ['🚀 🐣'] });
      board.cells[0][1].turns = 1;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].turns).toBe(2);
    });

    it('Ice slows down every neighbor by 1 turn', async () => {
      const { game, board } = buildGame({ grid: ['🧊 🐣'] });
      board.cells[0][1].turns = 1;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].turns).toBe(0);
    });

    it('Rocket and Ice on the same neighbor cancel out', async () => {
      const { game, board } = buildGame({ grid: ['🚀 🐣 🧊'] });
      board.cells[0][1].turns = 1;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      await board.cells[0][2].evaluateProduce(game, 2, 0);
      expect(board.cells[0][1].turns).toBe(1);
    });
  });

  describe('Rows 🎰', () => {
    it('adds 1 row to inventory.rowCount', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🎰 ⬜'] });
      const before = inventory.rowCount;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(inventory.rowCount).toBe(before + 1);
    });
  });
});
