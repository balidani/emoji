import {
  Symbol, Empty, Dollar,
  Balloon,
  Bank,
  Bell,
  Bomb,
  Briefcase,
  Bug,
  BullsEye,
  Cherry,
  Chick,
  Chicken,
  Clover,
  Cocktail,
  Coin,
  Corn,
  CreditCard,
  CrystalBall,
  Dancer,
  Diamond,
  Dice,
  Dragon,
  Drums,
  Egg,
  Firefighter,
  Fox,
  FreeTurn,
  Slots,
  Grave,
  MagicWand,
  Mango,
  MoneyBag,
  Multiplier,
  MusicalNote,
  Pineapple,
  Popcorn,
  Record,
  Refresh,
  Rock,
  Rocket,
  ShoppingBag,
  Tree,
  Volcano,
  Worker,
} from './symbol.js';
import * as Util from './util.js'

const makeCatalog = () => [
  new Balloon(),
  new Bank(),
  new Bell(),
  new Bomb(),
  new Briefcase(),
  new Bug(),
  new BullsEye(),
  new Cherry(),
  new Chick(),
  new Chicken(),
  new Clover(),
  new Cocktail(),
  new Coin(),
  new Corn(),
  new CreditCard(),
  new CrystalBall(),
  new Dancer(),
  new Diamond(),
  new Dice(),
  new Dragon(),
  new Drums(),
  new Egg(),
  new Firefighter(),
  new Fox(),
  new FreeTurn(),
  new Slots(),
  new Grave(),
  new MagicWand(),
  new Mango(),
  new MoneyBag(),
  new Multiplier(),
  new Pineapple(),
  new Record(),
  new Refresh(),
  new Rock(),
  new Rocket(),
  new ShoppingBag(),
  new Tree(),
  // new Volcano(),
  // new Worker(),
];

const startingSet = () => [
  new Coin(),
  new Cherry(),
  new Cherry(),
  new Cherry(),
];

// Test
makeCatalog().forEach(s => s.copy());
let totalTurns = 0;

