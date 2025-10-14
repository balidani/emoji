import * as Util from '../util.js';

import { chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import { Empty } from './ui.js';

// Symbols in this file are related to food, beverages, or ingredients

export const CATEGORY_FOOD = Symbol('Food');
export const CATEGORY_FRUIT = Symbol('Fruit');
export const CATEGORY_VEGETABLES = Symbol('Vegetables');

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
    return 'x4 to neighboring 🍿<br>melts after 5 turns';
  }
  descriptionLong() {
    return 'this is butter. it quadruples the value of all neighboring 🍿. it disappears after 7 turns.';
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
    await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15);
    await this.addMoney(game, coords.length * 2, x, y);
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

export class Corn extends Symb {
  static emoji = '🌽';
  constructor() {
    super();
    this.rarity = 0.2;
  }
  copy() {
    return new Corn();
  }
  async score(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
    await this.addMoney(game, 21, x, y);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.15, x, y)) {
      for (let i = 0; i < coords.length; ++i) {
        const [newX, newY] = coords[i];
        const popcorn = new Popcorn();
        await Util.animate(game.board.getSymbolDiv(x, y), 'grow', 0.15);
        await game.board.showResourceEarned(popcorn.emoji(), '', this.emoji());
        await game.board.addSymbol(game, popcorn, newX, newY);
      }
    }
  }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '💵21<br>15% chance: pops 🍿';
  }
  descriptionLong() {
    return 'this is corn. it pays 💵21, and has a 15% chance to pop, making 🍿 on all empty space nearby.';
  }
}

// export class Mango extends Symb {
//   static emoji = '🥭';
//   constructor() {
//     super();
//     this.rarity = 0.06;
//   }
//   copy() {
//     return new Mango();
//   }
//   async evaluateScore(game, x, y) {
//     const coords = game.board.nextToCategory(x, y, CATEGORY_FRUIT);
//     if (coords.length === 0) {
//       return;
//     }
//     await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
//     for (const coord of coords) {
//       const [neighborX, neighborY] = coord;
//       game.board.cells[neighborY][neighborX].multiplier *= 2;
//     }
//   }
//   categories() {
//     return [CATEGORY_FRUIT, CATEGORY_FOOD];
//   }
//   description() {
//     return 'x2 to neighboring fruit';
//   }
//   descriptionLong() {
//     return 'this is a mango. it makes nearby fruit give double 💵.';
//   }
// }

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
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
    await this.addMoney(game, 12 - coords.length * 2, x, y);
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
    this.timeToLive = 2 + Util.random(6);
  }
  copy() {
    return new Popcorn();
  }
  async score(game, x, y) {
    const butter = game.board.nextToSymbol(x, y, Butter.emoji);
    let score = 17;
    for (const _ of butter) {
      score *= 4;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
    await this.addMoney(game, score, x, y);
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
    return '💵17<br>disappears after 2-7 turns';
  }
  descriptionLong() {
    return 'this is popcorn. it pays 💵17 and disappears after 2-7 turns.';
  }
}

export class Bubble extends Symb {
  static emoji = '🫧';
  constructor() {
    super();
    this.rarity = 0;
  }
  copy() {
    return new Bubble();
  }
  async evaluateConsume(game, x, y) {
    if (this.turns < 3) {
      return;
    }
    await game.board.removeSymbol(game, x, y);
  }
  counter(_) {
    return 3 - this.turns;
  }
  description() {
    return 'disappears after 3 turns';
  }
  descriptionLong() {
    return "this is a bubble. it doesn't really do anything. it will disappear after 3 turns.";
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class Cocktail extends Symb {
  static emoji = '🍹';
  constructor(cherryScore = 0) {
    super();
    this.rarity = 0.27;
    this.cherryScore = cherryScore;
  }
  copy() {
    return new Cocktail(this.cherryScore);
  }
  async score(game, x, y) {
    if (this.cherryScore > 0) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
      await this.addMoney(game, this.cherryScore, x, y);
    }
  }
  async evaluateConsume(game, x, y) {
    const remove = async (sym, reward) => {
      const coords = game.board.nextToSymbol(x, y, sym.emoji);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.cherryScore = reward(this.cherryScore);
        const [deleteX, deleteY] = coord;
        await game.board.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
        await game.board.removeSymbol(game, deleteX, deleteY);
        game.board.redrawCell(game, x, y);
      }
    };
    await remove(Cherry, (v) => v + 2);
    await remove(Pineapple, (v) => v + 4);
    await remove(Champagne, (v) => (v * 1.5) | 0);
  }
  counter(_) {
    return this.cherryScore;
  }
  description() {
    return '💵2 per 🍒 removed.<br>💵4 per 🍍 removed.<br>x1.5 per 🍾 removed.';
  }
  descriptionLong() {
    return 'this is a cocktail. it permanently gives more 💵 by removing neighboring 🍒 (💵2), 🍍 (💵4) and 🍾 (x1.5).';
  }
}

export class Champagne extends Symb {
  static emoji = '🍾';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new Champagne();
  }
  async score(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
    await this.addMoney(game, 70, x, y);
  }
  async evaluateProduce(game, x, y) {
    if (x === -1 || y === -1) {
      return;
    }
    if (this.turns < 3) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
    await game.board.removeSymbol(game, x, y);
    const bubble = new Bubble();
    await game.board.addSymbol(game, bubble, x, y);
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    await game.board.showResourceEarned(bubble.emoji(), (coords.length + 1) + '', this.emoji());
    for (let i = 0; i < coords.length; ++i) {
      const [newX, newY] = coords[i];
      const bubble = new Bubble();
      await game.board.addSymbol(game, bubble, newX, newY);
    }
  }
  counter(_) {
    return 3 - this.turns;
  }
  description() {
    return '💵70<br>after 3 turns: explodes';
  }
  descriptionLong() {
    return 'this is a champagne. it pays 💵70, but explodes after 3 turns, making 🫧 on empty neighboring spaces and itself.';
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
      await Util.animate(game.board.getSymbolDiv(x, y), 'grow', 0.15);
      await game.board.showResourceEarned(cherry.emoji(), '', this.emoji());
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
