import * as Const from './consts.js';
import * as Util from './util.js';

/* Since we aren't using typescript, relax the patterns somewhat for autocomplete */
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

// Plain strings, not Symbol() -- a category defined in one symbol source
// file and imported by another (e.g. animals.js importing CATEGORY_FOOD
// from food.js) must compare equal even when the two files were loaded as
// separate module instances. That happens for every Daily Challenge server
// validation: Catalog's freshImports (see catalog.js) cache-busts each
// symbol source independently to force Santa's import-time RNG draw
// (symbols/things.js) to refire on a warm Lambda container, and a nested
// static import inside a busted file resolves to yet another instance, not
// necessarily the one Catalog itself loaded. A Symbol() would silently
// stop matching across that boundary -- .includes() would just always
// return false, with no error -- so every CATEGORY_* in this codebase must
// stay a string.
export const CATEGORY_EMPTY_SPACE = 'category:Empty Space';
export const CATEGORY_UNBUYABLE = 'category:Unbuyable';

export const chance = (game, percent, x, y) => {
  let luckyChance = 0;
  if (game.board.nextToSymbol(x, y, '🎯').length > 0) {
    luckyChance = 1.0;
  } else {
    luckyChance = percent + game.inventory.getResource(Const.LUCK) / 100.0;
  }
  return Util.randomFloat() < luckyChance;
};

// Used for negative effects.
export const badChance = (game, percent, x, y) => {
  let badLuckChance = 0;
  if (game.board.nextToSymbol(x, y, '🎯').length > 0) {
    badLuckChance = 0.0;
  } else {
    badLuckChance = percent - game.inventory.getResource(Const.LUCK) / 100.0;
  }
  return Util.randomFloat() < badLuckChance;
};

export class Symb {
  static emoji = '⬛';
  constructor() {
    this.multiplier = 1;
    this.rarity = 0;
    this.turns = 0;
  }
  copy() {
    throw new Error('Trying to get copy of base class.');
  }
  async evaluateConsume() {}
  async evaluateProduce() {}
  async finalScore(_game, _x, _y) {}
  async score(_game, _x, _y) {}
  async onBuy(game) {
    game.inventory.add(this);
  }
  cost() {
    return {};
  }
  categories() {
    return [];
  }
  description() {
    throw new Error('Trying to get description of base class.');
  }
  async addResource(game, x, y, key, value) {
    const source = game.board.getEmoji(x, y) || '❓';
    await Promise.all([
      game.eventlog.logResourceChange(key, value, source, 'earned'),
      game.inventory.addResource(key, value),
    ]);
    if (key === Const.MONEY) {
      await game.view.moneyEarned(x, y, value);
    }
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const coords = game.board.nextToSymbol(x, y, Const.MULT);
    let multCount = 0;
    for (const coord of coords) {
      const [multX, multY] = coord;
      await Promise.all([
        game.view.animateCell(multX, multY, 'flip', 0.2, 1),
        game.view.animateCellOverlay(x, y, 'grow', 0.2 + multCount * 0.035, 1, {
          'grow-scale': 1.2 + multCount * 0.25,
        }),
      ]);
      multCount++;
    }
    await this.addResource(game, x, y, Const.MONEY, value);
  }
  emoji() {
    return this.constructor.emoji;
  }
  displayEmoji(_game, _x, _y) {
    return this.emoji();
  }
  reset() {
    this.multiplier = 1;
  }
  counter(_game) {
    return null;
  }
  // Marker seam: true for symbols that swap into a random disguise right
  // after rolling in (see board.transformWildcards). Base is false.
  transformsOnRoll() {
    return false;
  }
  // Plain-data description of this symbol's on-screen appearance.
  // DomRenderer/BoardView is the only place that turns this into DOM.
  //
  // NOTE: the DOM node this replaces (the old `render()`) wired a click
  // listener via `this.clickHandler(game)`, but that call's return value (a
  // closure that would call Util.drawText) was never invoked -- the
  // original code even carried a comment flagging it as buggy. Board-cell
  // clicks have therefore never shown symbol info in practice; not
  // replicating that dead code here isn't a behavior change.
  renderSpec(game, x, y) {
    return {
      emoji: this.displayEmoji(game, x, y),
      counter: this.counter(game),
      pinned: !!game.board.lockedAt(x, y),
    };
  }
}
