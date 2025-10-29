import * as Util from '../util.js';
import * as Const from '../consts.js';

import { chance, Symb } from '../symbol.js';
import { CATEGORY_FOOD } from './food.js';

// This file is for animal-related symbols.

export const CATEGORY_ANIMAL = Symbol('Animal');

export class Chick extends Symb {
  static emoji = '🐣';
  constructor(timeToGrow = 3) {
    super();
    this.timeToGrow = timeToGrow;
    this.rarity = 0.2;
    this.turns = 0;
  }
  copy() {
    return new Chick(this.timeToGrow);
  }
  async score(game, x, y) {
    await Util.animate(game.board.view.getSymbolDiv(x, y), 'bounce', 0.15);
    await this.addMoney(game, 1, x, y);
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToGrow) {
      await game.board.removeSymbol(game, x, y);
      const chicken = new Chicken();
      await game.board.addSymbol(game, chicken, x, y);
      await game.eventlog.showResourceEarned(chicken.emoji(), '', this.emoji());
    }
  }
  counter(_) {
    return 3 - this.turns;
  }
  description() {
    return '💵1<br>after 3 turns: becomes 🐔';
  }
  descriptionLong() {
    return 'this is a chick. it pays 💵1 and becomes 🐔 in 3 turns.';
  }
}

export class Chicken extends Symb {
  static emoji = '🐔';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() {
    return new Chicken();
  }
  async score(game, x, y) {
    await Util.animate(game.board.view.getSymbolDiv(x, y), 'bounce', 0.15);
    await this.addMoney(game, 8, x, y);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const eggCount = 1 + Util.random(4);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = Util.randomRemove(coords);
        const egg = new Egg();
        await Util.animate(game.board.view.getSymbolDiv(x, y), 'grow', 0.15);
        await game.board.addSymbol(game, egg, newX, newY);
        await game.eventlog.showResourceEarned(egg.emoji(), '', this.emoji());
      }
    }
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  description() {
    return '💵8<br>10% chance: lays up to 4 🥚';
  }
  descriptionLong() {
    return 'this is a chicken. it pays 💵8 and has a 10% chance of laying up to 4 🥚 on empty spaces around it.';
  }
}

export class Egg extends Symb {
  static emoji = '🥚';
  constructor() {
    super();
    this.rarity = 0.6;
    this.timeToHatch = 3 + Util.random(3);
  }
  copy() {
    return new Egg();
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToHatch) {
      let newSymbol = new Chick();
      if (chance(game, 0.01, x, y)) {
        newSymbol = new Dragon();
      }
      await game.board.removeSymbol(game, x, y);
      await game.board.addSymbol(game, newSymbol, x, y);
      await game.eventlog.showResourceEarned(newSymbol.emoji(), '', this.emoji());
    }
  }
  counter(_) {
    return this.timeToHatch - this.turns;
  }
  description() {
    return 'after 3-5 turns: hatches 🐣<br>1% chance: hatches 🐉';
  }
  descriptionLong() {
    return 'this is an egg. after 3-5 turns, it becomes a 🐣, or with 1% chance it becomes a 🐉.';
  }
}

export class Fox extends Symb {
  static emoji = '🦊';
  constructor() {
    super();
    this.rarity = 0.25;
    this.eatenScore = 10;
  }
  copy() {
    return new Fox();
  }
  async score(game, x, y) {
    if (this.eatenScore > 0) {
      await Util.animate(game.board.view.getSymbolDiv(x, y), 'bounce', 0.15);
      await this.addMoney(game, this.eatenScore, x, y);
      this.eatenScore = 10;
    }
  }
  async evaluateConsume(game, x, y) {
    const eatNeighbor = async (neighborClass, mult) => {
      const coords = game.board.nextToSymbol(x, y, neighborClass.emoji);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.eatenScore *= mult;
        const [deleteX, deleteY] = coord;
        await game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
      this.turns = 0;
      game.board.view.redrawCellDiv(game, x, y);
    };
    await eatNeighbor(Chick, 2);
    await eatNeighbor(Chicken, 3);
    if (this.turns >= 5) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  counter(_) {
    return 5 - this.turns;
  }
  description() {
    return '💵10<br>eats 🐔 for x3.<br>eats 🐣 for x2.<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a fox. it pays 💵10. it will eat 🐣 and 🐔 neighbors and pay x2 and x3 respectively. it disappears after 5 turns with no food.';
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
    await Util.animate(game.board.view.getSymbolDiv(x, y), 'bounce', 0.15);
    await this.addMoney(game, 42, x, y);
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
      await Util.animate(game.board.view.getSymbolDiv(x, y), 'bounce', 0.15);
      await this.addMoney(game, this.foodScore, x, y);
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
      game.board.view.redrawCellDiv(game, x, y);
      for (const coord of coords) {
        this.foodScore += 8;
        const [deleteX, deleteY] = coord;
        await game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
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
    return 'eats nearby food for 💵8 each.<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a bug. it will eat all edible neighbors and pay out 💵8 for each item eaten. it disappears after 5 turns with no food.';
  }
}
