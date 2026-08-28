import { CATEGORY_UNBUYABLE, Symb } from './symbol.js';
import * as Util from './util.js';
import { CatalogUnusableError } from './catalog-errors.js';

export class Catalog {
  // forceCosmeticReroll (default false, preserves existing behavior
  // everywhere else): re-rolls every symbol class's cosmetics (see
  // rollCosmetics() below) on *every* call to updateSymbols(), even if this
  // process already rolled them once before.
  //
  // A handful of symbols carry a purely cosmetic, RNG-drawn trait that isn't
  // part of their gameplay identity (e.g. Santa's displayVariant skin-tone
  // glyph in symbols/things.js) but does consume a slot in the seeded
  // stream, so it must be drawn exactly once per canonical game build to
  // keep every later draw (shop generation, etc.) lined up. A symbol class
  // exposes this via a static `rollCosmetics()` method; loadSymbolSource()
  // below calls it at most once per class per process by default (matching
  // a browser tab, which only ever loads a symbol module once and reuses it
  // for every game in that tab), but Daily Challenge's validate Lambda and
  // its client-side "play another round" flow both need every catalog build
  // to look like an independent fresh page load -- see
  // src/replay.js/validateReplay() and src/app/bootstrap.js's loadSettings
  // -- so they pass forceCosmeticReroll: true to redraw on every build
  // regardless of what a previous build in this same process already
  // rolled.
  constructor(symbolSources, { forceCosmeticReroll = false } = {}) {
    this.symbolSources = symbolSources || [];
    this.forceCosmeticReroll = forceCosmeticReroll;
  }
  async updateSymbols() {
    this.symbols = new Map();
    this.categories = new Map();
    // null = unrestricted (Sandbox); see restrictTo().
    this.shopAllowed = null;
    this.symbolSources.unshift('./symbol.js'); // All symbol lists require this
    const allResults = await Promise.all(
      this.symbolSources.map((source) => this.loadSymbolSource(source))
    );
    for (const { newSymbols, newCategories } of allResults) {
      for (const [emoji, sym] of newSymbols) {
        this.symbols.set(emoji, sym);
      }
      for (const [cat, emojis] of newCategories) {
        const old = this.categories.get(cat) || [];
        this.categories.set(cat, old.concat(emojis));
      }
    }
  }
  async loadSymbolSource(source) {
    const newSymbols = new Map();
    const newCategories = new Map();

    try {
      // Plain, uncached-busted import: every symbol source is a normal,
      // process-wide-cached ES module, so a warm Lambda container (or a
      // second game in the same browser tab) pays for parsing/evaluating
      // these only once, not once per catalog build.
      let symModule = await import(source);
      for (const [_, value] of Object.entries(symModule)) {
        if (!(value.prototype instanceof Symb)) {
          continue;
        }

        if (
          typeof value.rollCosmetics === 'function' &&
          (this.forceCosmeticReroll || !value.__cosmeticsRolled)
        ) {
          value.rollCosmetics();
          value.__cosmeticsRolled = true;
        }

        let sym = new value();
        const emoji = sym.emoji();
        newSymbols.set(emoji, sym);

        let cats = sym.categories();
        if (cats.length > 0) {
          for (const cat of cats) {
            const old = newCategories.get(cat) || [];
            old.push(emoji);
            newCategories.set(cat, old);
          }
        }
      }
      return { newSymbols, newCategories };
    } catch (error) {
      console.error(`Failed to load module ${source} : ${error}`);
      return { newSymbols, newCategories };
    }
  }
  // Narrows the *buyable* pool to an unlocked set (Progression mode) --
  // generateShop() consults `shopAllowed` and won't offer anything outside
  // it. Deliberately does NOT touch `symbols`/`categories`: several symbols
  // spawn other symbols regardless of what's currently unlocked for
  // purchase -- some via `symbol()` directly (Wildcard's disguises,
  // interactive-emoji taps), others by constructing the class themselves
  // (Volcano's 🕳️) -- and those lookups, along with category membership
  // checks like nextToEmpty(), must keep working for every symbol that can
  // appear on the board, locked or not, under either style. No RNG, so it
  // can run after updateSymbols() without touching draw order. Sandbox
  // never calls this, so its full catalog (and the golden traces, which
  // only exercise Sandbox) are unaffected either way.
  restrictTo(allowed) {
    this.shopAllowed = allowed;
  }
  symbol(emoji) {
    const key = Util.normalizeSkinTone(emoji);
    if (this.symbols.has(key)) {
      return this.symbols.get(key).copy();
    }
    throw new Error('Unknown symbol: ' + emoji);
  }
  generateShop(
    minCount,
    luck,
    rareOnly = false,
    bannedCategories = [CATEGORY_UNBUYABLE]
  ) {
    const bag = [];
    const isOffered = (item) => {
      for (const cat of bannedCategories) {
        if (item.categories().includes(cat)) {
          return false;
        }
      }
      if (this.shopAllowed !== null && !this.shopAllowed.has(item.emoji())) {
        return false;
      }
      return true;
    };
    if (rareOnly) {
      for (const [_, item] of this.symbols) {
        if (!isOffered(item)) {
          continue;
        }
        if (item.rarity < 0.101) {
          bag.push(item.copy());
        }
      }
      return bag;
    }
    // isOffered() has no randomness, so if nothing in the catalog passes it,
    // no pass of the while loop below -- however many -- can ever add
    // anything either, and it would spin forever (e.g. an empty catalog from
    // a failed offline module load, or an over-narrow shopAllowed). A full
    // catalog always has offerable symbols, so this never fires on any
    // golden-trace path (Sandbox, unrestricted) and consumes no RNG draws.
    let anyOfferable = false;
    for (const [_, item] of this.symbols) {
      if (isOffered(item)) {
        anyOfferable = true;
        break;
      }
    }
    if (!anyOfferable) {
      throw new CatalogUnusableError(
        'generateShop: no symbols available to offer (empty or fully-restricted catalog)'
      );
    }
    while (bag.length <= minCount) {
      for (const [_, item] of this.symbols) {
        if (!isOffered(item)) {
          continue;
        }
        if (Util.randomFloat(/* shop= */ true) < item.rarity + luck / 100.0) {
          bag.push(item.copy());
        }
      }
    }
    return bag;
  }
  symbolsFromString(input) {
    const result = [];
    for (const emoji of Util.parseEmojiString(input)) {
      try {
        const sym = this.symbol(emoji);
        if (sym != null) {
          result.push(sym);
        }
      } catch (e) {
        console.error(e);
      }
    }
    return result;
  }
  test() {
    for (let [n, s] of this.symbols) {
      try {
        s.copy();
        s.description();
      } catch (e) {
        console.log(`error for ${n}: ${e}`);
      }
    }
  }
}
