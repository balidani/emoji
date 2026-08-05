// JOKER_DESIGN.md
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { Wildcard, JOKER_DISGUISES } from '../../src/symbols/wildcard.js';
import { buildGame } from './helpers/fakeGame.js';
import { buildRealCatalog } from './helpers/realGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { STARTING_POOL } from '../../src/progression-roster.js';

describe('wildcard.js', () => {
  beforeEach(async () => {
    await setSeed('wildcard');
  });

  describe('Wildcard 🃏', () => {
    it('transformsOnRoll() is true, unlike the base default', () => {
      expect(new Wildcard().transformsOnRoll()).toBe(true);
    });

    it('is buyable (no CATEGORY_UNBUYABLE)', () => {
      expect(new Wildcard().categories()).not.toContain(CATEGORY_UNBUYABLE);
    });

    it('rollDisguise draws exactly one symbol from JOKER_DISGUISES', async () => {
      const { game } = buildGame({ grid: ['⬜'] });
      const disguise = new Wildcard().rollDisguise(game);
      expect(JOKER_DISGUISES).toContain(disguise.emoji());
    });

    it('every disguise in JOKER_DISGUISES resolves in the full catalog', async () => {
      const catalog = await buildRealCatalog();
      for (const emoji of JOKER_DISGUISES) {
        expect(() => catalog.symbol(emoji)).not.toThrow();
      }
    });

    // 🃏 unlocks in Progression mode's bag 1, but JOKER_DISGUISES includes
    // 📮 (bag 5, the very last unlock -- see progression-roster.js). A
    // player who owns a Joker with only early bags unlocked must still be
    // able to roll a 📮 disguise: Catalog.restrictTo() only narrows what's
    // *buyable*, it must never make game.catalog.symbol(...) throw for a
    // symbol some other symbol's effect wants to spawn (see catalog.js's
    // restrictTo doc comment, and rocks.test.js's matching Volcano case).
    it('every disguise still resolves once restrictTo has narrowed the buyable pool', async () => {
      const catalog = await buildRealCatalog();
      catalog.restrictTo(new Set(STARTING_POOL)); // no bags unlocked at all
      for (const emoji of JOKER_DISGUISES) {
        expect(() => catalog.symbol(emoji)).not.toThrow();
      }
    });
  });

  describe('board.transformWildcards / revertWildcards', () => {
    it('transform swaps the cell into a disguise, keeping the Joker itself off-board', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🃏 ⬜'] });
      const joker = board.cells[0][0];
      inventory.symbols.push(joker);

      await board.transformWildcards(game);

      const disguise = board.cells[0][0];
      expect(disguise).not.toBe(joker);
      expect(disguise.wildcardHome).toBe(joker);
      expect(inventory.symbols).toContain(joker);
    });

    it('transform logs the disguise as an event, sourced from 🃏', async () => {
      const { game, board, eventlog } = buildGame({ grid: ['🃏 ⬜'] });
      const joker = board.cells[0][0];

      await board.transformWildcards(game);

      const disguise = board.cells[0][0];
      expect(eventlog.calls).toContainEqual({
        key: disguise.emoji(),
        value: '',
        source: joker.emoji(),
        direction: 'earned',
      });
    });

    it('an untouched disguise reverts back to the same Joker instance', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🃏 ⬜'] });
      const joker = board.cells[0][0];
      inventory.symbols.push(joker);

      await board.transformWildcards(game);
      await board.revertWildcards(game);

      expect(board.cells[0][0]).toBe(joker);
      expect(board.cells[0][0].emoji()).toBe('🃏');
    });

    it('a disguise removed mid-turn leaves the Joker surviving in inventory, off the board', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🃏 ⬜'] });
      const joker = board.cells[0][0];
      inventory.symbols.push(joker);

      await board.transformWildcards(game);
      await board.removeSymbol(game, 0, 0);
      expect(inventory.symbols).toContain(joker);

      await board.revertWildcards(game);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });

    it('a Joker-as-🥚 that hatches keeps both the hatchling and the surviving Joker', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🥚 ⬜'] });
      const joker = new Wildcard();
      inventory.symbols.push(joker);
      const egg = board.cells[0][0];
      egg.wildcardHome = joker;
      egg.turns = egg.timeToHatch;
      await seedFirstDraw((v) => v >= 0.01, { prefix: 'joker-egg-no-dragon' });

      await egg.evaluateConsume(game, 0, 0);
      await board.revertWildcards(game);

      expect(board.cells[0][0].emoji()).toBe('🐣');
      expect(inventory.symbols).toContain(joker);
      expect(inventory.symbols.some((s) => s.emoji() === '🐣')).toBe(true);
    });

    it('a pinned Joker: the disguise being removed also clears the pin', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🃏 ⬜'] });
      const joker = board.cells[0][0];
      inventory.symbols.push(joker);

      await board.lockCell(0, 0, joker, -1);
      await board.transformWildcards(game);
      expect(board.lockedAt(0, 0)).toBe(true);

      await board.removeSymbol(game, 0, 0);
      expect(board.lockedAt(0, 0)).toBe(false);
    });

    it('a Joker-less board: both phases are pure no-ops', async () => {
      const { game, board, spy } = buildGame({ grid: ['🪙 ⬜'] });
      const before = board.cells[0][0];

      await board.transformWildcards(game);
      await board.revertWildcards(game);

      expect(board.cells[0][0]).toBe(before);
      expect(spy.calls.filter((c) => c.method === 'transformCell').length).toBe(
        0
      );
    });
  });
});
