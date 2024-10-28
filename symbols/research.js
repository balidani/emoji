import * as Const from '../consts.js';

import { Symb } from '../symbol.js';

// Symbols in this file have to do with reasearch upgrades.

export class CasinoPackage extends Symb {
  static emoji = '📦';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new CasinoPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 1 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_CASINO);
  }
  description() {
    return 'contains 🐉🎰🎲.';
  }
}
