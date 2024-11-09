import { Symb } from '../symbol.js';

export class Rock extends Symb {
  static emoji = '🪨';
  constructor() {
    super();
    this.rarity = 1.0;
  }
  copy() {
    return new Rock();
  }
  description() {
    return 'rock';
  }
}

export class Rice extends Symb {
  static emoji = '🌾';
  constructor() {
    super();
    this.rarity = 1.0;
  }
  copy() {
    return new Rice();
  }
  description() {
    return 'rice';
  }
}

export class Meat extends Symb {
  static emoji = '🍗';
  constructor() {
    super();
    this.rarity = 1.0;
  }
  copy() {
    return new Meat();
  }
  description() {
    return 'chicken meat';
  }
}

export class Chicken extends Symb {
  static emoji = '🐔';
  constructor() {
    super();
    this.rarity = 1.0;
  }
  copy() {
    return new Chicken();
  }
  description() {
    return 'chicken';
  }
  async evaluateConsume(game) {
    await game.inventory.add(game.catalog.symbol('🍗'));
    await game.inventory.add(game.catalog.symbol('🍗'));
  }
}
