import * as Util from './util.js';

export const CATEGORY_EMPTY_SPACE = Symbol('Empty Space');
export const CATEGORY_UNBUYABLE = Symbol('Unbuyable');

/* Since we aren't using typescript, relax the patterns somewhat for autocomplete */

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

const luckyChance = (game, chance, x, y) => {
  // TODO FIX reference to BullsEye.emoji this hardcoding IS TEMPORARY
  if (game.board.nextToSymbol(x, y, '🎯').length > 0) {
    return 1.0;
  }
  return chance + game.inventory.lastLuckBonus;
};
export const chance = (game, percent, x, y) =>
  Math.random() < luckyChance(game, percent, x, y);

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
  cost() {
    return 0;
  }
  categories() {
    return [];
  }
  description() {
    throw new Error('Trying to get description of base class.');
  }
  descriptionLong() {
    throw new Error('Trying to get long description of base class.');
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const coords = game.board.nextToSymbol(x, y, '❎');
    for (const coord of coords) {
      const [multX, multY] = coord;
      await Util.animate(
        game.board.getSymbolDiv(multX, multY),
        'flip',
        0.15,
        1
      );
    }
    await Promise.all([
      game.board.showMoneyEarned(x, y, value),
      game.inventory.addMoney(score * this.multiplier),
    ]);
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

    symbolDiv.addEventListener('click', this.clickHandler(game));

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
}

export class Empty extends Symb {
  static emoji = '⬜';
  constructor() {
    super();
  }
  copy() {
    return new Empty();
  }
  description() {
    return 'you should not be seeing this';
  }
  descriptionLong() {
    return "this is empty space. it's not part of your inventory.";
  }
  categories() {
    return [CATEGORY_EMPTY_SPACE, CATEGORY_UNBUYABLE];
  }
}

export class Money extends Symb {
  static emoji = '💵';
  constructor() {
    super();
  }
  copy() {
    return new Money();
  }
  description() {
    return 'this is money';
  }
  descriptionLong() {
    return 'this is money. you should get as much as possible before the game ends.';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}
export class Turn extends Symb {
  static emoji = '⏰';
  constructor() {
    super();
  }
  copy() {
    return new Turn();
  }
  description() {
    return 'this is how many turns you have left';
  }
  descriptionLong() {
    return 'this is how many turns you have left.';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}
