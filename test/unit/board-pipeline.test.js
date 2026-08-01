// @vitest-environment jsdom
// UNIT_TEST_PLAN.md section 9 -- behavior that only emerges from the real
// Board.evaluate()/roll() pipeline, wired to real Inventory/Catalog.
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { buildRealGame } from './helpers/realGame.js';

describe('Board pipeline (Tier 2)', () => {
  beforeEach(async () => {
    await setSeed('board-pipeline');
  });

  function placeGrid(board, catalog, grid) {
    const rows = grid.map((row) => row.trim().split(/\s+/));
    for (let y = 0; y < rows.length; ++y) {
      for (let x = 0; x < rows[y].length; ++x) {
        board.cells[y][x] = catalog.symbol(rows[y][x]);
      }
    }
    board.currentRows = rows.length;
  }

  it('evaluation order: a coin minted by 🏦 in the produce phase is collected by the trailing consume phase, same turn', async () => {
    const { game, board, catalog } = await buildRealGame();
    placeGrid(board, catalog, ['🏦 💰', '⬜ ⬜']);
    const bag = board.cells[0][1];
    await board.evaluate(game);
    expect(bag.coins).toBe(1);
  });

  it('"removed mid-evaluation" guard: a symbol removed by another in the same phase does not also run its own hook', async () => {
    const { game, board, catalog } = await buildRealGame();
    // Firefighter (0,0) evaluates before Bomb (1,0) in row-major order and
    // removes it; Bomb's own (forced-certain, via 🎯) evaluateConsume must
    // then be skipped entirely -- neither of its candidate targets should
    // be touched.
    placeGrid(board, catalog, ['🧑‍🚒 💣 🎯', '⬜ 🪨 ⬜']);
    await board.evaluate(game);
    expect(board.cells[0][0].emoji()).toBe('⬜'); // firefighter self-removed
    expect(board.cells[0][1].emoji()).toBe('⬜'); // bomb removed by firefighter
    expect(board.cells[0][2].emoji()).toBe('🎯'); // never targeted
    expect(board.cells[1][1].emoji()).toBe('🪨'); // never targeted
  });

  it('increments turns on every cell on every evaluate()', async () => {
    const { game, board, catalog } = await buildRealGame();
    placeGrid(board, catalog, ['🐣 ⬜']);
    expect(board.cells[0][0].turns).toBe(0);
    await board.evaluate(game);
    expect(board.cells[0][0].turns).toBe(1);
    await board.evaluate(game);
    expect(board.cells[0][0].turns).toBe(2);
  });

  describe('roll()', () => {
    it('keeps a pinned cell in place, never overwriting it', async () => {
      const { game, board } = await buildRealGame({ startingSet: '🪙🪙🪙' });
      await board.roll(game); // populate the board with real symbols first
      const [px, py] = board.forAllExpr((s) => s.emoji() !== '⬜').at(0);
      const pinnedSymbol = board.cells[py][px];

      await board.pinCell(game, px, py);
      await board.roll(game);

      expect(board.cells[py][px]).toBe(pinnedSymbol);
      expect(board.lockedAt(px, py)).toBe(true);
    });

    it('refills empties from the inventory pool without duplicating a symbol across cells', async () => {
      const { game, board, inventory } = await buildRealGame({
        startingSet: '🪙🪙🪙',
        boardX: 3,
        boardY: 3,
      });
      await board.roll(game);
      const placed = board.cells.flat().filter((s) => s.emoji() !== '⬜');
      // Only 3 owned symbols exist -> at most 3 cells filled.
      expect(placed.length).toBe(3);
      // Every placed symbol is one of the inventory's own instances, and
      // none repeats (each inventory symbol appears on the board once).
      expect(new Set(placed).size).toBe(3);
      for (const s of placed) {
        expect(inventory.symbols).toContain(s);
      }
    });

    it('grows the board when inventory.rowCount increases', async () => {
      const { game, board, inventory } = await buildRealGame({
        boardX: 3,
        boardY: 3,
      });
      expect(board.currentRows).toBe(3);
      inventory.rowCount = 4;
      await board.roll(game);
      expect(board.currentRows).toBe(4);
    });
  });
});
