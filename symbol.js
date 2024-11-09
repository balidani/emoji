import * as Const from './consts.js';
import * as Util from './util.js';

/* Since we aren't using typescript, relax the patterns somewhat for autocomplete */
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

export const CATEGORY_EMPTY_SPACE = Symbol('Empty Space');
export const CATEGORY_UNBUYABLE = Symbol('Unbuyable');

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
  onBuy(_) {}
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
  async addResource(game, key, value) {
    await Promise.all([game.inventory.addResource(key, value)]);
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
  render(game) {
    const symbolDiv = Util.createDiv(this.emoji(), 'symbol');
    const counterDiv = Util.createDiv(
      this.counter(game) || '',
      'symbol-counter'
    );
    const mult = this.multiplier !== 1 ? this.multiplier : undefined;
    const multiplierDiv = Util.createDiv(mult, 'symbol-multiplier', 'hidden');

    // The lambda is required, otherwise there is a bug with the info text.
    // This should probably be fixed in the future.
    symbolDiv.addEventListener('click', () => this.clickHandler(game));

    symbolDiv.appendChild(counterDiv);
    symbolDiv.appendChild(multiplierDiv);

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
  onClick(_) {}
}
