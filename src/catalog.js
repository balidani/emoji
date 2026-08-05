import { CATEGORY_UNBUYABLE, Symb } from './symbol.js';
import * as Util from './util.js';

export class Catalog {
  constructor(symbolSources) {
    this.symbolSources = symbolSources || [];
  }
  async updateSymbols() {
    this.symbols = new Map();
    this.categories = new Map();
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
  // Prunes symbols/categories down to an unlocked set (Progression mode). A
  // plain Map delete pass -- no RNG, so it can run after updateSymbols()
  // without touching draw order. Sandbox calls updateSymbols() and stops, so
  // its full catalog (and the golden traces, which only exercise Sandbox)
  // are unaffected. CATEGORY_UNBUYABLE symbols are never buyable regardless
  // of `allowed`, so they're always kept.
  restrictTo(allowed) {
    for (const [emoji, sym] of this.symbols) {
      if (allowed.has(emoji) || sym.categories().includes(CATEGORY_UNBUYABLE)) {
        continue;
      }
      this.symbols.delete(emoji);
    }
    for (const [cat, emojis] of this.categories) {
      this.categories.set(
        cat,
        emojis.filter((e) => this.symbols.has(e))
      );
    }
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
    const checkCategory = (item) => {
      for (const cat of bannedCategories) {
        if (item.categories().includes(cat)) {
          return false;
        }
      }
      return true;
    };
    if (rareOnly) {
      for (const [_, item] of this.symbols) {
        if (!checkCategory(item)) {
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
        if (!checkCategory(item)) {
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
