import * as Const from '../consts.js';

import { Symb } from '../symbol.js';

// Symbols in this file have to do with reasearch upgrades.

export class Package extends Symb {
  static emoji = '📦';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 1 };
  }
  copy() {
    return new Package();
  }
  description() {
    return 'test';
  }
  onBuy(_) {}
}
