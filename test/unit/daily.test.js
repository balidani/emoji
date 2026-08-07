// @vitest-environment jsdom
//
// Ticket-exclusion coverage for Daily Challenge (DAILY_CHALLENGE_DESIGN.md
// #5): the shop, 🎁 Gift, and 🃏 Joker all draw offers through
// Catalog.generateShop()'s isOffered() gate, so restricting shopAllowed via
// dailyAllowedEmoji() is claimed to cover all three spawn vectors with one
// lever. This exercises generateShop() directly in both its modes (the
// normal shop-fill loop Gift also uses, and the rareOnly branch Gift's rare
// pick also uses), rather than standing up a full Board/Lootbox, since both
// paths funnel through the same isOffered() check catalog.js defines.
import { describe, it, expect, beforeEach } from 'vitest';

import * as Rng from '../../src/core/rng.js';
import { Catalog } from '../../src/catalog.js';
import { JOKER_DISGUISES } from '../../src/symbols/wildcard.js';
import { FreeTurn } from '../../src/extra-symbols/beta.js';
import {
  DAILY_EXCLUDED,
  dailyAllowedEmoji,
  DAILY_SETTINGS,
} from '../../src/daily.js';

describe('Daily Challenge ticket exclusion', () => {
  let catalog;

  beforeEach(async () => {
    await Rng.setSeed('daily-ticket-exclusion');
    catalog = new Catalog([...DAILY_SETTINGS.symbolSources]);
    await catalog.updateSymbols();
  });

  it('excludes exactly the Free Turn ticket from the allowed set', () => {
    expect(DAILY_EXCLUDED.has(FreeTurn.emoji)).toBe(true);
    const allowed = dailyAllowedEmoji(catalog);
    expect(allowed.has(FreeTurn.emoji)).toBe(false);
    // Nothing else was accidentally dropped.
    expect(allowed.size).toBe(catalog.symbols.size - DAILY_EXCLUDED.size);
    for (const emoji of catalog.symbols.keys()) {
      if (!DAILY_EXCLUDED.has(emoji)) {
        expect(allowed.has(emoji)).toBe(true);
      }
    }
  });

  it('never offers the ticket in the shop once restricted', () => {
    catalog.restrictTo(dailyAllowedEmoji(catalog));
    // Several passes, matching the design doc's own spike methodology --
    // generateShop's while loop draws until it has more than minCount
    // offers, so repeated calls exercise many RNG draws against the
    // restricted pool.
    for (let i = 0; i < 20; i++) {
      const shop = catalog.generateShop(/* minCount= */ 5, /* luck= */ 0);
      expect(shop.some((s) => s.emoji() === FreeTurn.emoji)).toBe(false);
    }
  });

  it('never offers the ticket via the rareOnly pool 🎁 Gift also draws from', () => {
    catalog.restrictTo(dailyAllowedEmoji(catalog));
    const rareShop = catalog.generateShop(
      /* minCount= */ 0,
      /* luck= */ 0,
      /* rareOnly= */ true
    );
    expect(rareShop.some((s) => s.emoji() === FreeTurn.emoji)).toBe(false);
  });

  it('still resolves the ticket by lookup outside the shop (restrictTo narrows offers, not existence)', () => {
    catalog.restrictTo(dailyAllowedEmoji(catalog));
    expect(() => catalog.symbol(FreeTurn.emoji)).not.toThrow();
  });

  // Defense-in-depth (DAILY_CHALLENGE_DESIGN.md #5): if the ticket is ever
  // added to Wildcard's disguise pool, a Joker could roll it directly via
  // catalog.symbol() -- bypassing generateShop()'s isOffered() gate
  // entirely, since rollDisguise() looks symbols up by emoji, not by
  // drawing from the restricted shop. This trips a red test instead of
  // silently leaking a ticket into Daily Challenge through that path.
  it('keeps the ticket out of the frozen Joker disguise pool', () => {
    const overlap = JOKER_DISGUISES.filter((emoji) =>
      DAILY_EXCLUDED.has(emoji)
    );
    expect(overlap).toEqual([]);
  });
});
