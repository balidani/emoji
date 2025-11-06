import { Symb } from '../symbol.js';
import * as Util from '../util.js';

/**
 * Example of a "mod" file that introduces an extra item
 */

export class Monorail extends Symb {
  static name = '🚝';
  constructor() {
    super();
    this.rarity = 0.9;
  }
  copy() {
    return new Monorail();
  }
  description() {
    return 'Developer Cheat Item';
  }
  descriptionLong() {
    return 'Developer Cheat Item worth 10 per spin';
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.5),
      this.addMoney(game, 10, x, y),
    ]);
  }
}
