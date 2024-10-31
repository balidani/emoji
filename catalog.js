import * as Const from './consts.js';
import * as Util from './util.js';

import { Symb } from './symbol.js';

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
  checkPacks(enabledPackages, item) {
    for (const pack of item.packs()) {
      if (enabledPackages.has(pack)) {
        return true;
      }
    }
    return false;
  }
  generateShop(enabledPackages, count, luck, rareOnly = false) {
    const bag = [];
    const checkItem = (item) => {
      if (!this.checkPacks(enabledPackages, item)) {
        return false;
      }
      if (item.categories().includes(Const.CATEGORY_UNBUYABLE)) {
        return false;
      }
      return true;
    };
    if (rareOnly) {
      for (const [_, item] of this.symbols) {
        if (!checkItem(item)) {
          continue;
        }
        if (item.rarity < 0.1) {
          bag.push(item.copy());
        }
      }
      return bag;
    }
    while (bag.length <= count) {
      for (const [_, item] of this.symbols) {
        if (!checkItem(item)) {
          continue;
        }
        if (Math.random() < item.rarity + luck / 100.0) {
          bag.push(item.copy());
        }
      }
    }
    return bag;
  }
  generateResearchShop(perksOwned, count = 3) {
    const bag = [];
    const unownedPerks = Array.from(
      this.categories.get(Const.CATEGORY_RESEARCH)
    ).filter((e) => !perksOwned.includes(e));
    if (unownedPerks.length === 0) {
      return [];
    }
    const checkItem = (item) => {
      if (!item.categories().includes(Const.CATEGORY_RESEARCH)) {
        return false;
      }
      if (Math.random() > item.rarity) {
        return false;
      }
      return !perksOwned.includes(item.emoji());
    };
    while (bag.length < count) {
      for (const [_, item] of this.symbols) {
        if (checkItem(item)) {
          bag.push(item.copy());
        }
      }
    }
    // Remove duplicates
    const seen = new Set();
    return bag.filter((item) => {
      if (seen.has(item.emoji())) {
        return false;
      }
      seen.add(item.emoji());
      return true;
    });
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
