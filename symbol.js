import * as Const from './consts.js';
import * as Util from './util.js';

/* Since we aren't using typescript, relax the patterns somewhat for autocomplete */
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

export const CATEGORY_EMPTY_SPACE = Symbol('Empty Space');
export const CATEGORY_UNBUYABLE = Symbol('Unbuyable');

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
  descriptionLong() {
    return this.description();
  }
  async addResource(game, key, value, source='❓') {
    await Promise.all([
      game.board.showResourceEarned(key, value, source),
      game.inventory.addResource(key, value),
    ]);
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const source = game.board.getEmoji(x, y);
    const coords = game.board.nextToSymbol(x, y, Const.MULT);
    for (const coord of coords) {
      const [multX, multY] = coord;
      await Util.animate(
        game.board.getSymbolDiv(multX, multY),
        'flip',
        0.15,
        1
      );
    }
    await this.addResource(game, Const.MONEY, value, source);
  }
  emoji() {
    return this.constructor.emoji;
  }
  reset() {
    this.multiplier = 1;
  }
  counter(_game) {
    return null;
  }
  render(game, x, y) {
    const symbolDiv = Util.createDiv(this.emoji(), 'symbol');
    const counterDiv = Util.createDiv(
      Util.formatBigNumber(this.counter(game) || ''),
      'symbol-counter'
    );
    const pinDiv = Util.createDiv(
      game.board.lockedCells[`${x},${y}`] ? Const.PIN : '', 'symbol-pin');

    // const mult = this.multiplier !== 1 ? this.multiplier : undefined;
    // const multiplierDiv = Util.createDiv(mult, 'symbol-multiplier', 'hidden');

    // The lambda is required, otherwise there is a bug with the info text.
    // This should probably be fixed in the future.
    symbolDiv.addEventListener('click', () => this.clickHandler(game));

    symbolDiv.appendChild(counterDiv);
    symbolDiv.appendChild(pinDiv);

    // symbolDiv.appendChild(multiplierDiv);

    return symbolDiv;
  }
  clickHandler(game) {
    const interactiveDescription = Util.createInteractiveDescription(
      this.descriptionLong(),
      /*emoji=*/ this.emoji()
    );
    return () =>
      Util.drawText(game.info, interactiveDescription, /*isHtml=*/ true);
  }
}
