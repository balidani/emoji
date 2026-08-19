// UNIT_TEST_PLAN.md section 7.1
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import {
  Coin,
  Briefcase,
  MoneyBag,
  Dice,
  FlyingMoney,
} from '../../src/symbols/money.js';
import { Rock } from '../../src/symbols/rocks.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import {
  expectMoney,
  matchingCalls,
  expectCallCount,
} from './helpers/assertions.js';

describe('money.js', () => {
  beforeEach(async () => {
    await setSeed('money');
  });

  describe('Coin 🪙', () => {
    it('base score pays 💵2', async () => {
      const { game, board } = buildGame({ grid: ['🪙 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 2);
    });

    it('getValue adds 1 for each active 💸 on the board', async () => {
      const { game, board } = buildGame({ grid: ['🪙 💸'] });
      expect(board.cells[0][0].getValue(game)).toBe(3);
    });

    it('getValue adds 1 for each passive 💸 resource', async () => {
      const { game, board } = buildGame({
        grid: ['🪙 ⬜'],
        resources: { [FlyingMoney.emoji]: 1 },
      });
      expect(board.cells[0][0].getValue(game)).toBe(3);
    });

    it('active and passive 💸 stack', async () => {
      const { game, board } = buildGame({
        grid: ['🪙 💸'],
        resources: { [FlyingMoney.emoji]: 1 },
      });
      expect(board.cells[0][0].getValue(game)).toBe(4);
    });

    it('copy() produces an independent instance', () => {
      const coin = new Coin();
      const copy = coin.copy();
      expect(copy).not.toBe(coin);
      expect(copy.emoji()).toBe('🪙');
    });
  });

  describe('Briefcase 💼', () => {
    const briefcaseWith = (n) =>
      buildGame({
        grid: ['💼 ⬜'],
        inventorySymbols: Array.from({ length: n }, () => new Rock()),
      });

    it.each([
      [0, 0],
      [3, 0],
      [4, 5],
      [7, 5],
      [8, 10],
    ])('inventory of %i symbols pays %i', async (n, expected) => {
      const { game, board } = briefcaseWith(n);
      expect(board.cells[0][0].counter(game)).toBe(expected);
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 1 + expected);
    });

    it('has the misspelled catgories() (not categories()), so it has no effective category', () => {
      const briefcase = new Briefcase();
      expect(briefcase.categories()).toEqual([]);
      expect(typeof briefcase.catgories).toBe('function');
    });
  });

  describe('Bank 🏦', () => {
    it('mints a 🪙 on a random empty neighbor', async () => {
      const { game, board, eventlog } = buildGame({ grid: ['🏦 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🪙');
      expect(
        eventlog.calls.some((c) => c.key === '🪙' && c.source === '🏦')
      ).toBe(true);
    });

    it('mints nothing when there is no empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['🏦 🪨'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🪨');
    });
  });

  describe('CreditCard 💳', () => {
    it('pays 💵1000 only on the first scoring turn, then 💵0, then -1100 on finalScore', async () => {
      const { game, board, spy } = buildGame({
        grid: ['💳 ⬜'],
        startingMoney: 0,
      });
      const card = board.cells[0][0];

      await card.score(game, 0, 0);
      expectMoney(game, 1000);

      await card.score(game, 0, 0);
      expectMoney(game, 1000); // no change on later turns

      await card.finalScore(game, 0, 0);
      expectMoney(game, 1000 - 1100);

      const flips = matchingCalls(spy, 'animateCell', {
        name: 'flip',
        repeat: 3,
      });
      expect(flips.length).toBe(1);
    });
  });

  describe('MoneyBag 💰', () => {
    it('evaluateConsume eats every neighboring 🪙, incrementing coins and removing them', async () => {
      const { game, board, eventlog } = buildGame({ grid: ['🪙 💰 🪙'] });
      const bag = board.cells[0][1];
      await bag.evaluateConsume(game, 1, 0);
      expect(bag.coins).toBe(2);
      expect(board.cells[0][0].emoji()).toBe('⬜');
      expect(board.cells[0][2].emoji()).toBe('⬜');
      expect(
        eventlog.calls.filter((c) => c.key === '🪙' && c.direction === 'lost')
          .length
      ).toBe(2);
    });

    it('score pays coins * Coin.getValue, scaling with 💸 too', async () => {
      const { game, board } = buildGame({
        grid: ['💰 ⬜'],
        resources: { [FlyingMoney.emoji]: 1 },
        startingMoney: 0,
      });
      const bag = board.cells[0][0];
      bag.coins = 3;
      await bag.score(game, 0, 0);
      // Coin.getValue with 1 passive 💸 = 2 + 0 + 1 = 3; 3 coins * 3 = 9.
      expectMoney(game, 9);
    });

    it('pays 0 and does not animate when there are no coins', async () => {
      const { game, board, spy } = buildGame({
        grid: ['💰 ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
      expectCallCount(spy, 'moneyEarned', 0);
    });

    it('counter() reflects coins; copy() preserves it', () => {
      const bag = new MoneyBag(4);
      expect(bag.counter()).toBe(4);
      expect(bag.copy().coins).toBe(4);
    });
  });

  describe('Jar 🫙', () => {
    it('pays 8 per distinct emoji in inventory', async () => {
      const { game, board } = buildGame({
        grid: ['🫙 ⬜'],
        startingMoney: 0,
        inventorySymbols: [new Rock(), new Rock(), new Coin(), new MoneyBag()],
      });
      expect(board.cells[0][0].counter(game)).toBe(3); // 🪨 🪙 💰 distinct
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 24);
    });

    it('an inventory of all-identical symbols still pays 8 (1 distinct)', async () => {
      const { game, board } = buildGame({
        grid: ['🫙 ⬜'],
        startingMoney: 0,
        inventorySymbols: [new Rock(), new Rock(), new Rock()],
      });
      expect(board.cells[0][0].counter(game)).toBe(1);
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 8);
    });
  });

  describe('Dice 🎲', () => {
    it('cost() is 💵77', () => {
      expect(new Dice().cost()).toEqual({ '💵': 77 });
    });

    it('80% badChance branch: pays -123 with a double shake', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🎲 ⬜'],
        startingMoney: 200,
      });
      await seedFirstDraw((v) => v < 0.8, { prefix: 'dice-lose' });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 200 - 123);
      expect(
        matchingCalls(spy, 'animateCell', { name: 'shake', repeat: 2 }).length
      ).toBe(1);
    });

    it('20% chance branch: pays +456 with a triple bounce', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🎲 ⬜'],
        startingMoney: 0,
      });
      await seedFirstDraw((v) => v >= 0.8, { prefix: 'dice-win' });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 456);
      expect(
        matchingCalls(spy, 'animateCell', { name: 'bounce', repeat: 3 }).length
      ).toBe(1);
    });
  });

  describe('FlyingMoney 💸', () => {
    it('score is a no-op; its effect is entirely the Coin/MoneyBag buff', async () => {
      const { game, board } = buildGame({ grid: ['💸 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
    });
  });

  describe('Gambler 🤑', () => {
    it('lowers luck by 2%', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🤑 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(inventory.tempLuckBonus).toBe(-2);
    });

    it('triples the multiplier on a neighboring 🎲', async () => {
      const { game, board } = buildGame({ grid: ['🤑 🎲'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].multiplier).toBe(3);
    });

    it('leaves non-🎲 neighbors untouched', async () => {
      const { game, board } = buildGame({ grid: ['🤑 🪨'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].multiplier).toBe(1);
    });

    it('consumes adjacent 💳 credit cards', async () => {
      const { game, board } = buildGame({
        grid: ['💳 🤑 💳'],
        startingMoney: 0,
      });
      await board.cells[0][1].evaluateConsume(game, 1, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
      expect(board.cells[0][2].emoji()).toBe('⬜');
    });
  });
});
