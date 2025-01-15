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
    for (let source of this.symbolSources) {
      try {
        let symModule = await import(source);
        for (const [_, value] of Object.entries(symModule)) {
          if (!(value.prototype instanceof Symb)) {
            continue;
          }
          let sym = new value();
          this.symbols.set(sym.emoji(), sym);
          let cats = sym.categories();
          if (cats.length > 0) {
            for (const cat of cats) {
              const old = this.categories.get(cat) || [];
              old.push(sym.emoji());
              this.categories.set(cat, old);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to load module ${source} : ${error}`);
      }
    }
  }
  symbol(emoji) {
    if (this.symbols.has(emoji)) {
      return this.symbols.get(emoji).copy();
    }
    throw new Error('Unknown symbol: ' + emoji);
  }
  generateShop(minCount, luck, rareOnly = false) {
    const bag = [];
    if (rareOnly) {
      for (const [_, item] of this.symbols) {
        if (item.categories().includes(CATEGORY_UNBUYABLE)) {
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
        if (item.categories().includes(CATEGORY_UNBUYABLE)) {
          continue;
        }
        if (Util.randomFloat() < item.rarity + luck / 100.0) {
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
        s.descriptionLong();
      } catch (e) {
        console.log(`error for ${n}: ${e}`);
      }
    }
  }
}
