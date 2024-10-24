import { chance, Symb } from '../symbol.js';
import * as Util from '../util.js';

export class Rock extends Symb {
  static emoji = '🪨';
  constructor() {
    super();
    this.rarity = 0.55;
  }
  copy() {
    return new Rock();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y),
    ]);
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return "this is a rock. it pays 💵1. i'm not sure what you expected.";
  }
}

export class Wizard extends Symb {
  static emoji = '🧙‍♂️';
  constructor(hp = 100) {
    super();
    this.rarity = -1000;
    this.hp = hp;
  }
  copy() {
    return new Wizard(this.hp);
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      // this.addMoney(game, 1, x, y),
    ]);
  }
  counter() {
    return this.hp;
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return "this is a rock. it pays 💵1. i'm not sure what you expected.";
  }
}
