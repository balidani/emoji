import * as Util from '../util.js';

import { chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import { Effect } from '../Effect.js';
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
  score(ctx, x, y) {
    const coords = ctx.board.nextToSymbol(x, y, Cherry.emoji);
    if (coords.length === 0) {
      return Effect.none();
    }
    return Effect.serial(
      Effect.viewOf('board.animateCell').params({coords: {x, y}, animation: 'flip', duration: 0.2}),
      this.addMoney(ctx, coords.length * 2, x, y));
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
  score(ctx, x, y) {
    const neighbors = ctx.board.nextToExpr(x, y, (sym) => sym.emoji() !== Empty.emoji);
    const payout = 12 - neighbors.length * 2;
    return Effect.serial(
      Effect.viewOf('board.animateCell').params({ coords: { x, y }, animation: 'bounce', duration: 0.15 }),
      this.addMoney(ctx, payout, x, y)
    );
  }
  scorePassive(ctx) {
    return this.addMoneyPassive(ctx, 12);
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
  score(ctx, x, y) {
    if (this.cherryScore <= 0) {
      return Effect.none();
    }
    return Effect.serial({type: 'view', component: 'board.animateCell',
      params: {coords: {x, y}, animation: 'bounce', duration: 0.15}},
      this.addMoney(ctx, this.cherryScore, x, y));
  }
  scorePassive(ctx) {
    if (this.cherryScore <= 0) {
      return Effect.none();
    }
    return this.addMoneyPassive(ctx, this.cherryScore);
  }
  evaluateConsume(ctx, x, y) {
    const remove = (Sym, reward) => {
      const coords = ctx.board.nextToSymbol(x, y, Sym.emoji);
      if (coords.length === 0) {
        return [];
      }
      const effects = [];
      for (const [deleteX, deleteY] of coords) {
        this.cherryScore = reward(this.cherryScore);
        effects.push(Effect.modelOf('board.removeSymbol').params(
          { coords: { x: deleteX, y: deleteY }, symbol: ctx.board.getSymbol(deleteX, deleteY) }));
      }
      return effects;
    };
    const out = [];
    out.push(...remove(Cherry,     (v) => v + 2));
    out.push(...remove(Pineapple,  (v) => v + 4));
    out.push(...remove(Champagne,  (v) => Math.trunc(v * 1.5)));
    return Effect.serial(...out);
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
  score(ctx, x, y) {
    return Effect.serial(
      Effect.viewOf('board.animateCell').params({ coords: { x, y }, animation: 'bounce', duration: 0.15 }),
      this.addMoney(ctx, 70, x, y)
    );
  }
  scorePassive(ctx) {
    return this.addMoneyPassive(ctx, 70);
  }
  evaluateProduce(ctx, x, y) {
    // After 3 turns, explodes
    // TODO #REFACTOR
    return {};
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
  getValue(ctx) {
    // const activeCount = game.board.forAllExpr(
    //   (e, _x, _y) => e.emoji() === FlyingMoney.emoji).length;
    // const passiveCount = game.inventory.getResource(FlyingMoney.emoji);
    // return 2 + activeCount + passiveCount;
    return 2;
  }
  score(ctx, x, y) {
    return Effect.serial(
      Effect.viewOf('board.animateCell')
        .params({ coords: { x, y }, animation: 'bounce', duration: 0.15 }),
      this.addMoney(ctx, this.getValue(ctx), x, y)
    );
  }
  scorePassive(ctx) {
    return this.addMoneyPassive(ctx, this.getValue(ctx));
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
  description() {
    return 'always allows refreshing the shop';
  }
  descriptionLong() {
    return 'this is a refresher. it allows refreshing the selection in the shop more than once. careful, the cost of refreshing also increases.';
  }
  evaluateProduce(ctx, _, __) {
    return Effect.serial(
      Effect.modelOf('shop.allowRefresh').params({})
    );
  }
  evaluateProducePassive(ctx) {
    return Effect.serial(
      Effect.modelOf('shop.allowRefresh').params({})
    );
  }
}

export class Clover extends Symb {
  static emoji = '🍀';
  constructor() { 
    super();
    this.rarity = 0.21; }
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
  evaluateProduce(ctx, x, y) {
    if (x === -1 || y === -1) {
      // Passive row: just the model effect
      return Effect.serial(
        Effect.modelOf('inventory.addLuck').params({ luck: 1 })
      );
    }
    // Active board: add luck, then a small bounce on the cell
    return Effect.serial(
      Effect.modelOf('inventory.addLuck').params({ luck: 1 }),
      Effect.viewOf('board.animateCell').params({ coords: { x, y }, animation: 'bounce', duration: 0.15 })
    );
  }
  evaluateProducePassive(ctx) {
    return Effect.serial(
      Effect.modelOf('inventory.addLuck').params({ luck: 1 })
    );
  }
}
