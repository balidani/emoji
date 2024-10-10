import { chance, Symb, Empty, CATEGORY_UNBUYABLE } from '../symbol.js';
import * as Util from '../util.js';

export const CATEGORY_FOOD = Symbol('Food');
export const CATEGORY_FRUIT = Symbol('Fruit');

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

export class Wood extends Symb {
  static emoji = '🪵';
  constructor() {
    super();
    this.rarity = 0.55;
  }
  copy() {
    return new Wood();
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
    return "this is wood. it pays 💵1. i'm not sure what you expected.";
  }
}

export class Mountain extends Symb {
  static emoji = '⛰️';
  constructor() {
    super();
    this.rarity = 0.55;
  }
  copy() {
    return new Mountain();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return "this is a mountain. it pays 💵1. i'm not sure what you expected.";
  }
}

export class Beach extends Symb {
  static emoji = '🌊';
  constructor() {
    super();
    this.rarity = 0.55;
  }
  copy() {
    return new Beach();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return "this is water. it pays 💵1. i'm not sure what you expected.";
  }
}

export class Tree extends Symb {
  static emoji = '🌳';
  constructor() {
    super();
    this.rarity = 0.4;
    this.turns = 0;
  }
  copy() {
    return new Tree();
  }
  async evaluateProduce(game, x, y) {
    const grow = async () => {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomRemove(coords);
      const cherry = new Cherry();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, cherry, newX, newY);
    };

    if (this.turns % 3 === 0) {
      await grow();
      await grow();
    }
  }
  counter(_) {
    return 3 - (this.turns % 3);
  }
  description() {
    return 'every 3 turns: grows 🍒🍒';
  }
  descriptionLong() {
    return 'this is a tree. every 3 turns, it will grow up to two 🍒 on nearby empty space.';
  }
}

export class Cherry extends Symb {
  static emoji = '🍒';
  constructor() {
    super();
    this.rarity = 0.8;
  }
  copy() {
    return new Cherry();
  }
  async score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Cherry.emoji);
    if (coords.length === 0) {
      return;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, coords.length * 2, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_FOOD, CATEGORY_FRUIT];
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
  descriptionLong() {
    return 'this is a cherry. it pays 💵2 for each other 🍒 next to it.';
  }
}
