// UNIT_TEST_PLAN.md section 7.5
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { buildGame, buildCatalog } from './helpers/fakeGame.js';
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

    // Regression test: Board.score() scores passive (inventory, e.g. via
    // 👁️ Eye) symbols as `symbol.score(game, -1, i)` (board.js) -- x === -1
    // is the established "not actually on the board" sentinel every other
    // coordinate-taking Board method (nextToSymbol, redrawCell, addSymbol)
    // already guards against. allSameInRow/allSameInColumn didn't, so a
    // passive 💎 crashed with "Cannot read properties of undefined (reading
    // 'emoji')" the moment it scored (board.js's this.cells[y][x] with
    // x === -1 reads past the row array). Even with a board that, if the
    // diamond WERE placed there, would give the full row+column bonus, a
    // passive diamond gets neither -- it isn't really in that row/column.
    it('a passive (off-board) diamond scores without crashing, with no row/col bonus', async () => {
      const { game, board } = buildGame({
        grid: ['💎 💎 💎', '💎 💎 💎', '💎 💎 💎'],
        startingMoney: 0,
      });
      // Matches Board.makePassive(): a copy lives in passiveCells, and
      // Board.score() drives it as `.score(game, -1, i)`.
      board.passiveCells.push(board.cells[1][1].copy());
      await board.passiveCells[0].score(game, -1, 0);
      // No neighbors (nextToSymbol also returns [] for x === -1) and no
      // row/col bonus -> flat 7.
      expectMoney(game, 7);
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

    // 🌋 unlocks in Progression mode's very first bag (bag 0), while 🕳️
    // doesn't unlock until the last one (bag 5) -- see progression-roster.js.
    // A player who owns 🌋 with only early bags unlocked has 🕳️ pruned out
    // of their catalog (Catalog.restrictTo), so Volcano must not go looking
    // it up there. Regression test for a bug where it did (via
    // `game.catalog.symbol('🕳️')`), throwing "Unknown symbol: 🕳️" out of
    // evaluateProduce and freezing the game mid-roll (Game.roll() never
    // reached its `this.rolling = false`).
    it('still spawns 🕳️ + 5x🪨 when 🕳️ has been pruned from the catalog (progression-locked)', async () => {
      const catalog = buildCatalog();
      catalog.symbols.delete('🕳️');
      const { game, board, inventory } = buildGame({
        grid: ['🌋 🎯', '🪨 🪨'],
        catalog,
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
