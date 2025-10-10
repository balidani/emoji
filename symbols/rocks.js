import { chance, Symb } from '../symbol.js';
import * as Util from '../util.js';

// Symbols in this file have to do with either Rock (🪨) or Diamond (💎) generally.

export class Diamond extends Symb {
  static emoji = '💎';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Diamond();
  }
  async score(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15);
    await this.addMoney(game, 8, x, y);
    const coords = game.board.nextToSymbol(x, y, Diamond.emoji);
    if (coords.length === 0) {
      return;
    }
    await this.addMoney(game, coords.length * 8, x, y);
  }
  description() {
    return '💵8<br>💵8 for each neighboring 💎';
  }
  descriptionLong() {
    return 'this is a diamond. it pays 💵8 and 💵8 for each other 💎 next to it.';
  }
}

export class Rock extends Symb {
  static emoji = '🪨';
  constructor() {
    super();
    this.rarity = 0.55;
  }
  copy() {
    return new Rock();
  }
  async score(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
    await this.addMoney(game, 1, x, y);
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return "this is a rock. it pays 💵1.";
  }
}

export class Volcano extends Symb {
  static emoji = '🌋';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Volcano();
  }
  async evaluateProduce(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const newX = Util.random(game.settings.boardX);
      const newY = Util.random(game.settings.boardY);
      await game.board.removeSymbol(game, newX, newY);
      await game.board.addSymbol(game, game.catalog.symbol('🕳️'), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
    }
  }
  description() {
    return '10% chance: replaces random tile with 🪨x5';
  }
  descriptionLong() {
    return 'this is a volcano. it has a 10% chance to replace a random tile on the board with five 🪨.';
  }
}

export class Worker extends Symb {
  static emoji = '👷';
  constructor() {
    super();
    this.rarity = 0.45;
  }
  copy() {
    return new Worker();
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Rock.emoji);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
      if (chance(game, 0.5, x, y)) {
        await game.board.addSymbol(game, new Diamond(), deleteX, deleteY);
      }
    }
  }
  description() {
    return 'destroys neighboring 🪨 for 💵3<br>50% chance: produce 💎';
  }
  descriptionLong() {
    return 'this is a worker. it pays 💵3 for each neighboring 🪨 removed. it has a 50% chance to produce 💎 in place of the destroyed 🪨.';
  }
}
