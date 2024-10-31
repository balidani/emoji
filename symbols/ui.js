import * as Const from '../consts.js';
import { Symb } from '../symbol.js';

// Symbols in this file are only used for UI purposes.

export class Empty extends Symb {
  static emoji = '⬜';
  constructor() {
    super();
  }
  copy() {
    return new Empty();
  }
  description() {
    return 'you should not be seeing this';
  }
  descriptionLong() {
    return "this is empty space. it's not part of your inventory.";
  }
  categories() {
    return [Const.CATEGORY_EMPTY_SPACE, Const.CATEGORY_UNBUYABLE];
  }
}

export class Money extends Symb {
  static emoji = '💵';
  constructor() {
    super();
  }
  copy() {
    return new Money();
  }
  description() {
    return 'this is money';
  }
  descriptionLong() {
    return 'this is money. you should get as much as possible before the game ends.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}
export class Turn extends Symb {
  static emoji = '⏰';
  constructor() {
    super();
  }
  copy() {
    return new Turn();
  }
  description() {
    return 'this is how many turns you have left';
  }
  descriptionLong() {
    return 'this is how many turns you have left.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class PlayButton extends Symb {
  static emoji = '🕹️';
  constructor() {
    super();
  }
  copy() {
    return new PlayButton();
  }
  description() {
    return 'click to play';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 1) {
      await game.board.removeSymbol(game, x, y);
    }
  }
}
