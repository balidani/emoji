// PROGRESSION_DESIGN.md sections 2, 3, 5, 9 -- pure roster data/math, plus
// Catalog.restrictTo pruning to the unlocked set. No DOM, no RNG.
import { describe, it, expect } from 'vitest';
import {
  STARTING_POOL,
  BAGS,
  GATES,
  FULL_ROSTER,
  unlockedEmoji,
  nextGate,
} from '../../src/progression-roster.js';
import {
  BronzeMedal,
  SilverMedal,
  GoldMedal,
  Trophy,
} from '../../src/symbols/ui.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { buildRealCatalog } from './helpers/realGame.js';

describe('progression roster data', () => {
  it('is 17 starting + 6 bags of 6 = 53 unique symbols', () => {
    expect(STARTING_POOL).toHaveLength(17);
    expect(BAGS).toHaveLength(6);
    for (const bag of BAGS) {
      expect(bag).toHaveLength(6);
    }
    expect(FULL_ROSTER).toHaveLength(53);
    expect(new Set(FULL_ROSTER).size).toBe(53);
  });

  it('matches the real buyable catalog exactly', async () => {
    const catalog = await buildRealCatalog([
      './symbols/advanced.js',
      './symbols/animals.js',
      './symbols/food.js',
      './symbols/money.js',
      './symbols/music.js',
      './symbols/rocks.js',
      './symbols/things.js',
      './symbols/tools.js',
      './symbols/ui.js',
      './symbols/wildcard.js',
    ]);
    const buyable = [];
    for (const [emoji, sym] of catalog.symbols) {
      if (!sym.categories().includes(CATEGORY_UNBUYABLE)) buyable.push(emoji);
    }
    expect(new Set(buyable)).toEqual(new Set(FULL_ROSTER));
  });

  it('GATES rises Bronze/Silver/Gold then plateaus at Trophy', () => {
    expect(GATES).toEqual([
      BronzeMedal,
      SilverMedal,
      GoldMedal,
      Trophy,
      Trophy,
      Trophy,
    ]);
  });
});

describe('unlockedEmoji', () => {
  it('with no bags unlocked, equals the starting pool', () => {
    expect(unlockedEmoji([])).toEqual(new Set(STARTING_POOL));
  });

  it('adds each unlocked bag to the starting pool', () => {
    const result = unlockedEmoji([0, 2]);
    for (const emoji of STARTING_POOL) expect(result.has(emoji)).toBe(true);
    for (const emoji of BAGS[0]) expect(result.has(emoji)).toBe(true);
    for (const emoji of BAGS[2]) expect(result.has(emoji)).toBe(true);
    for (const emoji of BAGS[1]) expect(result.has(emoji)).toBe(false);
    expect(result.size).toBe(17 + 6 + 6);
  });

  it('unlocking all six bags covers the full roster', () => {
    const result = unlockedEmoji([0, 1, 2, 3, 4, 5]);
    expect(result).toEqual(new Set(FULL_ROSTER));
  });
});

describe('nextGate', () => {
  it('walks Bronze -> Silver -> Gold -> Trophy as bags unlock', () => {
    expect(nextGate([])).toBe(BronzeMedal);
    expect(nextGate([0])).toBe(SilverMedal);
    expect(nextGate([0, 1])).toBe(GoldMedal);
    expect(nextGate([0, 1, 2])).toBe(Trophy);
    expect(nextGate([0, 1, 2, 3])).toBe(Trophy);
    expect(nextGate([0, 1, 2, 3, 4])).toBe(Trophy);
  });

  it('is null once all six bags are unlocked', () => {
    expect(nextGate([0, 1, 2, 3, 4, 5])).toBeNull();
  });
});

describe('Catalog.restrictTo', () => {
  it('prunes symbols.js down to the allowed set, always keeping UNBUYABLE', async () => {
    const catalog = await buildRealCatalog();
    catalog.restrictTo(new Set(STARTING_POOL));

    for (const emoji of STARTING_POOL) {
      expect(catalog.symbols.has(emoji)).toBe(true);
    }
    // A bagged (locked) symbol must be gone.
    expect(catalog.symbols.has('🐉')).toBe(false);
    // Unbuyable symbols (medals, money/turn counters, ...) are always kept --
    // restrictTo only narrows the *buyable* pool.
    expect(catalog.symbols.has('🥉')).toBe(true);
    expect(catalog.symbols.has('💵')).toBe(true);
  });

  it('drops pruned emoji from category indexes too', async () => {
    const catalog = await buildRealCatalog();
    catalog.restrictTo(new Set(STARTING_POOL));
    for (const emojis of catalog.categories.values()) {
      for (const emoji of emojis) {
        expect(catalog.symbols.has(emoji)).toBe(true);
      }
    }
  });

  it('generateShop only offers the restricted pool afterwards', async () => {
    const catalog = await buildRealCatalog();
    catalog.restrictTo(new Set(STARTING_POOL));
    const bag = catalog.generateShop(20, /* luck= */ 0);
    for (const item of bag) {
      expect(STARTING_POOL).toContain(item.emoji());
    }
  });
});
