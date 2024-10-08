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
    // await Promise.all([
    //   Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
    //   this.addMoney(game, 6, x, y),
    // ]);
  }
  description() {
    return 'The sailboat moves forward and collects rewards.';
  }
  descriptionLong() {
    return this.description();
  }
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
  descriptionLong() {
    return this.description();
  }
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
    return 'this is a storm. if it touches the boat, 10% chance that the boat moves back to the starting tile.';
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Sailboat.emoji);
    if (coords.length === 0) {
      return;
    }
    const filteredCoords = [];
    for (const [boatX, boatY] of coords) {
      const lighthouseCoords = game.board.nextToSymbol(
        boatX,
        boatY,
        Lighthouse.emoji
      );
      if (lighthouseCoords.length === 0) {
        filteredCoords.push([boatX, boatY]);
      } else {
        const [lighthouseX, lighthouseY] = lighthouseCoords[0];
        await Util.animate(
          game.board.getSymbolDiv(lighthouseX, lighthouseY),
          'shake',
          0.15,
          1
        );
      }
    }
    if (filteredCoords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const [boatX, boatY] = Util.randomRemove(coords);
      await game.board.removeSymbol(game, 0, 0);
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2),
        await game.board.moveSymbol(game, boatX, boatY, 0, 0),
      ]);
    }
  }
  descriptionLong() {
    return this.description();
  }
}

export class Wind extends Symb {
  static emoji = '🌬️';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() {
    return new Wind();
  }
  description() {
    return 'this is wind. it moves the neighboring ⛵ closer to the goal.';
  }
  async evaluateProduce(game, x, y) {
    // For all neighboring boats -- there could be multiple.
    const coords = game.board.nextToSymbol(x, y, Sailboat.emoji);
    for (const coord of coords) {
      const [boatX, boatY] = coord;
      const destinations = [
        [boatX + 1, boatY],
        [boatX, boatY + 1],
      ];
      const candidates = [];
      for (const [destX, destY] of destinations) {
        if (game.board.cells[destY][destX] === undefined) {
          continue;
        }
        if (game.board.cells[destY][destX].emoji() === '🟦') {
          candidates.push([destX, destY]);
        }
      }
      if (candidates.length === 0) {
        break;
      }
      const [toX, toY] = Util.randomChoose(candidates);
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2),
        await game.board.moveSymbol(game, boatX, boatY, toX, toY),
      ]);
    }
  }
  descriptionLong() {
    return this.description();
  }
}

// export class Lighthouse extends Symb {
//   static emoji = '🗼';

export class Fish extends Symb {
  static emoji = '🐟';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  copy() {
    return new Fish();
  }
  description() {
    return 'this is a fish. it pays 💵3.';
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15),
      this.addMoney(game, 3, x, y),
    ]);
  }
  descriptionLong() {
    return this.description();
  }
}

export class Buoy extends Symb {
  static emoji = '🛟';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Buoy();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y),
    ]);
  }
  description() {
    return 'this is a buoy. it protects the sailboat from waves and storms.';
  }
  descriptionLong() {
    return this.description();
  }
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
    return 'this is an anchor. it does not let nearby ⛵ move this turn.';
  }
  descriptionLong() {
    return this.description();
  }
}

export class Surfer extends Symb {
  static emoji = '🏄';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() {
    return new Surfer();
  }
  async evaluateConsume(game, x, y) {
    const eatNeighbor = async (neighborClass, _) => {
      const coords = game.board.nextToSymbol(x, y, neighborClass.emoji);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        // this.reward += reward;
        const [deleteX, deleteY] = coord;
        await Promise.all([
          Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15),
          game.board.removeSymbol(game, deleteX, deleteY),
        ]);
      }
      this.turns = 0;
      game.board.redrawCell(game, x, y);
    };
    await eatNeighbor(Wave, 0);
    if (this.turns >= 5) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  description() {
    return 'this is a surfer. it removes nearby 🌊. leaves after 3 turns with no 🌊 nearby.';
  }
  descriptionLong() {
    return this.description();
  }
}
