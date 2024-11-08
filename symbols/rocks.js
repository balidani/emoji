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
    await game.inventory.addSymbols(game, '🍗', 2);
  }
  async evaluateProduce(game) {
    if (this.turns % 8 === 0) {
      await this.addResource(game, '🥚', 1);
    }
  }
}
