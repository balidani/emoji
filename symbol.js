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
  async addResource(game, x, y, key, value) {
    const source = game.board.getEmoji(x, y) || '❓';
    await Promise.all([
      game.eventlog.showResourceEarned(key, value, source),
      game.inventory.addResource(key, value),
    ]);
    if (key === Const.MONEY) {
      // Create a temporary money span to show on the overlay
      const moneySpan = Util.createSpan(`💵${Util.formatBigNumber(value)}`, 'money-earned-line');
      const cellDiv = game.board.getCellDiv(x, y);
      cellDiv.appendChild(moneySpan);
      Util.animateOverlay(
        moneySpan,
        'moneyEarnedRise',
        2,
      ).then(() => {
        cellDiv.removeChild(moneySpan);
      });
    }
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const coords = game.board.nextToSymbol(x, y, Const.MULT);
    let multCount = 0;
    for (const coord of coords) {
      const [multX, multY] = coord;
      await Promise.all([
        Util.animate(
          game.board.getSymbolDiv(multX, multY),
          'flip',
          0.2,
          1),
        Util.animateOverlay(game.board.getSymbolDiv(x, y), 'grow', 0.2 + multCount * 0.035, 1,
          {'grow-scale': 1.2 + multCount * 0.25}),
      ]);
      multCount++;
    }
    await this.addResource(game, x, y, Const.MONEY, value);
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
