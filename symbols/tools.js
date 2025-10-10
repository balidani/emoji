import * as Const from '../consts.js';
import * as Util from '../util.js';

import {
  Symb
} from '../symbol.js';

export const CATEGORY_TOOL = Symbol('Tool');

const onToolBuy = async (game, prompt, effect) => {
  if (game.inventory.symbols.length === 0) {
    return;
  }
  game.shop.hide();
  game.board.removeClickListener();
  Util.drawText(game.info, prompt, false);
  const coord = await game.board.getClickCoord((sym) => sym.emoji() !== '⬜');
  if (!coord) {
    return;
  }
  const [x, y] = coord;
  effect(game, x, y);
  game.board.addClickListener(game);
  game.shop.show();
}

export class Pin extends Symb {
  static emoji = '📌';
  constructor() {
    super();
    this.rarity = 2.08;
  }
  categories() {
    return [CATEGORY_TOOL];
  }
  copy() {
    return new Pin();
  }
  description() {
    return 'pins a cell in place';
  }
  descriptionLong() {
    return 'this is a tool. it allows pinning a symbol in place. it doesn\'t appear on the board as a symbol.';
  }
  async onBuy(game) {
    onToolBuy(game, 'click on a symbol to pin in place', (game, x, y) => {
      game.board.pinCell(game, x, y);
    });
  }
}

export class Axe extends Symb {
  static emoji = '🪓';
  constructor() {
    super();
    this.rarity = 1.08;
  }
  categories() {
    return [CATEGORY_TOOL];
  }
  copy() {
    return new Axe();
  }
  description() {
    return 'removes a cell from inventory';
  }
  descriptionLong() {
    return 'this is a tool. it allows removing a symbol from the inventory. it doesn\'t appear on the board as a symbol.';
  }
  async onBuy(game) {
    onToolBuy(game, 'click on a symbol to remove', (game, x, y) => {
      game.board.removeSymbol(game, x, y);
    });
  }
}
