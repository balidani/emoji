import * as Const from './consts.js';
import * as Util from './util.js';

import { Effect } from './Effect.js';

export class Inventory {
  constructor(settings, catalog) {
    this.settings = settings;
    this.catalog = catalog;
    this.symbols = catalog.symbolsFromString(settings.startingSet);

    this.resources = {};
    this.resources[Const.MONEY] = 1;
    this.resources[Const.TURNS] = settings.gameLength;
    this.resources[Const.LUCK] = 0;
    this.tempLuckBonus = 0;
    this.graveyard = [];
    this.giftsOpened = 0;
    this.rowCount = settings.boardY;
  }
  buildContext() {
    return {
      getResource: this.getResource.bind(this),
    };
  }
  remove(symbol) {
    const index = this.symbols.indexOf(symbol);
    if (index >= 0) {
      this.symbols.splice(index, 1);
    }
    this.graveyard.push(symbol);
    const symbolCount = this.symbols.filter(
      s => s.emoji() === symbol.emoji()).length;
    return Effect.serial({type: 'view', component: 'inventory.removeSymbol',
      params: {symbol: symbol, count: symbolCount}});
  }
  add(symbol) {
    this.symbols.push(symbol);
    const symbolCount = this.symbols.filter(
      s => s.emoji() === symbol.emoji()).length;
    return Effect.serial({type: 'view', component: 'inventory.addSymbol',
      params: {symbol: symbol, count: symbolCount}});
  }
  getResource(key) {
    if (this.resources[key] === undefined) {
      return 0;
    }
    return this.resources[key];
  }
  addResource(key, value) {
    // TODO #REFACTOR:
    // effects.push({type: 'model', component:'eventlog.showResourceEarned',
    //   params: {key: key, value: value, source: source}});
    if (this.resources[key] === undefined) {
      this.resources[key] = 0;
    }
    this.resources[key] += value;
    return EFfect.serial({type: 'view', component: 'inventory.resourceSet',
      params: {key: key, value: this.resources[key]}});
  }
  addLuck(bonus) {
    this.tempLuckBonus += bonus;
    // Updating the ui is not wanted here.
    // `resetLuck`` is the function to call when luck calculation finished in last turn's Board::score.
    // We technically always use last turn's luck to avoid another round of scoring.
    return [];
  }
  resetLuck() {
    this.resources[Const.LUCK] = this.tempLuckBonus;
    this.tempLuckBonus = 0;
    return Effect.serial({type: 'view', component: 'inventory.resourceSet',
      params: {key: Const.LUCK, value: this.resources[Const.LUCK]}});
  }
  resetRows() {
    this.rowCount = this.settings.boardY;
  }
  // Note: This does NOT return a Symbol. It returns an emoji text character for animation purposes.
  getRandomOwnedEmoji() {
    if (this.symbols.length === 0) {
      return Const.EMPTY;
    }
    return Util.randomChoose(this.symbols).emoji();
  }
}
