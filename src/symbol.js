import * as Const from './consts.js';
import * as Util from './util.js';

import { Effect } from './Effect.js';

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
  evaluateConsume(_ctx, x, y) { return Effect.none(); }
  evaluateProduce(_ctx, x, y) { return Effect.none(); }
  finalScore(_ctx, _x, _y) { return Effect.none(); }
  score(_ctx, _x, _y) { return Effect.none(); }
  onBuy() {
    return Effect.serial({type: 'model', component: 'inventory.add',
      params: {symbol: this}});
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
  addResource(ctx, x, y, key, value) {
    const source = ctx.board.getEmoji(x, y) || '❓';
    const parallelEffects = [];
    parallelEffects.push(
      Effect.modelOf('inventory.addResource').params(
        {key: key, value: value, source: source}
      )
    );
    if (key === Const.MONEY) {
      if (x === -1) {
        parallelEffects.push(Effect.viewOf('inventory.moneyEarnedOverlay')
          .params({coords: {x, y}, value: value}));
      } else {
        parallelEffects.push(Effect.viewOf('board.moneyEarnedOverlay')
          .params({coords: {x, y}, value: value}));
      }
    }
    return Effect.parallel(parallelEffects);
  }
  addMoney(ctx, score, x, y) {
    const value = score * this.multiplier;
    const coords = ctx.board.nextToSymbol(x, y, Const.MULT);
    let multCount = 0;
    const multEffects = [];
    for (const coord of coords) {
      const [multX, multY] = coord;
      multEffects.push(Effect.parallel(
        Effect.viewOf('board.animate').params(
          {coords: {x: multX, y: multY}, animation: 'flip', duration: 0.2}),
        Effect.viewOf('board.animateOverlay').params(
          {coords: {x: multX, y: multY}, animation: 'grow', duration: 0.2 + multCount * 0.035,
          cssVars: {'grow-scale': 1.2 + multCount * 0.25}})));
      multCount++;
    }
    return Effect.serial(...multEffects,
      ...this.addResource(ctx, x, y, Const.MONEY, value));
  }
  emoji() {
    return this.constructor.emoji;
  }
  reset() {
    this.multiplier = 1;
  }
  counter(_ctx) {
    return null;
  }
  render(ctx, x, y) {
    // TODO #REFACTOR, this needs to happen in a view???

    const symbolDiv = Util.createDiv(this.emoji(), 'symbol');
    const counterDiv = Util.createDiv(
      Util.formatBigNumber(this.counter(ctx) || ''),
      'symbol-counter'
    );
    const pinDiv = Util.createDiv(
      ctx.board.lockedCells[`${x},${y}`] ? Const.PIN : '', 'symbol-pin');

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
