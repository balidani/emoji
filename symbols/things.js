import * as Const from '../consts.js';
import * as Util from '../util.js';

import {
  badChance,
  chance,
  Symb,
  Empty,
  CATEGORY_UNBUYABLE,
} from '../symbol.js';

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
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y),
    ]);
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
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.3),
        this.addMoney(game, 600, x, y),
      ]);
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
    this.rarity = 0.1;
  }
  copy() {
    return new Lootbox();
  }
  async evaluateProduce(game, x, y) {
    const rareOnly = chance(game, 0.2, x, y);
    const bag = game.catalog.generateShop(
      1,
      game.inventory.getResource(Const.LUCK),
      /* rareOnly= */ rareOnly);
    await game.board.removeSymbol(game, x, y);
    await game.board.addSymbol(game, Util.randomChoose(bag), x, y);
  }
  description() {
    return "opens and turns into a random symbol. 20% chance: it's a rare.";
  }
  descriptionLong() {
    return "this is a lootbox. opens and turns into a random symbol. 20% chance: it's a rare.";
  }
}
