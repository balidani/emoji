import { CATEGORY_UNBUYABLE, Symb } from './symbol.js';
import * as Util from './util.js';

export class Catalog {
  constructor(symbolSources) {
    this.symbolSources = symbolSources || [];
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
      let symModule = await import(source);
      for (const [_, value] of Object.entries(symModule)) {
        if (!(value.prototype instanceof Symb)) {
          continue;
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
