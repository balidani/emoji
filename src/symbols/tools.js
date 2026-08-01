import * as Const from '../consts.js';

import {
  Symb
} from '../symbol.js';

export const CATEGORY_TOOL = Symbol('Tool');

const onToolBuy = async (game, prompt, effect) => {
  if (game.inventory.symbols.length === 0) {
    return;
  }
  game.shop.hide();
  const coord = await game.view.pickCellForTool(
    prompt,
    (_spec, x, y) => game.board.getSymbol(x, y).emoji() !== Const.EMPTY
  );
  if (!coord) {
    return;
  }
  const [x, y] = coord;
  await effect(game, x, y);
  game.shop.show();
}

export class Pin extends Symb {
  static emoji = '📌';
  constructor() {
    super();
    this.rarity = 0.08;
  }
  categories() {
    return [CATEGORY_TOOL];
  }
  copy() {
    return new Pin();
  }
  description() {
    return '[Tool](tool): pins a symbol in place.';
  }
  async onBuy(game) {
    await onToolBuy(game, 'click on a symbol to pin in place', async (game, x, y) => {
      await game.board.pinCell(game, x, y);
    });
  }
}

export class Axe extends Symb {
  static emoji = '🪓';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  categories() {
    return [CATEGORY_TOOL];
  }
  copy() {
    return new Axe();
  }
  description() {
    return '[Tool](tool): removes a symbol from your inventory.';
  }
  async onBuy(game) {
    await onToolBuy(game, 'click on a symbol to remove', async (game, x, y) => {
      await game.board.removeSymbol(game, x, y);
    });
  }
}

export class Eye extends Symb {
  static emoji = '🧿';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  categories() {
    return [CATEGORY_TOOL];
  }
  copy() {
    return new Eye();
  }
  description() {
    return '[Tool](tool): converts a symbol into a passive ability.';
  }
  async onBuy(game) {
    await onToolBuy(game, 'click on a symbol to convert', async (game, x, y) => {
      await game.board.makePassive(game, x, y);
    });
  }
}
