import { chance, Symb, CATEGORY_UNBUYABLE } from '../symbol.js';
import * as Util from '../util.js';

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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 4, x, y);
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
    return [CATEGORY_UNBUYABLE];
  }
  description() {
    return '[Pays](pays) 💵4. Disappears after 3 turns';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 9, x, y);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const [newX, newY] = Util.randomChoose(coords);
      await game.view.animateCell(x, y, 'grow', 0.15);
      await game.eventlog.logResourceChange(
        note.emoji(),
        '',
        this.emoji(),
        'earned'
      );
      await game.board.addSymbol(game, note, newX, newY);
    }
  }
  description() {
    return '[Pays](pays) 💵9. 20% [Chance](chance) to [Spawn](spawn) 🎵';
  }
}

// export class Dancer extends Symb {
//   static emoji = '💃';
//   constructor() {
//     super();
//     this.rarity = 0.3;
//     this.musicScore = 0;
//   }
//   copy() {
//     return new Dancer();
//   }
//   async score(game, x, y) {
//     const coords = game.board.nextToSymbol(x, y, MusicalNote.emoji);
//     if (coords.length === 0) {
//       return;
//     }
//     await game.view.animateCell(x, y, 'bounce', 0.15);
//     await this.addMoney(game, coords.length * 10, x, y);
//   }
//   description() {
//     return '💵10 for each neighboring 🎵';
//   }
//   descriptionLong() {
//     return "this is a dancer. it pays 💵10 for each 🎵 it's standing next to.";
//   }
// }

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
      await game.view.animateCell(x, y, 'grow', 0.15);
      const note = new MusicalNote();
      await game.eventlog.logResourceChange(
        note.emoji(),
        '',
        this.emoji(),
        'earned'
      );
      await game.board.addSymbol(game, note, newX, newY);
    }
  }
  counter(_) {
    return 3 - (this.turns % 3);
  }
  description() {
    return 'Every 3 turns: [Spawns](spawn) 🎵';
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
      await game.view.animateCell(x, y, 'bounce', 0.15);
      await this.addMoney(game, this.notes, x, y);
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
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  counter(_) {
    return this.notes;
  }
  description() {
    return '[Consumes](consume) neighboring 🎵 and [Stockpiles](stockpile) +💵6 each';
  }
}