class Inventory {
  constructor(symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector('.inventory');
    this.uiDiv = document.querySelector('.ui');
    this.money = 1;
    this.turns = 99;
    this.updateUi();
    this.graveyard = [];
  }
  update() {
    this.symbolsDiv.replaceChildren();
    const map = new Map();
    this.symbols.forEach((symbol) => {
      const name = symbol.name();
      if (!map.has(name)) {
        map.set(name, 0);
      }
      map.set(name, map.get(name) + 1);
    });
    map.forEach((count, name) => {
      const symbolDiv = document.createElement('div');
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
  updateUi() {
    this.uiDiv.replaceChildren();
    {
      const symbolDiv = document.createElement('div');
      symbolDiv.innerText = '⏰';
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = this.turns;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    }
    {
      const symbolDiv = document.createElement('div');
      symbolDiv.innerText = Dollar.name;
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = this.money;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    }
  }
}

class Shop {
  constructor() {
    this.shopDiv = document.querySelector('.shop');
    this.isOpen = false;
    this.refreshCost = 1;
    this.refreshable = false;
    this.buyCount = 1;
  }
  async open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;

    const checkLuckyItem = (name, percent) => {
      let total = 0;
      game.board.forAllCells((cell, x, y) => {
        if (cell.name() === name) {
          total += percent;
        }
      });
      return total;
    };
    let luck = 0;
    luck += checkLuckyItem(Clover.name, 0.02);
    luck += checkLuckyItem(CrystalBall.name, 0.05);

    this.shopDiv.replaceChildren();
    this.catalog = makeCatalog();
    const newCatalog = [];
    while (newCatalog.length < 3) {
      for (const item of this.catalog) {
        if (Math.random() < item.rarity + luck) {
          newCatalog.push(item);
        }
      }
    }

    const makeShopItem = (symbol, description, handler, refresh=false) => {
      const shopItemDiv = document.createElement('div');
      shopItemDiv.classList.add('shopItem');
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('cell');
      symbolDiv.innerText = symbol;
      shopItemDiv.appendChild(symbolDiv);
      const descriptionDiv = document.createElement('div');
      descriptionDiv.classList.add('description');
      if (refresh) {
        descriptionDiv.classList.add('refreshDescription');
      }
      descriptionDiv.innerHTML = description;
      shopItemDiv.appendChild(descriptionDiv);
      const buyDiv = document.createElement('div');
      buyDiv.classList.add('buy');
      const buyButton = document.createElement('button');
      buyButton.classList.add('buyButton');
      buyButton.innerText = refresh ? '🔀' : '✅';
      buyButton.addEventListener('click', handler);
      buyDiv.appendChild(buyButton);
      shopItemDiv.appendChild(buyDiv);
      return shopItemDiv;
    }
    for (let i = 0; i < 3; ++i) {
      const symbol = Util.randomRemove(newCatalog);
      const shopItemDiv = makeShopItem(symbol.name(), symbol.description(),
        async (e) => {
          if (game.shop.buyCount > 0) {
            game.shop.buyCount--;
            game.inventory.add(symbol);
          }
          if (game.shop.buyCount > 0) {
            const div = e.srcElement.parentElement.parentElement;
            await Util.animate(div, 'closeShop', 0.2);
            div.parentElement.removeChild(div);
          }
          if (game.shop.buyCount === 0) {
            await game.shop.close();
          }
      });
      this.shopDiv.appendChild(shopItemDiv);
    }

    if (this.refreshable) {
      const shopItemDiv = makeShopItem('', '💵' + this.refreshCost,
        async () => {
        if (game.inventory.money > 0) {
          game.inventory.addMoney(-this.refreshCost);
          this.refreshCost *= 2;
          this.isOpen = false;
          this.open(game);
        }
      }, /*refresh=*/true);
      this.shopDiv.appendChild(shopItemDiv);
    }

    await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close() {
    if (!this.isOpen) {
      return;
    }
    this.refreshable = false;
    this.buyCount = 1;
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }

}

class Board {
  constructor() {
    this.cells = [];
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      const row = [];
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        row.push(new Empty());
      }
      this.cells.push(row);
    }
    this.gridDiv = document.getElementById('grid');
  }
  getSymbolDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[0];
  }
  async spinDiv(inventory, x, y, symbol) {
    await Util.delay(Util.random(600));
    const div = this.getSymbolDiv(x, y);
    const randomSymbol = () => {
      const set = new Set();
      for (const symbol of Object.values(inventory.symbols)) {
        set.add(symbol.name());
      }
      div.innerText = Util.randomChoose([...set]);
    }
    await Util.animate(div, 'startSpin', 0.1);
    for (let i = 0; i < 6; ++i) {
      randomSymbol();
      await Util.animate(div, 'spin', 0.12 + i * 0.02);
    }
    div.innerText = symbol.name();
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
  }
  async spinDivOnce(x, y) {
    const div = this.getSymbolDiv(x, y);
    await Util.animate(div, 'startSpin', 0.1);
    div.innerText = this.cells[y][x].name();
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
  }
  async roll(inventory) {
    const symbols = [...inventory.symbols];
    const empties = [];
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        empties.push([j, i]);
        this.cells[i][j] = new Empty();
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
          this.spinDiv(inventory, j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  async evaluate(game) {
    const sideEffects = [];
    const tasks = [];
    this.forAllCells((cell, x, y) => tasks.push(async () => { cell.evaluate(game, x, y); } ));
    for (const task of tasks) {
      await task();
    }
  }
  async finalScore(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        // const before = game.inventory.money;
        await cell.finalScore(game, x, y);
        // const after = game.inventory.money;
        // console.log(cell.name(), after - before);
      });
    })
    for (const task of tasks) {
      await task();
    }
  }
  async score(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        // const before = game.inventory.money;
        await cell.score(game, x, y);
        // const after = game.inventory.money;
        // console.log(cell.name(), after - before);
      });
    })
    for (const task of tasks) {
      await task();
    }
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
    this.inventory = new Inventory(startingSet());
    this.inventory.update();
    this.board = new Board();
    this.shop = new Shop();
    this.rolling = false;
  }
  async over() {
    await this.board.finalScore(this);
    const blurDiv = document.querySelector('.blur-me');
    blurDiv.classList.add('blur');
    await Util.animate(blurDiv, 'blurStart', 0.4);
    const scoreDiv = document.createElement('div');
    scoreDiv.classList.add('score');
    scoreDiv.innerText = '💵' + this.inventory.money;
    document.querySelector('body').appendChild(scoreDiv);
    await Util.animate(scoreDiv, 'scoreIn', 0.4);

    console.log(totalTurns);
    // document.getElementById('roll')
  }
  async roll() {
    if (this.rolling) {
      return;
    }
    this.rolling = true;
    this.inventory.turns--;
    this.inventory.updateUi();
    if (this.inventory.money > 0) {
      this.inventory.addMoney(-1);
      this.inventory.symbols.forEach(s => s.reset());
      await this.shop.close();
      await this.board.roll(this.inventory);
      await this.board.evaluate(this);
      await this.board.score(this);
      await this.shop.open(this);
    }
    this.rolling = false;
    if (this.inventory.turns === 0) {
      await this.over();
    }
    totalTurns++;
  }
}

