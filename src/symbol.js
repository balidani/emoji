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
  evaluateConsume() { return []; }
  evaluateProduce() { return []; }
  finalScore(_game, _x, _y) { return []; }
  score(_game, _x, _y) { return []; }
  async onBuy(game) {
    // TODO #REFACTOR return event
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
  addResource(game, x, y, key, value) {
    const source = game.board.getEmoji(x, y) || '❓';
    const effects = [];
    effects.push(...game.eventlog.showResourceEarned(key, value, source));
    effects.push(...game.inventory.addResource(key, value));
    if (key === Const.MONEY) {
      if (x === -1) {
        effects.push({type: 'inventory.moneyEarnedOverlay', coords: {x, y}, value: value});
      } else {
        effects.push({type: 'board.moneyEarnedOverlay', coords: {x, y}, value: value});
      }
    }
    return effects;
  }
  addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const coords = game.board.nextToSymbol(x, y, Const.MULT);
    let multCount = 0;
    const effects = [];
    for (const coord of coords) {
      const [multX, multY] = coord;
      effects.push([
        {type: 'board.animate', coords: {x: multX, y: multY}, animation: 'flip', duration: 0.2},
        {type: 'board.animateOverlay', coords: {x, y}, animation: 'grow', duration: 0.2 + multCount * 0.035,
          cssVars: {'grow-scale': 1.2 + multCount * 0.25}},
      ]);
      multCount++;
    }
    effects.push(...this.addResource(game, x, y, Const.MONEY, value));
    return effects;
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
