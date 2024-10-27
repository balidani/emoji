import * as Const from './consts.js';
import * as Util from './util.js';

export class Inventory {
  constructor(settings, catalog) {
    this.catalog = catalog;
    this.symbols = catalog.symbolsFromString(settings.startingSet);
    this.symbolsDiv = document.querySelector('.game .inventory');
    this.uiDiv = document.querySelector('.game .ui');
    this.infoDiv = document.querySelector('.info');

    this.resources = {};
    this.resources[Const.MONEY] = 1;
    this.resources[Const.TURNS] = settings.gameLength;
    this.resources[Const.LUCK] = 0;
    this.tempLuckBonus = 0;
    this.updateUi();
    this.graveyard = [];
  }
  update() {
    this.symbolsDiv.replaceChildren();
    const map = new Map();
    this.symbols.forEach((symbol) => {
      const name = symbol.emoji();
      if (!map.has(name)) {
        map.set(name, { count: 0, description: symbol.descriptionLong() });
      }
      map.set(name, {
        count: map.get(name).count + 1,
        description: symbol.descriptionLong(),
      });
    });
    map.forEach(({ count, description }, name) => {
      const symbolDiv = document.createElement('div');
      symbolDiv.addEventListener('click', (_) => {
        const interactiveDescription = Util.createInteractiveDescription(
          description,
          /*emoji=*/ name
        );
        Util.drawText(this.infoDiv, interactiveDescription, true);
      });
      symbolDiv.classList.add('inventoryEntry');
      symbolDiv.innerText = name;

      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = count;
      symbolDiv.appendChild(countSpan);
      this.symbolsDiv.appendChild(symbolDiv);
    });
  }
  remove(symbol) {
    const index = this.symbols.indexOf(symbol);
    if (index >= 0) {
      this.symbols.splice(index, 1);
    }
    this.update();
    this.graveyard.push(symbol);
  }
  add(symbol) {
    this.symbols.push(symbol);
    this.update();
  }
  getResource(key) {
    if (this.resources[key] === undefined) {
      return 0;
    }
    return this.resources[key];
  }
  async addResource(key, value) {
    if (this.resources[key] === undefined) {
      this.resources[key] = 0;
    }
    this.resources[key] += value;
    this.updateUi();
  }
  addLuck(bonus) {
    this.tempLuckBonus += bonus;
    // `this.updateUi()` -- This call is not needed here!
    // `resetLuck`` is the function to call when luck calculation finished in last turn's Board::score.
    // We technically always use last turn's luck to avoid another round of scoring.
  }
  resetLuck() {
    this.resources[Const.LUCK] = this.tempLuckBonus;
    this.tempLuckBonus = 0;
    this.updateUi();
  }
  updateUi() {
    this.uiDiv.replaceChildren();
    const displayKeyValue = (key, value) => {
      const symbolDiv = document.createElement('div');
      symbolDiv.innerText = key;
      symbolDiv.addEventListener('click', (_) => {
        const interactiveDescription = Util.createInteractiveDescription(
          this.catalog.symbol(key).descriptionLong(),
          /*emoji=*/ key
        );
        Util.drawText(this.infoDiv, interactiveDescription, true);
      });
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = value;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    };
    for (const [key, value] of Object.entries(this.resources)) {
      displayKeyValue(key, value);
    }
  }
  // Note: This does NOT return a Symbol. It returns an emoji text character for animation purposes.
  getRandomOwnedEmoji() {
    return Util.randomChoose(this.symbols).emoji();
  }
}
