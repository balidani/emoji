import * as Util from '../util.js';

import { chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import { Empty } from './ui.js';

// Symbols in this file are related to food, beverages, or ingredients

// Plain strings, not Symbol() -- see symbol.js's CATEGORY_EMPTY_SPACE
// comment for why: these are imported cross-file (animals.js, advanced.js).
export const CATEGORY_FOOD = 'category:Food';
export const CATEGORY_FRUIT = 'category:Fruit';
export const CATEGORY_VEGETABLES = 'category:Vegetables';

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
    return '[Multiplier](multiplier): x4 to neighboring 🍿. Melts after 7 turns';
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
    await game.view.animateCell(x, y, 'flip', 0.15);
    await this.addMoney(game, coords.length * 2, x, y);
  }
  categories() {
    return [CATEGORY_FOOD, CATEGORY_FRUIT];
  }
  description() {
    return '[Pays](pays) 💵2 for each neighboring 🍒';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
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
        await game.view.animateCell(x, y, 'grow', 0.15);
        await game.eventlog.logResourceChange(
          popcorn.emoji(),
          '',
          this.emoji(),
          'earned'
        );
        await game.board.addSymbol(game, popcorn, newX, newY);
      }
    }
  }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '[Pays](pays) 💵21. 15% [Chance](chance) to [Spawn](spawn) 🍿 on all empty neighbors';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 12 - coords.length * 2, x, y);
  }
  categories() {
    return [CATEGORY_FRUIT, CATEGORY_FOOD];
  }
  description() {
    return '[Pays](pays) 💵12, minus 💵2 per non-empty neighbor';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
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
    return '[Pays](pays) 💵17, x4 per neighboring 🧈. Disappears after 2-7 turns';
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
    return 'Does nothing. Disappears after 3 turns';
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
      await game.view.animateCell(x, y, 'bounce', 0.15);
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
        await game.eventlog.logResourceChange(
          game.board.getEmoji(deleteX, deleteY),
          '',
          this.emoji(),
          'lost'
        );
        await game.board.removeSymbol(game, deleteX, deleteY);
        game.board.redrawCell(game, x, y);
      }
    };
    await remove(Cherry, (v) => v + 2);
    await remove(Pineapple, (v) => v + 4);
    await remove(Champagne, (v) => Math.trunc(v * 1.5));
  }
  counter(_) {
    return this.cherryScore;
  }
  description() {
    return '[Consumes](consume) 🍒 (+💵2), 🍍 (+💵4) and 🍾 (x1.5), and [Stockpiles](stockpile) the value';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 70, x, y);
  }
  async evaluateProduce(game, x, y) {
    if (x === -1 || y === -1) {
      return;
    }
    if (this.turns < 3) {
      return;
    }
    await game.view.animateCell(x, y, 'shake', 0.15, 2);
    await game.board.removeSymbol(game, x, y);
    const bubble = new Bubble();
    await game.board.addSymbol(game, bubble, x, y);
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    await game.eventlog.logResourceChange(
      bubble.emoji(),
      coords.length + 1 + '',
      this.emoji(),
      'earned'
    );
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
    return '[Pays](pays) 💵70. After 3 turns: explodes, [Spawning](spawn) 🫧 on empty neighbors';
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
      await game.view.animateCell(x, y, 'grow', 0.15);
      await game.eventlog.logResourceChange(
        cherry.emoji(),
        '',
        this.emoji(),
        'earned'
      );
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
    return 'Every 3 turns: [Spawns](spawn) up to two 🍒 nearby';
  }
}
