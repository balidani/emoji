import * as Const from '../consts.js';

import { Symb } from '../symbol.js';

// Symbols in this file have to do with reasearch upgrades.

export class ResearchPoint extends Symb {
  static emoji = '🧬';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  packs() {
    return [Const.PACK_BASE];
  }
  copy() {
    return new ResearchPoint();
  }
  async finalScore(game, _x, _y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15),
      game.inventory.addResource(Const.RESEARCH_POINT, 1),
    ]);
  }
  description() {
    return 'gain 🧬1 if you earn at least 🥉';
  }
  descriptionLong() {
    return 'this is a research token. you gain 🧬1 at the end of the game if you earn at least 🥉.';
  }
}

export class MoneyPackage extends Symb {
  static emoji = '🎩';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new MoneyPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 1 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_MONEY);
  }
  description() {
    return 'money bundle. contains 💰 🏦 💼 💳.';
  }
}

export class CasinoPackage extends Symb {
  static emoji = '🏮';
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
    return { '🧬': 2 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_CASINO);
  }
  description() {
    return 'casino bundle. contains 🐉 🎰 🎲.';
  }
}

export class MagicPackage extends Symb {
  static emoji = '🧙‍♂️';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new MagicPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 3 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_MAGIC);
  }
  description() {
    return 'magic bundle. contains 🪄 🕳️ 🧵.';
  }
}

export class LuckPackage extends Symb {
  static emoji = '🌠';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new LuckPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 2 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_LUCK);
  }
  description() {
    return 'lucky bundle. contains 🍀 🔮 🥠 🎯.';
  }
}

export class PartyPackage extends Symb {
  static emoji = '🎉';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new PartyPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 1 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_PARTY);
  }
  description() {
    return 'party bundle. contains 🍍 🍹 🍾 🎈.';
  }
}

export class MusicPackage extends Symb {
  static emoji = '🎼';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new MusicPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 2 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_MUSIC);
  }
  description() {
    return 'magic bundle. contains 📀 🔔 💃 🥁.';
  }
}

export class FactoryPackage extends Symb {
  static emoji = '🏭';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new FactoryPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 2 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_FACTORY);
  }
  description() {
    return 'factory bundle. contains 🚀 🧊.';
  }
}

export class ShoppingPackage extends Symb {
  static emoji = '🛒';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new ShoppingPackage();
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE, Const.CATEGORY_RESEARCH];
  }
  cost() {
    return { '🧬': 3 };
  }
  onBuy(game) {
    game.enabledPackages.add(Const.PACK_SHOP);
  }
  description() {
    return 'shopping bundle. contains 🔀 🛍️.';
  }
}
