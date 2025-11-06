import * as Const from '../consts.js';
import * as Util from '../util.js';

import {
  badChance,
  chance,
  Symb,
  CATEGORY_UNBUYABLE,
} from '../symbol.js';
import {Empty} from './ui.js';
import {
  CATEGORY_TOOL
} from './tools.js';

// I am aware this is a bad name for the file. This file contains the "item" like emoji -
//    It's also a dumping ground for anything that's tested enough to put into production,
//    but otherwise lacks a fitting category

export class Balloon extends Symb {
  static emoji = '🎈';
  constructor() {
    super();
    this.rarity = 0.14;
  }
  copy() {
    return new Balloon();
  }
  async score(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15);
    await this.addMoney(game, 20, x, y);
  }
  async evaluateConsume(game, x, y) {
    if (badChance(game, 0.5, x, y)) {
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

export class Bomb extends Symb {
  static emoji = '💣';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  copy() {
    return new Bomb();
  }
  async evaluateConsume(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = game.board.nextToExpr(
        x,
        y,
        (sym) => ![Empty.emoji, Firefighter.emoji].includes(sym.emoji())
      );
      if (coords.length === 0) {
        return;
      }
      const coord = Util.randomChoose(coords);
      const [deleteX, deleteY] = coord;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.2, 3);
      await game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  description() {
    return '10% chance: destroys a neighbor';
  }
  descriptionLong() {
    return 'this is a bomb. there is a 10% chance it will destroy a neighboring symbol.';
  }
}

export class Firefighter extends Symb {
  static emoji = '🧑‍🚒';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  copy() {
    return new Firefighter();
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Bomb.emoji);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
    await game.board.removeSymbol(game, x, y);
  }
  description() {
    return 'disarms 💣, then leaves';
  }
  descriptionLong() {
    return 'this is an firefighter. if it stands to a 💣, it will remove the 💣 and leave your inventory.';
  }
}

export class Moon extends Symb {
  static emoji = '🌝';
  constructor(turns = 0) {
    super();
    this.rarity = 0.31;
    this.turns = turns;
  }
  copy() {
    return new Moon(this.turns);
  }
  async score(game, x, y) {
    if (this.turns >= 31) {
      this.turns = 0;
      game.board.redrawCell(game, x, y);
      await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.3);
      await this.addMoney(game, 600, x, y);
    }
    this.moonScore = 0;
  }
  counter(_) {
    return 31 - this.turns;
  }
  description() {
    return 'every 31 turns: 💵600';
  }
  descriptionLong() {
    return 'this is a moon. every 31 turns, it gives 💵600.';
  }
}

export class SewingKit extends Symb {
  static emoji = '🧵';
  constructor() {
    super();
    this.rarity = 0.08;
  }
  copy() {
    return new SewingKit();
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, '🕳️');
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji());
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  description() {
    return 'removes neighboring 🕳️';
  }
  descriptionLong() {
    return 'this is thread. it removes neighboring 🕳️.';
  }
}

export class Lootbox extends Symb {
  static emoji = '🎁';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() {
    return new Lootbox();
  }
  async evaluateProduce(game, x, y) {
    const rareOnly = chance(game, 0.2, x, y);
    const bag = game.catalog.generateShop(
      1,
      game.inventory.getResource(Const.LUCK),
      /* rareOnly= */ rareOnly,
      /* bannedCategories= */[CATEGORY_UNBUYABLE, CATEGORY_TOOL]);
    await game.board.removeSymbol(game, x, y);
    const sym = Util.randomChoose(bag);
    await game.eventlog.showResourceEarned(sym.emoji(), '', this.emoji());
    await game.board.addSymbol(game, sym, x, y);
    game.inventory.giftsOpened++;
  }
  description() {
    return "opens and turns into a random symbol. 20% chance: it's a rare.";
  }
  descriptionLong() {
    return "this is a lootbox. opens and turns into a random symbol. 20% chance: it's a rare.";
  }
}

export class Santa extends Symb {
  static emoji = Util.randomChoose(['🎅🏻', '🎅🏼', '🎅🏽', '🎅🏾', '🎅🏿']);
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new Santa();
  }
  counter(game) {
    return game.inventory.giftsOpened;
  }
  async score(game, x, y) {
    const value = 25 * game.inventory.giftsOpened;
    if (value > 0) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15);
      await this.addMoney(game, value, x, y);
    }
  }
  description() {
    return "💵25 for each 🎁 opened";
  }
  descriptionLong() {
    return "this is santa. it gives 💵25 for each 🎁 opened this run.";
  }
}

export class Cloud extends Symb {
  static emoji = '☁️';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Cloud();
  }
  description() {
    return '💵6 for each empty space';
  }
  descriptionLong() {
    return 'this is a cloud. it gives you 💵6 for each empty space on the board.';
  }
  async score(game, x, y) {
    const emptySpaces = game.board.forAllExpr(
      (e, _x, _y) => e.emoji() === Empty.emoji);
    if (emptySpaces.length > 0) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15);
      await this.addMoney(game, emptySpaces.length * 6, x, y);
    }
  }
}
