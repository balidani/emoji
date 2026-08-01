// Pins down the shared machinery every symbol inherits (UNIT_TEST_PLAN.md
// section 5). Bugs here masquerade as bugs in dozens of symbols, so this
// file is built and trusted before any per-symbol test.
import { describe, it, expect, beforeEach } from 'vitest';
import { Symb, chance, badChance } from '../../src/symbol.js';
import * as Const from '../../src/consts.js';
import { setSeed } from '../../src/core/rng.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import {
  expectMoney,
  matchingCalls,
  expectCallCount,
} from './helpers/assertions.js';

class Dummy extends Symb {
  static emoji = '🧪';
  copy() {
    return new Dummy();
  }
  description() {
    return 'dummy';
  }
}

describe('Symb base class', () => {
  beforeEach(async () => {
    await setSeed('symbol-base');
  });

  it('emoji() returns the concrete class static emoji', () => {
    expect(new Dummy().emoji()).toBe('🧪');
  });

  it('reset() sets multiplier to 1 but leaves turns untouched', () => {
    const d = new Dummy();
    d.multiplier = 5;
    d.turns = 3;
    d.reset();
    expect(d.multiplier).toBe(1);
    expect(d.turns).toBe(3);
  });

  it('base copy() throws', () => {
    expect(() => new Symb().copy()).toThrow();
  });

  it('base description() throws', () => {
    expect(() => new Symb().description()).toThrow();
  });

  it('descriptionLong() defaults to description() unless overridden', () => {
    expect(new Dummy().descriptionLong()).toBe('dummy');
  });

  it('default counter() is null', () => {
    expect(new Dummy().counter()).toBeNull();
  });

  it('renderSpec reflects emoji/counter/pinned for a real symbol', async () => {
    const { game, board } = buildGame({ grid: ['🐣 ⬜'] });
    const spec = board.cells[0][0].renderSpec(game, 0, 0);
    expect(spec.emoji).toBe('🐣');
    expect(spec.counter).toBe(3); // Chick: 3 - turns(0)
    expect(spec.pinned).toBe(false);

    await board.lockCell(0, 0, board.cells[0][0], -1);
    expect(board.cells[0][0].renderSpec(game, 0, 0).pinned).toBe(true);
  });

  describe('addResource', () => {
    it('logs via eventlog with source = emoji at (x, y)', async () => {
      const { game, board, eventlog } = buildGame({ grid: ['🪙 ⬜'] });
      await board.cells[0][0].addResource(game, 0, 0, Const.MONEY, 5);
      expect(eventlog.calls[0]).toMatchObject({
        key: Const.MONEY,
        value: 5,
        source: '🪙',
        direction: 'earned',
      });
    });

    it('adds value to inventory[key]', async () => {
      const { game, board } = buildGame({ grid: ['🪙 ⬜'], startingMoney: 1 });
      await board.cells[0][0].addResource(game, 0, 0, Const.MONEY, 7);
      expectMoney(game, 8);
    });

    it('calls view.moneyEarned only for 💵, not other resources', async () => {
      const { game, board, spy } = buildGame({ grid: ['🪙 ⬜'] });
      await board.cells[0][0].addResource(game, 0, 0, Const.MONEY, 3);
      expectCallCount(spy, 'moneyEarned', 1);

      spy.calls.length = 0;
      await board.cells[0][0].addResource(game, 0, 0, Const.LUCK, 3);
      expectCallCount(spy, 'moneyEarned', 0);
    });
  });

  describe('addMoney (multiplier pathway)', () => {
    it('pays score * multiplier through addResource', async () => {
      const { game, board } = buildGame({ grid: ['🪙 ⬜'], startingMoney: 1 });
      const coin = board.cells[0][0];
      coin.multiplier = 3;
      await coin.addMoney(game, 10, 0, 0);
      expectMoney(game, 1 + 30);
    });

    it('pays 💵 via addResource, so the moneyEarned-only rule still holds', async () => {
      const { game, board, spy } = buildGame({ grid: ['🪙 ⬜'] });
      await board.cells[0][0].addMoney(game, 10, 0, 0);
      expectCallCount(spy, 'moneyEarned', 1);
    });

    it('animates once per neighboring ❎ (N neighbors => N animation calls)', async () => {
      const { game, board, spy } = buildGame({ grid: ['❎ 🪙 ❎'] });
      const coin = board.cells[0][1];
      await coin.addMoney(game, 10, 1, 0);
      const flips = matchingCalls(spy, 'animateCell', { name: 'flip' });
      expect(flips.length).toBe(2);
      expectCallCount(spy, 'animateCellOverlay', 2);
    });

    it('does not animate when there are no ❎ neighbors', async () => {
      const { game, board, spy } = buildGame({ grid: ['⬜ 🪙 ⬜'] });
      const coin = board.cells[0][1];
      await coin.addMoney(game, 10, 1, 0);
      expectCallCount(spy, 'animateCellOverlay', 0);
      expect(matchingCalls(spy, 'animateCell', { name: 'flip' }).length).toBe(
        0
      );
    });
  });

  describe('chance()/badChance() and the 🎯 BullsEye override', () => {
    it('chance(p) fires when the next draw is below p', async () => {
      const { game } = buildGame({ grid: ['⬜'] });
      await seedFirstDraw((v) => v < 0.3, { prefix: 'chance-fire' });
      expect(chance(game, 0.3, 0, 0)).toBe(true);
    });

    it('chance(p) does not fire when the next draw is at/above p', async () => {
      const { game } = buildGame({ grid: ['⬜'] });
      await seedFirstDraw((v) => v >= 0.3, { prefix: 'chance-nofire' });
      expect(chance(game, 0.3, 0, 0)).toBe(false);
    });

    it('badChance(p) fires when the next draw is below p', async () => {
      const { game } = buildGame({ grid: ['⬜'] });
      await seedFirstDraw((v) => v < 0.8, { prefix: 'badchance-fire' });
      expect(badChance(game, 0.8, 0, 0)).toBe(true);
    });

    it('badChance(p) does not fire when the next draw is at/above p', async () => {
      const { game } = buildGame({ grid: ['⬜'] });
      await seedFirstDraw((v) => v >= 0.8, { prefix: 'badchance-nofire' });
      expect(badChance(game, 0.8, 0, 0)).toBe(false);
    });

    it('luck raises chance()', async () => {
      const { game } = buildGame({ grid: ['⬜'], luck: 100 });
      // luck=100 makes even p=0 certain: 0 + 100/100 = 1.0, and
      // randomFloat() always returns a value in [0, 1) -- no seed steering
      // needed, this holds for any seed.
      await setSeed('luck-chance');
      expect(chance(game, 0, 0, 0)).toBe(true);
    });

    it('luck never makes badChance fire when p - luck/100 is negative', async () => {
      // Documents current (unclamped) behavior: badChance's threshold can go
      // negative and randomFloat() (always >= 0) then simply never satisfies
      // `< negative`, so the effect never fires. This is a behavior/doc
      // characterization test, not a statement that the lack of clamping is
      // intentional -- see UNIT_TEST_PLAN.md section 5.
      const { game } = buildGame({ grid: ['⬜'], luck: 100 });
      for (let i = 0; i < 20; ++i) {
        await setSeed('badchance-neg-' + i);
        expect(badChance(game, 0.5, 0, 0)).toBe(false);
      }
    });

    it('a 🎯 neighbor forces chance() true regardless of RNG or luck', async () => {
      const { game } = buildGame({ grid: ['🎯 ⬜'] });
      // Deliberately don't steer the seed: the override should hold no
      // matter what the underlying draw is, across many seeds.
      for (let i = 0; i < 20; ++i) {
        await setSeed('bullseye-chance-' + i);
        expect(chance(game, 0.0001, 1, 0)).toBe(true);
      }
    });

    it('a 🎯 neighbor forces badChance() false regardless of RNG or luck', async () => {
      const { game } = buildGame({ grid: ['🎯 ⬜'] });
      for (let i = 0; i < 20; ++i) {
        await setSeed('bullseye-badchance-' + i);
        expect(badChance(game, 0.9999, 1, 0)).toBe(false);
      }
    });

    it('🎯 only affects its 8 neighbors, not cells further away', async () => {
      const { game } = buildGame({ grid: ['🎯 ⬜ ⬜'] });
      // (2, 0) is two cells from the 🎯 at (0, 0) -- not a neighbor, so a
      // near-impossible p should (almost) never fire there.
      await seedFirstDraw((v) => v >= 0.5, { prefix: 'bullseye-distant' });
      expect(chance(game, 0.0001, 2, 0)).toBe(false);
    });
  });
});
