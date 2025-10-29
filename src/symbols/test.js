import * as Util from '../util.js';

import { chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import { Empty } from './ui.js';

// Symbols in this file are related to food, beverages, or ingredients

export const CATEGORY_FOOD = Symbol('Food');
export const CATEGORY_FRUIT = Symbol('Fruit');
export const CATEGORY_VEGETABLES = Symbol('Vegetables');

export class Cherry extends Symb {
  static emoji = '🍒';
  constructor() {
    super();
    this.rarity = 0.8;
  }
  copy() {
    return new Cherry();
  }
  score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Cherry.emoji);
    if (coords.length === 0) {
      return [];
    }
    return [{type: 'board.animate', coords: {x, y}, animation: 'flip', duration: 0.15},
      ...this.addMoney(game, coords.length * 2, x, y)];
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

export class Pineapple extends Symb {
  static emoji = '🍍';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() {
    return new Pineapple();
  }
  score(game, x, y) {
    const coords = game.board.nextToExpr(
      x,
      y,
      (sym) => sym.emoji() !== Empty.emoji
    );
    return [{type: 'board.animate', coords: {x, y}, animation: 'bounce', duration: 0.15},
      ...this.addMoney(game, 12 - coords.length * 2, x, y)];
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
  score(game, x, y) {
    if (this.cherryScore <= 0) {
      return [];
    }
    return [{type: 'board.animate', coords: {x, y}, animation: 'bounce', duration: 0.15},
      ...this.addMoney(game, this.cherryScore, x, y)];
  }
  evaluateConsume(game, x, y) {
    const remove = (sym, reward) => {
      const coords = game.board.nextToSymbol(x, y, sym.emoji);
      if (coords.length === 0) {
        return [];
      }
      const effects = [];
      for (const coord of coords) {
        this.cherryScore = reward(this.cherryScore);
        const [deleteX, deleteY] = coord;
        effects.push(
          ...game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji())
        );
        effects.push(...game.board.removeSymbol(game, deleteX, deleteY));
      }
      return effects;
    };
    const effects = [];
    effects.push(...remove(Cherry, (v) => v + 2));
    effects.push(...remove(Pineapple, (v) => v + 4));
    effects.push(...remove(Champagne, (v) => Math.trunc(v * 1.5)));
    return effects;
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
  score(game, x, y) {
    return [{type: 'board.animate', coords: {x, y}, animation: 'bounce', duration: 0.15},
      ...this.addMoney(game, 70, x, y)];
  }
  evaluateProduce(game, x, y) {
    if (x === -1 || y === -1) {
      return [];
    }
    if (this.turns < 3) {
      return [];
    }
    // const bubble = new Bubble();
    const effects = [];
    // effects.push({type: 'board.animate', coords: {x, y}, animation: 'shake', duration: 0.15, repeat: 2});
    // effects.push(...game.board.removeSymbol(game, x, y));
    // effects.push(...game.board.addSymbol(game, bubble, x, y));
    // const coords = game.board.nextToEmpty(x, y);
    // if (coords.length === 0) {
    //   return effects;
    // }

    // effects.push(...game.eventlog.showResourceEarned(bubble.emoji(), (coords.length + 1) + '', this.emoji()));
    // for (let i = 0; i < coords.length; ++i) {
    //   const [newX, newY] = coords[i];
    //   const bubble = new Bubble();
    //   effects.push(...game.board.addSymbol(game, bubble, newX, newY));
    // }
    return effects;
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

export class Coin extends Symb {
  static emoji = '🪙';
  constructor() {
    super();
    this.rarity = 1;
  }
  copy() {
    return new Coin();
  }
  getValue(game) {
    // const activeCount = game.board.forAllExpr(
    //   (e, _x, _y) => e.emoji() === FlyingMoney.emoji).length;
    // const passiveCount = game.inventory.getResource(FlyingMoney.emoji);
    // return 2 + activeCount + passiveCount;
    return 2;
  }
  score(game, x, y) {
    return [{type: 'board.animate', coords: {x, y}, animation: 'bounce', duration: 0.15},
      ...this.addMoney(game, this.getValue(game), x, y)];
  }
  description() {
    return '💵2';
  }
  descriptionLong() {
    return 'this is a coin. it pays 💵2.';
  }
}

export class Refresh extends Symb {
  static emoji = '🔀';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() {
    return new Refresh();
  }
  evaluateProduce(game, _, __) {
    game.shop.haveRefreshSymbol = true;
    game.shop.refreshCount = 0;
    return [];
  }
  description() {
    return 'always allows refreshing the shop';
  }
  descriptionLong() {
    return 'this is a refresher. it allows refreshing the selection in the shop more than once. careful, the cost of refreshing also increases.';
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
    return 'this is a clover. it gives you luck. symbols having a chance to do something good will succeed more. rare items show up more frequently in the shop.';
  }
  evaluateProduce(game, x, y) {
    const effects = [...game.inventory.addLuck(1)];
    if (x === -1 || y === -1) {
      return effects;
    }
    effects.push({type: 'board.animate', coords: {x, y}, animation: 'bounce', duration: 0.15});
    return effects;
  }
}
