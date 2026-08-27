import * as Util from '../util.js';

import { badChance, Symb } from '../symbol.js';

// Most symbols in here are related to Coin (🪙), with some gambling related stuff thrown in for good measure.

// Plain strings, not Symbol() -- see symbol.js's CATEGORY_EMPTY_SPACE
// comment for why.
export const CATEGORY_GAMBLING = 'category:Gambling';
export const CATEGORY_BUSINESS = 'category:Business';

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
    const activeCount = game.board.forAllExpr(
      (e, _, __) => e.emoji() === FlyingMoney.emoji
    ).length;
    const passiveCount = game.inventory.getResource(FlyingMoney.emoji);
    return 2 + activeCount + passiveCount;
  }
  async score(game, x, y) {
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, this.getValue(game), x, y);
  }
  description() {
    return '[Pays](pays) 💵2. Each 💸 you own adds 💵1';
  }
}

export class Briefcase extends Symb {
  static emoji = '💼';
  constructor() {
    super();
    this.rarity = 0.13;
    this.count = 0;
  }
  copy() {
    return new Briefcase();
  }
  async score(game, x, y) {
    const value = this.counter(game);
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, value, x, y);
  }
  catgories() {
    return [CATEGORY_BUSINESS];
  }
  counter(game) {
    return Math.trunc(game.inventory.symbols.length / 4) * 5;
  }
  description() {
    return '[Pays](pays) 💵5 for every 4 symbols in your inventory';
  }
}

export class Bank extends Symb {
  static emoji = '🏦';
  constructor() {
    super();
    this.turns = 0;
    this.rarity = 0.4;
  }
  copy() {
    return new Bank();
  }
  async evaluateProduce(game, x, y) {
    const mint = async () => {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const coin = new Coin();
      const [newX, newY] = Util.randomChoose(coords);
      await game.view.animateCell(x, y, 'grow', 0.15);
      await game.eventlog.logResourceChange(
        coin.emoji(),
        '',
        this.emoji(),
        'earned'
      );
      await game.board.addSymbol(game, coin, newX, newY);
    };
    await mint();
  }
  catgories() {
    return [CATEGORY_BUSINESS];
  }
  description() {
    return 'Every turn: [Spawns](spawn) a 🪙 on empty space';
  }
}

export class CreditCard extends Symb {
  static emoji = '💳';
  constructor(turn = 0) {
    super();
    this.turn = turn;
    this.rarity = 0.35;
  }
  copy() {
    return new CreditCard();
  }
  async finalScore(game, x, y) {
    await game.view.animateCell(x, y, 'flip', 0.15, 3);
    await this.addMoney(game, -1100, x, y);
  }
  async score(game, x, y) {
    this.turn += 1;
    if (this.turn === 1) {
      await game.view.animateCell(x, y, 'bounce', 0.15);
      await this.addMoney(game, 1000, x, y);
    }
  }
  description() {
    return '[Pays](pays) 💵1000 now. [Risk](risk) loses 💵1100 on your last turn';
  }
}

export class MoneyBag extends Symb {
  static emoji = '💰';
  constructor(coins = 0) {
    super();
    this.coins = coins;
    this.rarity = 0.5;
    this.coin = new Coin(); // Used to calculate current coin value.
  }
  copy() {
    return new MoneyBag(this.coins);
  }
  async score(game, x, y) {
    if (this.coins > 0) {
      const value = this.coins * this.coin.getValue(game);
      await game.view.animateCell(x, y, 'bounce', 0.15);
      await this.addMoney(game, value, x, y);
    }
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Coin.emoji);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.coins++;
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
  }
  counter(_) {
    return this.coins;
  }
  description() {
    return '[Consumes](consume) neighboring 🪙 and [Stockpiles](stockpile) them into a bigger payout';
  }
}

export class Jar extends Symb {
  static emoji = '🫙';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() {
    return new Jar();
  }
  async score(game, x, y) {
    const value = this.counter(game) * 8;
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, value, x, y);
  }
  categories() {
    return [CATEGORY_GAMBLING];
  }
  counter(game) {
    return new Set(game.inventory.symbols.map((s) => s.emoji())).size;
  }
  description() {
    return '[Pays](pays) 💵8 for each different symbol in your inventory';
  }
}

export class Dice extends Symb {
  static emoji = '🎲';
  constructor() {
    super();
    this.rarity = 0.11;
  }
  copy() {
    return new Dice();
  }
  cost() {
    return { '💵': 77 };
  }
  async score(game, x, y) {
    if (badChance(game, 0.8, x, y)) {
      await game.view.animateCell(x, y, 'shake', 0.15, 2);
      await this.addMoney(game, -123, x, y);
    } else {
      await game.view.animateCell(x, y, 'bounce', 0.15, 3);
      await this.addMoney(game, 456, x, y);
    }
  }
  categories() {
    return [CATEGORY_GAMBLING];
  }
  description() {
    return '20% [Chance](chance) to [Pay](pays) 💵456. [Risk](risk) 80% to [Pay](pays) 💵-123';
  }
}

export class FlyingMoney extends Symb {
  static emoji = '💸';
  constructor() {
    super();
    this.rarity = 0.12;
  }
  copy() {
    return new FlyingMoney();
  }
  description() {
    return 'Each 🪙 you own [Pays](pays) 💵1 more';
  }
}

export class Gambler extends Symb {
  static emoji = '🤑';
  constructor() {
    super();
    this.rarity = 0;
  }
  copy() {
    return new Gambler();
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, '💳');
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
      await this.addMoney(game, -500, x, y);
    }
  }
  async evaluateProduce(game, x, y) {
    game.inventory.addLuck(-1);
    const coords = game.board.nextToSymbol(x, y, '🎲');
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 3;
    }
  }
  categories() {
    return [CATEGORY_GAMBLING];
  }
  description() {
    return '-1% [Luck](luck). x3 [Multiplier](multiplier) to neighboring 🎲. [Consumes](consume) neighboring 💳 for 💵-500';
  }
}
