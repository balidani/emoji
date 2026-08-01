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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    const coords = game.board.nextToSymbol(x, y, Diamond.emoji);
    const rowMult = game.board.allSameInRow(x, y) ? 7 : 1;
    const colMult = game.board.allSameInColumn(x, y) ? 7 : 1;
    if (rowMult !== 1) {
      await game.view.animateCell(x, y, 'flip', 0.15);
    }
    if (colMult !== 1) {
      await game.view.animateCell(x, y, 'flip', 0.15);
    }
    const score = (7 + coords.length * 7) * rowMult * colMult;
    await this.addMoney(game, score, x, y);
  }
  description() {
    return '[Pays](pays) 💵7, plus 💵7 per neighboring 💎. x7 for a full row, x7 for a full column.';
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
    await game.view.animateCell(x, y, 'bounce', 0.15);
    await this.addMoney(game, 1, x, y);
  }
  description() {
    return '[Pays](pays) 💵1.';
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
      const newY = Util.random(game.board.currentRows);
      await game.board.removeSymbol(game, newX, newY);
      await game.eventlog.logResourceChange('🕳️', '', this.emoji(), 'earned');
      await game.board.addSymbol(game, game.catalog.symbol('🕳️'), newX, newY);
      await game.eventlog.logResourceChange('🪨', '5', this.emoji(), 'earned');
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
    }
  }
  description() {
    return '10% [Chance](chance) to [Spawn](spawn) 🪨x5 on random tiles. [Risk](risk) 🪨 destroys whatever was already there.';
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
      await game.eventlog.logResourceChange(
        game.board.getEmoji(deleteX, deleteY),
        '',
        this.emoji(),
        'lost'
      );
      await game.board.removeSymbol(game, deleteX, deleteY);
      if (chance(game, 0.5, x, y)) {
        const diamond = new Diamond();
        await game.eventlog.logResourceChange(
          diamond.emoji(),
          '',
          this.emoji(),
          'earned'
        );
        await game.board.addSymbol(game, diamond, deleteX, deleteY);
      }
    }
  }
  description() {
    return '[Consumes](consume) neighboring 🪨. 50% [Chance](chance) to [Spawn](spawn) 💎 in its place.';
  }
}
