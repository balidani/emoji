// UNIT_TEST_PLAN.md section 7.9 -- mostly non-interactive resource/award
// placeholders. Minimal tests: emoji()/copy()/description() don't throw,
// since Inventory.updateUi() calls catalog.symbol(emoji).description() for
// every resource on every UI update -- a throwing description crashes the
// resource panel.
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { CATEGORY_EMPTY_SPACE, CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import {
  Empty,
  Money,
  Turn,
  BronzeMedal,
  SilverMedal,
  GoldMedal,
  Trophy,
  Crown,
  SpeechBubble,
  BuyButton,
  Luck,
} from '../../src/symbols/ui.js';
import { buildGame } from './helpers/fakeGame.js';

const PLACEHOLDER_CLASSES = [
  Money,
  Turn,
  BronzeMedal,
  SilverMedal,
  GoldMedal,
  Trophy,
  Crown,
  SpeechBubble,
  BuyButton,
  Luck,
];

describe('ui.js', () => {
  beforeEach(async () => {
    await setSeed('ui');
  });

  describe('Empty ⬜', () => {
    it('is both EMPTY_SPACE and UNBUYABLE -- many nextToEmpty/nextToExpr checks depend on this', () => {
      const empty = new Empty();
      expect(empty.categories()).toContain(CATEGORY_EMPTY_SPACE);
      expect(empty.categories()).toContain(CATEGORY_UNBUYABLE);
    });

    it('copy() works and returns an independent instance', () => {
      const empty = new Empty();
      const copy = empty.copy();
      expect(copy).not.toBe(empty);
      expect(copy.emoji()).toBe('⬜');
    });
  });

  describe('PlayButton 🕹️', () => {
    it('removes itself after 1 turn, guarding the intro board', async () => {
      const { game, board } = buildGame({ grid: ['🕹️ ⬜'] });
      const button = board.cells[0][0];
      button.turns = 0;
      await button.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🕹️');

      button.turns = 1;
      await button.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });
  });

  describe('resource/award placeholders', () => {
    it.each(PLACEHOLDER_CLASSES.map((cls) => [cls.name, cls]))(
      '%s: emoji()/copy()/description() do not throw',
      (_name, Cls) => {
        const instance = new Cls();
        expect(() => instance.emoji()).not.toThrow();
        expect(() => instance.copy()).not.toThrow();
        expect(() => instance.description()).not.toThrow();
        expect(instance.categories()).toContain(CATEGORY_UNBUYABLE);
      }
    );
  });
});
