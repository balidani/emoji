import {
  Symbol, Empty, Dollar, Coin,
  Clover, CrystalBall, BullsEye,
  Egg, Chick, Chicken, Dragon, Fox,
  Cherry, Diamond, Bell, MusicalNote,
  Volcano, Rock, Worker
} from './symbol.js';
import * as Util from './util.js'

class Inventory {
  constructor(symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector('.inventory');
    this.money = 10;
  }
  update(game) {
    this.symbolsDiv.replaceChildren();
    const map = new Map();
    map.set(Dollar.instance().name, game.inventory.money);
    this.symbols.forEach((symbol) => {
      if (!map.has(symbol.name)) {
        map.set(symbol.name, 0);
      }
      map.set(symbol.name, map.get(symbol.name) + 1);
    });
    map.forEach((count, symbol) => {
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('inventoryEntry');
      symbolDiv.innerText = symbol;
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
  }
  add(symbol) {
    this.symbols.push(symbol);
  }
  async addMoney(value) {
    this.money += value;
    this.update(game);
  }
}

class Shop {
  constructor() {
    this.shopDiv = document.querySelector('.shop');
    this.catalog = [
      new Coin(),
      new Cherry(), new Bell(), new Diamond(), 
      new Volcano(), new Rock(), new Worker(),
      new Egg(), new Chicken(), new Fox(),
      new Clover(), new CrystalBall(), new BullsEye()
    ];
    this.isOpen = false;
  }
  async open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.shopDiv.replaceChildren();
    const newCatalog = [...this.catalog];
    for (let i = 0; i < 3; ++i) {
      const symbol = Util.randomRemove(newCatalog);
      const shopItemDiv = document.createElement('div');
      shopItemDiv.classList.add('shopItem');
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('cell');
      symbolDiv.innerText = symbol.name;
      shopItemDiv.appendChild(symbolDiv);
      const descriptionDiv = document.createElement('div');
      descriptionDiv.classList.add('description');
      descriptionDiv.innerHTML = symbol.description();
      shopItemDiv.appendChild(descriptionDiv);
      const buyDiv = document.createElement('div');
      buyDiv.classList.add('buy');
      const buyButton = document.createElement('button');
      buyButton.classList.add('buyButton');
      buyButton.innerText = '✅';
      buyButton.addEventListener('click', async () => {
        game.inventory.add(symbol);
        game.inventory.update(game);
        await game.shop.close();
      });
      buyDiv.appendChild(buyButton);
      shopItemDiv.appendChild(buyDiv);
      this.shopDiv.appendChild(shopItemDiv);
    }
    await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close() {
    if (!this.isOpen) {
      return;
    }
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }

}

class Board {
  constructor() {
    this.cells = [];
    const empty = Empty.instance();
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      const row = [];
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        row.push(empty);
      }
      this.cells.push(row);
    }
    this.gridDiv = document.getElementById('grid');
  }
  getSymbolDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[0];
  }
  async spinDiv(x, y, symbol) {
    await Util.delay(Util.random(600));
    const div = this.getSymbolDiv(x, y);
    const randomSymbol = () => {
      const set = new Set();
      // set.add(Empty.instance().name);
      for (const symbol of Object.values(game.inventory.symbols)) {
        set.add(symbol.name);
      }
      div.innerText = Util.randomChoose([...set]);
    }
    await Util.animate(div, 'startSpin', 0.1);
    for (let i = 0; i < 6; ++i) {
      randomSymbol();
      await Util.animate(div, 'spin', 0.12 + i * 0.02);
    }
    div.innerText = symbol.name;
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
  }
  async spinDivOnce(x, y) {
    const div = this.getSymbolDiv(x, y);
    await Util.animate(div, 'startSpin', 0.1);
    div.innerText = this.cells[y][x].name;
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
  }
  async roll(inventory) {
    const symbols = [...inventory.symbols];
    const empties = [];
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        empties.push([j, i]);
        this.cells[i][j] = Empty.instance();
      }
    }
    for (let i = 0; i < Util.BOARD_SIZE * Util.BOARD_SIZE; ++i) {
      if (symbols.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(symbols)
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }
    const tasks = [];
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        tasks.push(
          this.spinDiv(j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  async evaluate() {
    const sideEffects = [];
    const tasks = [];
    this.forAllCells((cell, x, y) => tasks.push(cell.evaluate(game, x, y)));
    for (const task of tasks) {
      await task;
    }
  }
  async score() {
    let total = 0;
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        const cellScore = await cell.score(game, x, y);
        total += cellScore;
      });
    })
    for (const task of tasks) {
      await task();
    }
    return total;
  }
  forAllCells(f) {
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        f(cell, x, y);
      });
    });
  }
}

class Game {
  constructor() {
    this.inventory = new Inventory([
      new Coin(), new Cherry(), new Cherry(), new Cherry(),
    ]);
    this.inventory.update(this);
    this.board = new Board();
    this.shop = new Shop();
    this.rolling = false;
  }
  async roll() {
    if (this.rolling) {
      return;
    }
    this.rolling = true;
    if (this.inventory.money > 0) {
      this.inventory.addMoney(-1);
      await this.shop.close();
      await this.board.roll(this.inventory);
      await this.board.evaluate();
      await this.board.score();
      await this.shop.open(this);
    }
    this.rolling = false;
  }
}

const game = new Game();

document.getElementById('roll')
  .addEventListener('click', () => game.roll());

