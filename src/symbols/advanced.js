import * as Const from '../consts.js';
import * as Util from '../util.js';

import { chance, Symb, CATEGORY_EMPTY_SPACE } from '../symbol.js';
import { Empty } from './ui.js';
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
      await game.view.animateCell(x, y, 'rotate', 0.15, 1);
      await game.board.addSymbol(game, newSymbol, newX, newY);
      await game.eventlog.logResourceChange(
        newSymbol.emoji(),
        '',
        this.emoji(),
        'earned'
      );
    }
  }
  description() {
    return '15% [Chance](chance) to [Duplicate](duplicate) a neighbor onto empty space';
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
    return '[Multiplier](multiplier): x2 to all neighbors, gains and losses. Stacks';
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
    game.shop.haveRefreshSymbol = true;
    game.shop.refreshCount = 0;
  }
  description() {
    return 'Lets you refresh the shop more than once';
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
    return 'Buy one extra item from the shop';
  }
}

export class PostBox extends Symb {
  static emoji = '📮';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() {
    return new PostBox();
  }
  async evaluateProduce(game, _, __) {
    game.shop.buyLines++;
  }
  description() {
    return 'Adds one more item to the shop';
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
    return 'Acts as permanent empty space';
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
    return '+1% [Luck](luck)';
  }
  async evaluateProduce(game, x, y) {
    game.inventory.addLuck(1);
    if (x === -1 || y === -1) {
      return;
    }
    await game.view.animateCell(x, y, 'bounce', 0.15);
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
    return '+3% [Luck](luck)';
  }
  async evaluateProduce(game, x, y) {
    game.inventory.addLuck(3);
    if (x === -1 || y === -1) {
      return;
    }
    await game.view.animateCell(x, y, 'bounce', 0.15);
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
    return '[Pays](pays) 💵5 for each point of [Luck](luck)';
  }
  async score(game, x, y) {
    const value = this.counter(game);
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, value, x, y);
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
    return 'Neighboring [Chance](chance) rolls always succeed';
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
    return 'Speeds up neighboring timers by 1 turn';
  }
}

export class Ice extends Symb {
  static emoji = '🧊';
  constructor() {
    super();
    this.rarity = 0.12;
  }
  copy() {
    return new Ice();
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToCoords(x, y);
    for (const cell of coords) {
      const [neighborX, neighborY] = cell;
      game.board.cells[neighborY][neighborX].turns--;
    }
  }
  description() {
    return 'Slows down neighboring timers by 1 turn';
  }
}

export class Rows extends Symb {
  static emoji = '🎰';
  constructor() {
    super();
    this.rarity = 0.03;
  }
  copy() {
    return new Rows();
  }
  description() {
    return 'Adds a row to the board';
  }
  async evaluateProduce(game, x, y) {
    game.inventory.rowCount += 1;
    if (x === -1 || y === -1) {
      return;
    }
    await game.view.animateCell(x, y, 'bounce', 0.15);
  }
}
