import { Symb, CATEGORY_UNBUYABLE } from '../symbol.js';

export class Time extends Symb {
  static emoji = '⏰';
  constructor() {
    super();
    this.rarity = 0.0;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  copy() {
    return new Time();
  }
  description() {
    return 'time';
  }
  onClick(game) {
    game.roll();
  }
}

export class Money extends Symb {
  static emoji = '💵';
  constructor() {
    super();
    this.rarity = 0.0;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  copy() {
    return new Money();
  }
  description() {
    return 'money';
  }
}
