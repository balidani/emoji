import * as Const from '../consts.js';
import * as Util from '../util.js';

import { chance, Symb } from '../symbol.js';

// This file organizes symbols related to music
// Most of them interact with MusicalNote (🎵) in some way

export class MusicalNote extends Symb {
  static emoji = '🎵';
  constructor() {
    super();
    this.rarity = 0;
  }
  copy() {
    return new MusicalNote();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 4, x, y),
    ]);
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 3) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter(_) {
    return 3 - this.turns;
  }
  categories() {
    return [Const.ATEGORY_UNBUYABLE];
  }
  description() {
    return '💵4<br>disappears after 3 turns';
  }
  descriptionLong() {
    return 'this is a musical note. it pays 💵4, and disappears after 3 turns';
  }
}

export class Bell extends Symb {
  static emoji = '🔔';
  constructor() {
    super();
    this.rarity = 0.3;
  }
  copy() {
    return new Bell();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 9, x, y),
    ]);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, note, newX, newY);
    }
  }
  description() {
    return '💵9<br>20% chance: makes 🎵';
  }
  descriptionLong() {
    return 'this is a bell. it pays 💵9, and it has a 20% chance to create 🎵 on a neighboring empty space.';
  }
}

export class Dancer extends Symb {
  static emoji = '💃';
  constructor() {
    super();
    this.rarity = 0.3;
    this.musicScore = 0;
  }
  copy() {
    return new Dancer();
  }
  async score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, MusicalNote.emoji);
    if (coords.length === 0) {
      return;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, coords.length * 10, x, y),
    ]);
  }
  description() {
    return '💵10 for each neighboring 🎵';
  }
  descriptionLong() {
    return "this is a dancer. it pays 💵10 for each 🎵 it's standing next to.";
  }
}

export class Drums extends Symb {
  static emoji = '🥁';
  constructor() {
    super();
    this.rarity = 0.35;
  }
  copy() {
    return new Drums();
  }
  async evaluateProduce(game, x, y) {
    if (this.turns % 3 === 0) {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 3);
      await game.board.addSymbol(game, new MusicalNote(), newX, newY);
    }
  }
  counter(_) {
    return 3 - (this.turns % 3);
  }
  description() {
    return 'every 3 turns: makes 🎵';
  }
  descriptionLong() {
    return 'these are drums. every third turn, they create 🎵 on a nearby empty space.';
  }
}

export class Record extends Symb {
  static emoji = '📀';
  constructor(notes = 0) {
    super();
    this.rarity = 0.12;
    this.notes = notes;
  }
  copy() {
    return new Record(this.notes);
  }
  async score(game, x, y) {
    if (this.notes > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.notes, x, y),
      ]);
    }
  }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, MusicalNote.emoji);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.notes += 6;
      game.board.redrawCell(game, x, y);
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  counter(_) {
    return this.notes;
  }
  description() {
    return 'records neighboring 🎵<br>💵6 for each 🎵 recorded';
  }
  descriptionLong() {
    return 'this is a record. it removes neighboring 🎵 and permanently pays 💵6 more for each 🎵 removed.';
  }
}
