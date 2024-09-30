import * as Util from './util.js';
import { Symb, Empty, chance } from './symbol.js';

export const CATEGORY_FOOD = Symbol('Food');
export const CATEGORY_FRUIT = Symbol('Fruit');
export const CATEGORY_VEGETABLES = Symbol('Vegetables');
export const CATEGORY_ANIMAL = Symbol('Animal');

/* Gameplay symbols. */

export class Balloon extends Symb {
  static emoji = '🎈';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Balloon();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y),
    ]);
  }
  async evaluateConsume(game, x, y) {
    if (chance(game, 0.5, x, y)) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  description() {
    return '💵20<br>50% chance: pop';
  }
  descriptionLong() {
    return 'this is a balloon. it gives you 💵20, but it has a 50% chance of popping and disappearing.';
  }
}

export class Butter extends Symb {
  static emoji = '🧈';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Butter();
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 7) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter() {
    return 7 - this.turns;
  }
  categories() {
    return [CATEGORY_FOOD];
  }
  description() {
    return 'x3 to neighboring 🍿<br>melts after 7 turns';
  }
  descriptionLong() {
    return 'this is butter. it triples the value of all neighboring 🍿. it disappears after 7 turns.';
  }
}

export class Bug extends Symb {
  static emoji = '🐛';
  constructor() {
    super();
    this.rarity = 0.3;
    this.foodScore = 0;
    this.timeToLive = 5;
  }
  copy() {
    return new Bug();
  }
  async score(game, x, y) {
    if (this.foodScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.foodScore, x, y),
      ]);
    }
    this.foodScore = 0;
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_FOOD);
    if (coords.length === 0) {
      if (this.turns >= 5) {
        await game.board.removeSymbol(game, x, y);
      }
    } else {
      this.turns = 0;
      game.board.updateCounter(game, x, y);
      for (const coord of coords) {
        this.foodScore += 8;
        const [deleteX, deleteY] = coord;
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
    }
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  counter(_) {
    return 5 - this.turns;
  }
  description() {
    return 'eats nearby food for 💵8 each<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a bug. it will eat all edible neighbors and pay out 💵8 for each item eaten. it disappears after 5 turns with no food.';
  }
}

export class BullsEye extends Symb {
  static emoji = '🎯';
  constructor() {
    super();
    this.rarity = 0.045;
  }
  copy() {
    return new BullsEye();
  }
  description() {
    return 'neighboring rolls always succeed';
  }
  descriptionLong() {
    return 'this is a bullseye. any neighboring symbol that has a chance of doing something will always succeed.';
  }
}

export class Clover extends Symb {
  static emoji = '🍀';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() {
    return new Clover();
  }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '+1% luck';
  }
  descriptionLong() {
    return 'this is a clover. it gives you luck. symbols having a chance to do something will succeed more. and you get rarer items to choose from in the shop.';
  }
  async score(game, x, y) {
    game.inventory.addLuck(0.01);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
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

export class Coin extends Symb {
  static emoji = '🪙';
  constructor() {
    super();
    this.rarity = 1;
  }
  copy() {
    return new Coin();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 2, x, y),
    ]);
  }
  description() {
    return '💵2';
  }
  descriptionLong() {
    return 'this is a coin. it pays 💵2.';
  }
}

export class Corn extends Symb {
  static emoji = '🌽';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() {
    return new Corn();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y),
    ]);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      for (let i = 0; i < coords.length; ++i) {
        const [newX, newY] = coords[i];
        const popcorn = new Popcorn();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
        await game.board.addSymbol(game, popcorn, newX, newY);
      }
    }
  }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '💵20<br>10% chance: pops 🍿';
  }
  descriptionLong() {
    return 'this is corn. it pays 💵20, and has a 10% chance to pop, making 🍿 on all empty space nearby.';
  }
}

export class Diamond extends Symb {
  static emoji = '💎';
  constructor() {
    super();
    this.rarity = 0.3;
  }
  copy() {
    return new Diamond();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y),
    ]);
    const coords = game.board.nextToSymbol(x, y, Diamond.emoji);
    if (coords.length === 0) {
      return;
    }
    await this.addMoney(game, coords.length * 5, x, y);
  }
  description() {
    return '💵6<br>💵5 for each neighboring 💎';
  }
  descriptionLong() {
    return 'this is a diamond. it pays 💵6 and 💵5 for each other 💎 next to it.';
  }
}

export class Dice extends Symb {
  static emoji = '🎲';
  constructor() {
    super();
    this.rarity = 0.14;
  }
  copy() {
    return new Dice();
  }
  async score(game, x, y) {
    if (chance(game, 0.01, x, y)) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2),
        this.addMoney(game, 52, x, y),
      ]);
    }
  }
  description() {
    return '1% chance: 💵52';
  }
  descriptionLong() {
    return 'this is a die. it has a 1% chance to pay 💵52.';
  }
}

export class Dragon extends Symb {
  static emoji = '🐉';
  constructor() {
    super();
    this.rarity = 0.01;
  }
  copy() {
    return new Dragon();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 42, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  description() {
    return '💵42';
  }
  descriptionLong() {
    return 'this is a mighty dragon. it pays 💵42.';
  }
}

export class Mango extends Symb {
  static emoji = '🥭';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() {
    return new Mango();
  }
  async evaluateScore(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_FRUIT);
    if (coords.length === 0) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  categories() {
    return [CATEGORY_FRUIT, CATEGORY_FOOD];
  }
  description() {
    return 'x2 to neighboring fruit';
  }
  descriptionLong() {
    return 'this is a mango. it makes nearby fruit give double 💵.';
  }
}

export class Pineapple extends Symb {
  static emoji = '🍍';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() {
    return new Pineapple();
  }
  async score(game, x, y) {
    const coords = game.board.nextToExpr(
      x,
      y,
      (sym) => sym.emoji() !== Empty.emoji
    );
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 12 - coords.length * 2, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_FRUIT, CATEGORY_FOOD];
  }
  description() {
    return '💵12<br>💵-2 for all non-empty neighbors';
  }
  descriptionLong() {
    return 'this is a pineapple. it pays 💵12, minus 💵2 for all neighboring symbols that are not empty.';
  }
}

export class Popcorn extends Symb {
  static emoji = '🍿';
  constructor() {
    super();
    this.rarity = 0;
    this.timeToLive = 2 + Util.random(4);
  }
  copy() {
    return new Popcorn();
  }
  async score(game, x, y) {
    const butter = game.board.nextToSymbol(x, y, Butter.emoji);
    let score = 17;
    for (const _ of butter) {
      score *= 3;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, score, x, y),
    ]);
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToLive) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter(_) {
    return this.timeToLive - this.turns;
  }
  categories() {
    return [CATEGORY_FOOD];
  }
  description() {
    return '💵17<br>disappears after 2-5 turns';
  }
  descriptionLong() {
    return 'this is popcorn. it pays 💵17 and disappears after 2-5 turns.';
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
