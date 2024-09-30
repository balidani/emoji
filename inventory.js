import * as Util from './util.js';

export class Inventory {
  constructor(turns, symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector('.game .inventory');
    this.uiDiv = document.querySelector('.game .ui');
    this.infoDiv = document.querySelector('.info');
    this.money = 1;
    this.luckBonus = 0;
    this.lastLuckBonus = 0;
    this.turns = turns;
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
        Util.drawText(this.infoDiv, `${name}: ${description}`);
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
  async addMoney(value) {
    this.money += value;
    this.updateUi();
  }
  addLuck(bonus) {
    this.luckBonus += bonus;
    // Not needed!
    // resetLuck is the function to call when luck calculation finished in last turn's Board::score.
    // We technically always use last turn's luck to avoid another round of scoring.
    // this.updateUi();
  }
  resetLuck() {
    this.lastLuckBonus = this.luckBonus;
    this.luckBonus = 0;
    this.updateUi();
  }
  updateUi() {
    this.uiDiv.replaceChildren();
    const displayKeyValue = (key, value) => {
      const symbolDiv = document.createElement('div');
      symbolDiv.innerText = key;
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = value;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    };
    displayKeyValue('💵', this.money);
    displayKeyValue('⏰', this.turns);
    displayKeyValue('🍀', (this.lastLuckBonus * 100) | 0);
  }
  // Note: This does NOT return a Symbol. It returns an emoji text character for animation purposes.
  getRandomOwnedEmoji() {
    return Util.randomChoose(this.symbols).emoji();
  }
}
