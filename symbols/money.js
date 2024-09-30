import { chance, Symb } from '../symbol.js';
import * as Util from '../util.js';

// Most symbols in here are related to Coin (🪙), with some gambling related stuff thrown in for good measure.

export const CATEGORY_GAMBLING = Symbol('Gambling');
export const CATEGORY_BUSINESS = Symbol('Business');

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
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value, x, y),
    ]);
  }
  catgories() {
    return [CATEGORY_BUSINESS];
  }
  counter(game) {
    return ((game.inventory.symbols.length / 4) | 0) * 5;
  }
  description() {
    return '💵5 for every 4 symbols in inventory';
  }
  descriptionLong() {
    return 'this is a briefcase. it pays 💵5 for every 4 symbols you have in your inventory.';
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
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
      await game.board.addSymbol(game, coin, newX, newY);
    };
    await mint();
  }
  catgories() {
    return [CATEGORY_BUSINESS];
  }
  description() {
    return 'every turn: makes 🪙';
  }
  descriptionLong() {
    return 'this is a bank. if there is empty space nearby, it will put 🪙 there.';
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
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15, 3),
      this.addMoney(game, -1100, x, y),
    ]);
  }
  async score(game, x, y) {
    this.turn += 1;
    if (this.turn === 1) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, 1000, x, y),
      ]);
    }
  }
  description() {
    return '💵1000 now<br>💵-1100 on last turn';
  }
  descriptionLong() {
    return "this is a credit card. it pays 💵1000, but takes 💵1100 on your last turn. if it's not on the board on your last turn, however ...";
  }
}

export class MoneyBag extends Symb {
  static emoji = '💰';
  constructor(coins = 0) {
    super();
    this.coins = coins;
    this.rarity = 0.5;
  }
  copy() {
    return new MoneyBag(this.coins);
  }
  async score(game, x, y) {
    if (this.coins > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.coins, x, y),
      ]);
    }
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Coin.emoji);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.coins += 2;
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
      game.board.redrawCell(game, x, y);
    }
  }
  counter(_) {
    return this.coins;
  }
  description() {
    return '💵2 for each 🪙 collected<br>collects neighboring 🪙';
  }
  descriptionLong() {
    return 'this is a money bag. it collects neighboring 🪙 and permanently gives 💵2 more for each 🪙 collected.';
  }
}

export class Slots extends Symb {
  static emoji = '🎰';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() {
    return new Slots();
  }
  async score(game, x, y) {
    const value = this.counter(game);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value, x, y),
    ]);
  }
  catgories() {
    return [CATEGORY_GAMBLING];
  }
  counter(game) {
    return new Set(game.inventory.symbols.map((s) => s.emoji())).size * 2;
  }
  description() {
    return '💵2 per different symbol in inventory';
  }
  descriptionLong() {
    return 'this is a slot machine. it pays 💵2 for all the different symbols in your inventory.';
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
  catgories() {
    return [CATEGORY_GAMBLING];
  }
  description() {
    return '1% chance: 💵52';
  }
  descriptionLong() {
    return 'this is a die. it has a 1% chance to pay 💵52.';
  }
}
