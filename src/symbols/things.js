import * as Const from '../consts.js';
import * as Util from '../util.js';

import { badChance, chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import { Empty } from './ui.js';
import { CATEGORY_TOOL } from './tools.js';

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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 20, x, y);
  }
  async evaluateConsume(game, x, y) {
    if (badChance(game, 0.5, x, y)) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  description() {
    return '[Pays](pays) 💵20. [Risk](risk) 50% [Chance](chance) to pop';
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
      await game.view.animateCell(deleteX, deleteY, 'shake', 0.2, 3);
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  description() {
    return '[Risk](risk) 10% [Chance](chance) to destroy a neighbor';
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
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
    await game.board.removeSymbol(game, x, y);
  }
  description() {
    return 'Disarms a neighboring 💣, then leaves';
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
      await game.view.animateCell(x, y, 'flip', 0.3);
      await this.addMoney(game, 600, x, y);
    }
    this.moonScore = 0;
  }
  counter(_) {
    return 31 - this.turns;
  }
  description() {
    return 'Every 31 turns: [Pays](pays) 💵600';
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
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  description() {
    return 'Removes neighboring 🕳️';
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
      /* bannedCategories= */ [CATEGORY_UNBUYABLE, CATEGORY_TOOL]
    );
    await game.board.removeSymbol(game, x, y);
    const sym = Util.randomChoose(bag);
    await game.eventlog.logResourceChange(
      sym.emoji(),
      '',
      this.emoji(),
      'earned'
    );
    await game.board.addSymbol(game, sym, x, y);
    game.inventory.giftsOpened++;
  }
  description() {
    return "[Transforms](transform) into a random symbol. 20% [Chance](chance) it's rare";
  }
}

export class Santa extends Symb {
  static emoji = '🧑‍🎄';
  // Cosmetic only -- never leaks into identity, see displayEmoji(). Set by
  // rollCosmetics() below, not drawn here: a static field initializer runs
  // once at module-evaluation time, which is at the mercy of the JS engine's
  // module cache (fine in a browser, wrong in a warm Lambda container or a
  // second Catalog build in the same tab -- see Catalog.rollCosmetics()'s
  // comment in catalog.js for the full story). This default is only ever
  // seen if something reads displayEmoji() before any Catalog has loaded
  // things.js, which shouldn't happen in practice.
  static displayVariant = '🎅🏻';
  // Catalog's cosmetic-reroll hook (catalog.js): called once per catalog
  // build normally, or once per build unconditionally when the caller needs
  // every build to look like an independent fresh page load (Daily
  // Challenge, both client and server -- see replay.js/bootstrap.js). Drawn
  // from the same seeded stream, in the same relative position (before any
  // gameplay draw), as the old import-time field -- so gameplay and every
  // rng: trace line are unaffected.
  static rollCosmetics() {
    Santa.displayVariant = Util.randomChoose(['🎅🏻', '🎅🏼', '🎅🏽', '🎅🏾', '🎅🏿']);
  }
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new Santa();
  }
  displayEmoji() {
    return Santa.displayVariant;
  }
  counter(game) {
    return game.inventory.giftsOpened;
  }
  async score(game, x, y) {
    const value = 25 * game.inventory.giftsOpened;
    if (value > 0) {
      await game.view.animateCell(x, y, 'bounce', 0.15);
      await this.addMoney(game, value, x, y);
    }
  }
  description() {
    return '[Pays](pays) 💵25 for each 🎁 opened this run';
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
    return '[Pays](pays) 💵6 for each empty space';
  }
  async score(game, x, y) {
    const emptySpaces = game.board.forAllExpr(
      (e, _, __) => e.emoji() === Empty.emoji
    );
    if (emptySpaces.length > 0) {
      await game.view.animateCell(x, y, 'bounce', 0.15);
      await this.addMoney(game, emptySpaces.length * 6, x, y);
    }
  }
}
