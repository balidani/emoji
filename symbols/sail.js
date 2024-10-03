

// ...


import { chance, Symb } from '../symbol.js';
import * as Util from '../util.js';

export class Sailboat extends Symb {
  static emoji = '⛵';
  constructor() {
    super();
    this.rarity = 0.3;
  }
  copy() {
    return new Sailboat();
  }

  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y),
    ]);
  }
  description() {
    return 'The sailboat moves forward and collects rewards.';
  }
  descriptionLong() { return this.description(); }
}

export class Wave extends Symb {
  static emoji = '🌊';
  constructor() {
    super();
    this.rarity = 0.2;
  }
  copy() {
    return new Wave();
  }
  async score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, '⛵');
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [boatX, boatY] = coord;
      // Animate flipping the boat 
      await Util.animate(game.board.getSymbolDiv(boatX, boatY), 'flip', 0.15);
      game.inventory.addTurn(-1);
    }
  }
  description() {
    return 'this is a wave. if it touches the boat, lose 1⏰';
  }
  descriptionLong() { return this.description(); }
}

export class Storm extends Symb {
  static emoji = '🌩️';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Storm();
  }
  description() {
    return 'this is a storm. if it touches the boat, 10% chance that the boat sinks.';
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Sailboat.emoji);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const [boatX, boatY] = Util.randomRemove(coords);
      await game.board.removeSymbol(game, boatX, boatY);
      await game.over('🌩️');
    }

  }
  descriptionLong() { return this.description(); }
}

export class Wind extends Symb {
  static emoji = '🌬️';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() {
    return new Wind();
  }
  description() {
    return 'this is wind. it moves the neighboring ⛵ closer to the goal.';
  }
  async score(game, x, y) {
    // For all neighboring boats -- there could be multiple.
    const coords = game.board.nextToSymbol(x, y, Sailboat.emoji);
    for (const coord of coords) {
      const [boatX, boatY] = coord;
      // Animate moving the boat
      await Util.animate(game.board.getSymbolDiv(boatX, boatY), 'bounce', 0.15);
      // game.board.moveSymbol(game, boatX, boatY, 0, 1); -- doesn't exist yet
      // Implement it here:
      // game.board.removeSymbol(game, boatX, boatY);
      // game.board.addSymbol(game, new Sailboat(), boatX, boatY + 1);
    }
  }
  descriptionLong() { return this.description(); }
}

export class Lighthouse extends Symb {
  static emoji = '🗼';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() {
    return new Lighthouse();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y),
    ]);
  }
  description() {
    return 'this is a lighthouse. it protects the sailboat from waves and storms.';
  }
  descriptionLong() { return this.description(); }
}

export class Anchor extends Symb {
  static emoji = '⚓';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Anchor();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y),
    ]);
  }
  description() {
    return 'this is an anchor. it does not let ⛵ move this turn.';
  }
  descriptionLong() { return this.description(); }
}
