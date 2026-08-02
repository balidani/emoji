// UNIT_TEST_PLAN.md section 7.8
//
// Pin/Axe/Eye are buy-time interactive tools: their logic runs in onBuy()
// via view.pickCellForTool, which NullRenderer always resolves to null
// headlessly (so the golden trace suite never exercises them). Here we
// script the spy renderer's pickCellForTool to resolve a specific cell.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { Pin, Axe, Eye } from '../../src/symbols/tools.js';
import { Rock } from '../../src/symbols/rocks.js';
import { buildGame } from './helpers/fakeGame.js';
import { expectCallCount } from './helpers/assertions.js';

describe('tools.js', () => {
  beforeEach(async () => {
    await setSeed('tools');
  });

  describe('Pin 📌', () => {
    it('pins the resolved cell (permanent lock)', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [new Rock()],
      });
      spy.pickCellForToolResult = [0, 0];
      await new Pin().onBuy(game);
      expect(board.lockedAt(0, 0)).toBe(true);
    });

    it('a pinned cell survives Board.roll (not overwritten)', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [new Rock()],
      });
      spy.pickCellForToolResult = [0, 0];
      await new Pin().onBuy(game);
      const pinnedSymbol = board.cells[0][0];
      await board.roll(game);
      expect(board.cells[0][0]).toBe(pinnedSymbol);
    });

    it('no-ops (never prompts) when inventory is empty', async () => {
      const { game, spy } = buildGame({
        grid: ['⬜ ⬜'],
        inventorySymbols: [],
      });
      await new Pin().onBuy(game);
      expectCallCount(spy, 'pickCellForTool', 0);
    });

    it('no-ops when the cell picker is cancelled (resolves null)', async () => {
      const { game, board, spy } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [new Rock()],
      });
      spy.pickCellForToolResult = null;
      await new Pin().onBuy(game);
      expect(board.lockedAt(0, 0)).toBe(false);
    });

    it('restores the shop and records a null target when the cell picker is cancelled', async () => {
      // Regression test for the freeze bug: predicate can be unsatisfiable
      // by any cell on the board (e.g. an all-empty roll), so the real
      // renderer now offers a cancel button -- onToolBuy must not leave the
      // shop hidden when that happens, and the replay recorder must be told
      // this buy resolved with no target (see REPLAY_PLAN.md's tool-target
      // null-tracking decision).
      const { game, spy } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [new Rock()],
      });
      game.shop.show = vi.fn();
      game.recorder = { recordToolTarget: vi.fn() };
      spy.pickCellForToolResult = null;

      await new Pin().onBuy(game);

      expect(game.shop.show).toHaveBeenCalledTimes(1);
      expect(game.recorder.recordToolTarget).toHaveBeenCalledWith(null);
    });

    it('records the resolved [x, y] target on a successful pick', async () => {
      const { game, spy } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [new Rock()],
      });
      game.recorder = { recordToolTarget: vi.fn() };
      spy.pickCellForToolResult = [0, 0];

      await new Pin().onBuy(game);

      expect(game.recorder.recordToolTarget).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('Axe 🪓', () => {
    it('removes the resolved cell from the board and inventory', async () => {
      const { game, board, spy, inventory } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [],
      });
      // Mirror the real invariant: symbols on the board are also
      // inventory-owned instances.
      inventory.symbols.push(board.cells[0][0]);
      const before = inventory.symbols.length;

      spy.pickCellForToolResult = [0, 0];
      await new Axe().onBuy(game);

      expect(board.cells[0][0].emoji()).toBe('⬜');
      expect(inventory.symbols.length).toBe(before - 1);
    });

    it('no-ops (never prompts) when inventory is empty', async () => {
      const { game, spy } = buildGame({
        grid: ['⬜ ⬜'],
        inventorySymbols: [],
      });
      await new Axe().onBuy(game);
      expectCallCount(spy, 'pickCellForTool', 0);
    });

    it('no-ops when the cell picker is cancelled (resolves null)', async () => {
      const { game, board, spy, inventory } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [],
      });
      inventory.symbols.push(board.cells[0][0]);
      spy.pickCellForToolResult = null;
      await new Axe().onBuy(game);
      expect(board.cells[0][0].emoji()).toBe('🪨');
    });
  });

  describe('Eye 🧿', () => {
    it('converts the resolved cell into a passive, removing it from the board', async () => {
      const { game, board, spy, inventory } = buildGame({
        grid: ['🪨 ⬜'],
        inventorySymbols: [],
      });
      inventory.symbols.push(board.cells[0][0]);

      spy.pickCellForToolResult = [0, 0];
      await new Eye().onBuy(game);

      expect(board.cells[0][0].emoji()).toBe('⬜');
      expect(board.passiveCells.length).toBe(1);
      expect(board.passiveCells[0].emoji()).toBe('🪨');
      expect(inventory.getResource('🪨')).toBe(1);
    });

    it('no-ops (never prompts) when inventory is empty', async () => {
      const { game, spy } = buildGame({
        grid: ['⬜ ⬜'],
        inventorySymbols: [],
      });
      await new Eye().onBuy(game);
      expectCallCount(spy, 'pickCellForTool', 0);
    });
  });
});
