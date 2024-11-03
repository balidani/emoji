import * as Const from '../consts.js';

import { Symb } from '../symbol.js';

export class RestartAction extends Symb {
  static emoji = '🔄';
  constructor() {
    super();
    this.rarity = 0.5;
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
  copy() {
    return new RestartAction();
  }
  onClick(_) {}
  description() {
    return 'restart the game.';
  }
}
