import * as Const from './consts.js';
import * as Util from './util.js';

export class Inventory {
  constructor(game) {
    this.game = game;
    this.settings = game.settings;
    this.catalog = game.catalog;
    this.symbols = this.catalog.symbolsFromString(this.settings.startingSet);
    this.symbolsDiv = document.querySelector('.game .inventory');
    this.infoDiv = document.querySelector('.info');

    this.resources = {};
    this.resources[Const.MONEY] = 0;
    this.resources[Const.TURNS] = 0;
    this.graveyard = [];
  }
  async update() {
    this.symbolsDiv.replaceChildren();

    const displayKeyValue = async (key, value) => {
      const symbolDiv = Util.createDiv(key, 'inventoryEntry');
      symbolDiv.addEventListener('click', async (_) => {
        // await this.game.catalog.symbol(key).onClick(this.game);
        const interactiveDescription = Util.createInteractiveDescription(
          this.catalog.symbol(key).descriptionLong(),
          /*emoji=*/ key
        );
        Util.drawText(this.infoDiv, interactiveDescription, true);
      });
      const countSpan = Util.createDiv(value + '', 'inventoryEntryCount');
      symbolDiv.appendChild(countSpan);
      this.symbolsDiv.appendChild(symbolDiv);
    };
    for (const [key, value] of Object.entries(this.resources)) {
      await displayKeyValue(key, value);
    }

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
      const symbolDiv = Util.createDiv(name, 'inventoryEntry');
      symbolDiv.addEventListener('click', async (_) => {
        const interactiveDescription = Util.createInteractiveDescription(
          description,
          /*emoji=*/ name
        );
        Util.drawText(this.infoDiv, interactiveDescription, true);
        // await this.getOwned(name).onClick(this.game);
      });
      const countDiv = Util.createDiv(count, 'inventoryEntryCount');
      symbolDiv.appendChild(countDiv);
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
    this.update();
  }
  // Note: This does NOT return a Symbol. It returns an emoji text character for animation purposes.
  getRandomOwnedEmoji() {
    if (this.symbols.length === 0) {
      return Const.EMPTY;
    }
    return Util.randomChoose(this.symbols).emoji();
  }
  getOwned(emoji) {
    if (this.symbols.length === 0) {
      return Const.EMPTY;
    }
    return Util.randomChoose(
      this.symbols.filter((symbol) => symbol.emoji() === emoji)
    );
  }
}