const game = new Game();
document.getElementById('roll')
  .addEventListener('click', () => game.roll());
console.log(game);

// class AutoGame {
//   constructor() {
//     this.inventory = new Inventory(startingSet());
//     this.inventory.update();
//     this.board = new Board();
//     this.shop = new Shop();
//     this.rolling = false;
//     totalTurns = 0;
//     this.scores = [];
//     this.isOver = false;

//     this.allowed = new Set([
//       Multiplier,
//     ]);
//     this.buyOnce = [
//     ];
//     this.symbolLimit = 1000;
//   }
//   async over() {
//     this.isOver = true;
//     await this.board.finalScore(this);
//     const blurDiv = document.querySelector('.blur-me');
//     blurDiv.classList.add('blur');
//     await Util.animate(blurDiv, 'blurStart', 0.4);
//     const scoreDiv = document.createElement('div');
//     scoreDiv.classList.add('score');
//     scoreDiv.innerText = '💵' + this.inventory.money;
//     document.querySelector('body').appendChild(scoreDiv);
//     await Util.animate(scoreDiv, 'scoreIn', 0.4);

//     document.getElementById('roll')
//   }
//   async roll() {
//     if (this.rolling || this.isOver) {
//       return;
//     }
//     this.rolling = true;
//     this.inventory.turns--;
//     this.inventory.updateUi();
//     if (this.inventory.money > 0) {
//       this.inventory.addMoney(-1);
//       this.inventory.symbols.forEach(s => s.reset());
//       await this.shop.close();
//       await this.board.roll(this.inventory);
//       await this.board.evaluate(this);
//       await this.board.score(this);
//       await this.shop.open(this);
//     }

//     // Choose from item to buy
//     if (this.inventory.symbols.length < this.symbolLimit) {
//       const buttons = document.getElementsByClassName('buyButton');
//       let bought = false;
//       const tryBuy = (sym) => {
//         for (const button of buttons) {
//           if (button.parentElement.parentElement.children[0].innerText === sym.name) {
//             if (!bought) {
//               button.click();
//               bought = true;
//               // console.log('bought', sym.name)
//             }
//           }
//         }
//       };
//       for (let i = 0; i < this.buyOnce.length; ++i) {
//         tryBuy(this.buyOnce[i]);
//         if (bought) {
//           this.buyOnce.splice(i, 1);
//         }
//       }
//       for (const sym of this.allowed) {
//         tryBuy(sym);
//       }
//     }
//     this.rolling = false;
//     if (this.inventory.turns === 0) {
//       await this.over();
//     }
//     totalTurns++;
//   }
//   async simulate() {
//     for (let i = 0; i < 4000; ++i) {
//       await this.roll();
//     }
//   }
// }

// // const game = new AutoGame();
// // await game.simulate();

// const run = async () => {
//   const scores = [];
//   for (let i = 0; i < 20; ++i) {
//     const game = new AutoGame();
//     await game.simulate();
//     scores.push(game.inventory.money);
//     const avg = scores.reduce((acc, val) => acc + val, 0) / scores.length | 0;
//     const max = Math.max(...scores);
//     const min = Math.min(...scores);
//     console.log(`${i}\tavg ${avg}\tmax ${max}\tmin ${min}\tturns ${totalTurns}`);
//   }
// };
// await run();
