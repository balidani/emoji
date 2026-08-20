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
  progressionStatusText,
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
  it('is 17 starting + 6 bags (one with 7) = 54 unique symbols', () => {
    expect(STARTING_POOL).toHaveLength(17);
    expect(BAGS).toHaveLength(6);
    expect(BAGS.map((bag) => bag.length)).toEqual([6, 7, 6, 6, 6, 6]);
    expect(FULL_ROSTER).toHaveLength(54);
    expect(new Set(FULL_ROSTER).size).toBe(54);
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

  it('GATES is Bronze/Bronze/Silver/Silver/Gold/Trophy', () => {
    expect(GATES).toEqual([
      BronzeMedal,
      BronzeMedal,
      SilverMedal,
      SilverMedal,
      GoldMedal,
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
  it('walks Bronze -> Bronze -> Silver -> Silver -> Gold -> Trophy as bags unlock', () => {
    expect(nextGate([])).toBe(BronzeMedal);
    expect(nextGate([0])).toBe(BronzeMedal);
    expect(nextGate([0, 1])).toBe(SilverMedal);
    expect(nextGate([0, 1, 2])).toBe(SilverMedal);
    expect(nextGate([0, 1, 2, 3])).toBe(GoldMedal);
    expect(nextGate([0, 1, 2, 3, 4])).toBe(Trophy);
  });

  it('is null once all six bags are unlocked', () => {
    expect(nextGate([0, 1, 2, 3, 4, 5])).toBeNull();
  });
});

describe('progressionStatusText', () => {
  it('reports the unlocked count and the next gate', () => {
    expect(progressionStatusText([])).toBe(
      'progression 0/6, next 🥉 (💵10000)'
    );
    expect(progressionStatusText([0, 1])).toBe(
      'progression 2/6, next 🥈 (💵25000)'
    );
  });

  it('reports full-roster completion once all six bags are unlocked', () => {
    expect(progressionStatusText([0, 1, 2, 3, 4, 5])).toBe(
      'progression 6/6, full roster!'
    );
  });
});

describe('Catalog.restrictTo', () => {
  // restrictTo only narrows what generateShop() will *offer* -- it must not
  // remove anything from `symbols`/`categories`. Plenty of symbols spawn
  // other symbols directly via game.catalog.symbol(...) regardless of what
  // the player has unlocked so far for purchase (Volcano's 🕳️, Wildcard's
  // disguises, ...); pruning the catalog itself used to make those lookups
  // throw "Unknown symbol" and crash mid-roll the moment a locked symbol's
  // spawn effect fired. See rocks.test.js's Volcano regression test for the
  // end-to-end case.
  it('does not remove locked symbols from the catalog itself', async () => {
    const catalog = await buildRealCatalog();
    catalog.restrictTo(new Set(STARTING_POOL));

    for (const emoji of STARTING_POOL) {
      expect(catalog.symbols.has(emoji)).toBe(true);
    }
    // A bagged (locked) symbol must still be there -- just not offered for
    // purchase (see the generateShop test below).
    expect(catalog.symbols.has('🐉')).toBe(true);
    expect(catalog.symbol('🐉')).toBeTruthy();
    // Unbuyable symbols (medals, money/turn counters, ...) were always kept.
    expect(catalog.symbols.has('🥉')).toBe(true);
    expect(catalog.symbols.has('💵')).toBe(true);
  });

  it('leaves category indexes untouched, including locked emoji', async () => {
    const catalog = await buildRealCatalog();
    const before = new Map(
      [...catalog.categories].map(([cat, emojis]) => [cat, [...emojis]])
    );
    catalog.restrictTo(new Set(STARTING_POOL));
    expect(catalog.categories).toEqual(before);
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
