import { badChance, CATEGORY_UNBUYABLE, chance, Symb } from '../symbol.js';
import * as Util from '../util.js';

export const CATEGORY_ENEMY = Symbol('Enemy');

export class Rock extends Symb {
  static emoji = '🪨';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new Rock();
  }
  description() {
    return 'this is a rock';
  }
}

export class FortuneCookie extends Symb {
  static emoji = '🥠';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  cost() {
    return { '💵': 1 };
  }
  copy() {
    return new FortuneCookie();
  }
  description() {
    return 'this is a fortune cookie. it gives you 🍀3. symbols having a chance to do something good will succeed more. symbols having a chance to do something bad will succeed less. and you get rarer items to choose from in the shop.';
  }
  async score(game) {
    game.inventory.addLuck(3);
  }
}

export class Tree extends Symb {
  static emoji = '🌲';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() {
    return new Tree();
  }
  description() {
    return 'this is a tree.';
  }
}

export class Axe extends Symb {
  static emoji = '🪓';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  cost() {
    return { '💵': 3, '🔩': 1 };
  }
  copy() {
    return new Axe();
  }
  description() {
    return 'this is an axe. converts 🌲 to 🪵3.';
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, '🌲');
    if (coords.length === 0) {
      return;
    }
    for (const [rockX, rockY] of coords) {
      await game.board.removeSymbol(game, rockX, rockY);
      await game.inventory.addResource('🪵', 3);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.2, 1);
    }
  }
}

export class Dagger extends Symb {
  static emoji = '🗡️';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  cost() {
    return { '💵': 2, '🔩': 2 };
  }
  copy() {
    return new Dagger();
  }
  description() {
    return 'this is a dagger. deals 🫀1 damage to all enemies nearby.';
  }
  async score(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_ENEMY);
    if (coords.length === 0) {
      return;
    }
    for (const [enemyX, enemyY] of coords) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1, 2);
      game.board.cells[enemyY][enemyX].hp -= 1;
      await Util.animate(
        game.board.getSymbolDiv(enemyX, enemyY),
        'shake',
        0.1,
        2
      );
      game.board.redrawCell(game, enemyX, enemyY);
    }
  }
}

export class Bow extends Symb {
  static emoji = '🏹';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  cost() {
    return { '💵': 2, '🪵': 2 };
  }
  copy() {
    return new Bow();
  }
  description() {
    return 'this is a bow. 10% chance: deals 🫀3 damage to a random enemy.';
  }
  async score(game, x, y) {
    const coords = game.board.findCategory(CATEGORY_ENEMY);
    if (coords.length === 0) {
      return;
    }
    if (!chance(game, 0.1, x, y)) {
      return;
    }
    const [enemyX, enemyY] = Util.randomChoose(coords);
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1, 2);
    game.board.cells[enemyY][enemyX].hp -= 3;
    await Util.animate(
      game.board.getSymbolDiv(enemyX, enemyY),
      'shake',
      0.1,
      2
    );
    game.board.redrawCell(game, enemyX, enemyY);
  }
}

export class Storm extends Symb {
  static emoji = '⛈️';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() {
    return new Storm();
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  description() {
    return 'this is a storm. 10% chance to hurt you for 🫀1.';
  }
  async score(game, x, y) {
    // Luck logic reversed for bad things
    if (badChance(game, 0.1, x, y)) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      game.inventory.addResource('🫀', -1);
    }
  }
}

export class Bank extends Symb {
  static emoji = '🏦';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  cost() {
    return { '💵': 3 };
  }
  copy() {
    return new Bank();
  }
  description() {
    return 'this is a bank. generate 💵1.';
  }
  async evaluateProduce(game, x, y) {
    await game.inventory.addResource('💵', 1);
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.2, 1);
  }
}

export class Factory extends Symb {
  static emoji = '🏭';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  cost() {
    return { '💵': 3 };
  }
  copy() {
    return new Factory();
  }
  description() {
    return 'this is a factory. converts 🪨 to 🔩.';
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, '🪨');
    if (coords.length === 0) {
      return;
    }
    for (const [rockX, rockY] of coords) {
      await game.board.removeSymbol(game, rockX, rockY);
      await game.inventory.addResource('🔩', 1);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.2, 1);
    }
  }
}

export class Rocket extends Symb {
  static emoji = '🚀';
  constructor() {
    super();
    this.rarity = 0.25;
    this.charges = 3;
  }
  copy() {
    return new Rocket();
  }
  cost() {
    return { '🔩': 3 };
  }
  counter() {
    return this.charges;
  }
  description() {
    return 'this is a rocket. destroys all neighboring storms. 3 charges.';
  }
  async evaluateConsume(game, x, y) {
    if (this.charges === 0) {
      return;
    }

    const coords = game.board.nextToSymbol(x, y, '⛈️');
    for (const [deleteX, deleteY] of coords) {
      if (this.charges > 0) {
        this.charges--;
        game.board.redrawCell(game, x, y);
        await Util.animate(
          game.board.getSymbolDiv(x, y),
          'shakeRocket',
          0.1,
          3
        );
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
    }
    // Luck logic reversed for bad things
    if (badChance(game, 0.1, x, y)) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      game.inventory.addResource('🫀', -1);
    }
  }
}

export class Mage extends Symb {
  static emoji = '🧙‍♂️';
  constructor(hp = 100) {
    super();
    this.rarity = 0;
    this.hp = hp;
  }
  copy() {
    return new Mage(this.hp);
  }
  categories() {
    return [CATEGORY_UNBUYABLE, CATEGORY_ENEMY];
  }
  async evaluateProduce(game, x, y) {
    if (badChance(game, 0.25, x, y)) {
      // Empties
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomRemove(coords);
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1, 2),
        await game.board.addSymbol(game, new Storm(), newX, newY);
    }
  }
  counter() {
    return this.hp;
  }
  description() {
    return this.descriptionLong();
  }
  descriptionLong() {
    return "this is the grand mage. he's a bit of a jerk.";
  }
}
