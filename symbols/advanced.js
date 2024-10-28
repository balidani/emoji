import * as Const from '../consts.js';
import * as Util from '../util.js';

import { chance, Symb, Empty, CATEGORY_EMPTY_SPACE } from '../symbol.js';
import { CATEGORY_ANIMAL } from './animals.js';
import { CATEGORY_FOOD, CATEGORY_VEGETABLES } from './food.js';

// The symbols in this file are mostly grouped by the fact that they manipulate the game itself rather than reward money

export class MagicWand extends Symb {
  static emoji = '🪄';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new MagicWand();
  }
  async evaluateProduce(game, x, y) {
    const emptyCoords = game.board.nextToEmpty(x, y);
    if (emptyCoords.length === 0) {
      return;
    }
    const nonEmptyCoords = game.board.nextToExpr(
      x,
      y,
      (sym) => sym.emoji() !== Empty.emoji
    );
    if (nonEmptyCoords.length === 0) {
      return;
    }
    if (chance(game, 0.15, x, y)) {
      const [copyX, copyY] = Util.randomChoose(nonEmptyCoords);
      const [newX, newY] = Util.randomChoose(emptyCoords);
      const newSymbol = game.board.cells[copyY][copyX].copy();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, newSymbol, newX, newY);
    }
  }
  description() {
    return '15% chance: duplicates neighboring symbol';
  }
  descriptionLong() {
    return 'this is a magic wand. it has a 15% chance to copy a neighboring symbol and place it on nearby empty space.';
  }
}

export class Multiplier extends Symb {
  static emoji = '❎';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new Multiplier();
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToExpr(
      x,
      y,
      (sym) => sym.emoji() !== Empty.emoji
    );
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  description() {
    return 'x2 to all neighbors';
  }
  descriptionLong() {
    return 'this is a multiplier. it doubles the 💵 gained (or lost) for all neighboring symbols.';
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
  async evaluateProduce(game, _, __) {
    game.shop.refreshable = true;
    game.shop.refreshCount = 0;
  }
  description() {
    return 'always allows refreshing the shop';
  }
  descriptionLong() {
    return 'this is a refresher. it allows refreshing the selection in the shop more than once. careful, the cost of refreshing also increases.';
  }
}

export class ShoppingBag extends Symb {
  static emoji = '🛍️';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new ShoppingBag();
  }
  async evaluateProduce(game, _, __) {
    game.shop.buyCount++;
  }
  description() {
    return 'allows picking 1 more item';
  }
  descriptionLong() {
    return 'these are shopping bags. you can choose one more item to buy from the shop.';
  }
}

export class Hole extends Symb {
  static emoji = '🕳️';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() {
    return new Hole();
  }
  description() {
    return 'always empty';
  }
  descriptionLong() {
    return 'this is a hole. it works like an empty space, other symbols can be created here and they will go into your inventory.';
  }
  categories() {
    return [CATEGORY_EMPTY_SPACE];
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
  async score(game, x, y) {
    game.inventory.addLuck(1);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
  }
}

export class CrystalBall extends Symb {
  static emoji = '🔮';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() {
    return new CrystalBall();
  }
  description() {
    return '+3% luck';
  }
  descriptionLong() {
    return 'this is a crystal ball. it gives you luck. symbols having a chance to do something good will succeed more. rare items show up more frequently in the shop.';
  }
  async score(game, x, y) {
    game.inventory.addLuck(3);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
  }
}

export class FortuneCookie extends Symb {
  static emoji = '🥠';
  constructor() {
    super();
    this.rarity = 0.11;
  }
  copy() {
    return new FortuneCookie();
  }
  counter(game) {
    return game.inventory.getResource(Const.LUCK) * 5;
  }
  categories() {
    return [CATEGORY_FOOD];
  }
  description() {
    return '💵5 for each point of luck you have';
  }
  descriptionLong() {
    return 'this is a fortune cookie. it pays 💵5 for each percent of luck you have.';
  }
  async score(game, x, y) {
    const value = this.counter(game);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value, x, y),
    ]);
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

export class Rocket extends Symb {
  static emoji = '🚀';
  constructor() {
    super();
    this.rarity = 0.18;
  }
  copy() {
    return new Rocket();
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToCoords(x, y);
    for (const cell of coords) {
      const [neighborX, neighborY] = cell;
      game.board.cells[neighborY][neighborX].turns++;
    }
  }
  description() {
    return 'speeds up neighbors by 1 turn';
  }
  descriptionLong() {
    return 'this is a rocket. all neighboring symbols that have a timer will complete one turn faster.';
  }
}

// This one is questionable if it belongs in animal or advanced. It's here because Rocket is, and they form a paired set.
export class Snail extends Symb {
  static emoji = '🐌';
  constructor() {
    super();
    this.rarity = 0.12;
  }
  copy() {
    return new Snail();
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToCoords(x, y);
    for (const cell of coords) {
      const [neighborX, neighborY] = cell;
      game.board.cells[neighborY][neighborX].turns--;
    }
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  description() {
    return 'slows down neighbors by 1 turn';
  }
  descriptionLong() {
    return 'this is a snail. all neighboring symbols that have a timer will take one more turn to complete.';
  }
}
