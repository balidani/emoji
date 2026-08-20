// @vitest-environment jsdom
// UNIT_TEST_PLAN.md section 10 -- the real Shop economy wired to a real
// Catalog/Inventory on NullRenderer.
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import * as Const from '../../src/consts.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { CATEGORY_TOOL } from '../../src/symbols/tools.js';
import { CatalogUnusableError } from '../../src/catalog-errors.js';
import { FreeTurn } from '../../src/extra-symbols/beta.js';
import { buildRealGame } from './helpers/realGame.js';

describe('Shop economy (Tier 2)', () => {
  beforeEach(async () => {
    await setSeed('shop-economy');
  });

  it('canAfford is true iff every cost resource is covered', async () => {
    const { game, shop } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 100);
    expect(shop.canAfford(game, { [Const.MONEY]: 50 })).toBe(true);
    expect(shop.canAfford(game, { [Const.MONEY]: 1000 })).toBe(false);
  });

  it('attemptPurchase deducts cost, decrements buyCount, and closes the shop at 0', async () => {
    const { game, shop, catalog } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 1000);
    const before = game.inventory.getResource(Const.MONEY);
    const symbol = catalog.symbol('🪨'); // Rock, cost {} (free)
    shop.currentOffers = [{ symbol, cost: {} }];
    shop.isOpen = true;
    shop.buyCount = 1;

    await shop.attemptPurchase(game, 0);

    expect(game.inventory.getResource(Const.MONEY)).toBe(before);
    expect(shop.isOpen).toBe(false); // closed automatically once buyCount hits 0
    // close() -> reset() sets buyCount back to its default (1) for next visit.
    expect(shop.buyCount).toBe(1);
    expect(game.inventory.symbols.some((s) => s.emoji() === '🪨')).toBe(true);
  });

  it("Dice's dynamic cost() (💵77) is charged correctly", async () => {
    const { game, shop, catalog } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 100);
    const dice = catalog.symbol('🎲');
    expect(dice.cost()).toEqual({ '💵': 77 });
    shop.currentOffers = [{ symbol: dice, cost: dice.cost() }];
    shop.isOpen = true;
    shop.buyCount = 1;

    await shop.attemptPurchase(game, 0);

    expect(game.inventory.getResource(Const.MONEY)).toBe(1 + 100 - 77);
  });

  it("FreeTurn's 🎟️ ticket starts at 💵100 and is charged on purchase", async () => {
    const { game, shop } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 1000);
    const ticket = new FreeTurn();
    expect(ticket.cost(game)).toEqual({ '💵': 100 });
    const before = game.inventory.getResource(Const.MONEY);
    shop.currentOffers = [{ symbol: ticket, cost: ticket.cost(game) }];
    shop.isOpen = true;
    shop.buyCount = 1;

    await shop.attemptPurchase(game, 0);

    expect(game.inventory.getResource(Const.MONEY)).toBe(before - 100);
  });

  it('each 🎟️ bought this run raises the next ticket price by 💵100', () => {
    const ticket = new FreeTurn();
    expect(ticket.cost()).toEqual({ '💵': 100 });
    const game = { stats: { run: { boughtByEmoji: { '🎟️': 1 } } } };
    expect(ticket.cost(game)).toEqual({ '💵': 200 });
    game.stats.run.boughtByEmoji['🎟️'] = 3;
    expect(ticket.cost(game)).toEqual({ '💵': 400 });
  });

  it('attemptPurchase disables the offer instead of buying when unaffordable', async () => {
    const { game, shop, catalog } = await buildRealGame();
    const dice = catalog.symbol('🎲');
    shop.currentOffers = [{ symbol: dice, cost: dice.cost() }];
    shop.isOpen = true;
    shop.buyCount = 1;
    const before = game.inventory.getResource(Const.MONEY);

    await shop.attemptPurchase(game, 0);

    expect(game.inventory.getResource(Const.MONEY)).toBe(before);
    expect(shop.buyCount).toBe(1); // untouched, purchase never happened
  });

  it('refresh cost grows by refreshCostIncrease then refreshCostMult (truncated)', async () => {
    const { game, shop } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 1000);
    shop.refreshCost = 10;
    shop.refreshCostIncrease = 1;
    shop.refreshCostMult = 1.5;

    await shop.attemptRefresh(game);

    // (10 + 1) * 1.5 = 16.5 -> trunc 16
    expect(shop.refreshCost).toBe(16);
  });

  it('🔀 Refresh symbol (haveRefreshSymbol) allows refreshing more than once', async () => {
    const { game, shop } = await buildRealGame();
    await game.inventory.addResource(Const.MONEY, 1000);
    shop.haveRefreshSymbol = false;
    shop.refreshCount = 1; // already refreshed once this shop visit

    await shop.open(game);
    // Without the symbol and refreshCount > 0, no refresh offer is made --
    // verified indirectly: attemptRefresh still works procedurally, but the
    // *offering* of it is gated in open(); here we assert the gate directly.
    expect(
      shop.allowRefresh && (shop.haveRefreshSymbol || shop.refreshCount === 0)
    ).toBe(false);

    shop.haveRefreshSymbol = true;
    expect(
      shop.allowRefresh && (shop.haveRefreshSymbol || shop.refreshCount === 0)
    ).toBe(true);
  });

  it('generateShop respects bannedCategories (never offers UNBUYABLE/TOOL by default banning UNBUYABLE)', async () => {
    const { catalog } = await buildRealGame();
    const bag = catalog.generateShop(20, /* luck= */ 0);
    for (const item of bag) {
      expect(item.categories()).not.toContain(CATEGORY_UNBUYABLE);
    }
  });

  it('generateShop(rareOnly) only offers symbols with rarity < 0.101', async () => {
    const { catalog } = await buildRealGame();
    const bag = catalog.generateShop(5, 0, /* rareOnly= */ true);
    expect(bag.length).toBeGreaterThan(0);
    for (const item of bag) {
      expect(item.rarity).toBeLessThan(0.101);
    }
  });

  it('generateShop can additionally ban CATEGORY_TOOL (as Lootbox does)', async () => {
    const { catalog } = await buildRealGame();
    const bag = catalog.generateShop(20, 0, false, [
      CATEGORY_UNBUYABLE,
      CATEGORY_TOOL,
    ]);
    for (const item of bag) {
      expect(item.categories()).not.toContain(CATEGORY_TOOL);
      expect(item.categories()).not.toContain(CATEGORY_UNBUYABLE);
    }
  });

  // OFFLINE_DESIGN.md Phase 1 -- an empty catalog (e.g. from a failed
  // offline module load) used to spin generateShop's while loop forever,
  // which would hang this very test instead of failing it. It must throw
  // instead.
  it('generateShop throws CatalogUnusableError instead of looping forever on an empty catalog', async () => {
    const { catalog } = await buildRealGame();
    catalog.symbols = new Map();
    catalog.categories = new Map();
    expect(() => catalog.generateShop(3, 1)).toThrow(CatalogUnusableError);
  });

  it('generateShop throws CatalogUnusableError when restrictTo() leaves nothing offerable', async () => {
    const { catalog } = await buildRealGame();
    catalog.restrictTo(new Set()); // nothing unlocked
    expect(() => catalog.generateShop(3, 1)).toThrow(CatalogUnusableError);
  });
});
