import {
  Symbol, Empty,
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
  Grave,
  Hole,
  MagicWand,
  Mango,
  MoneyBag,
  Moon,
  Multiplier,
  MusicalNote,
  Pineapple,
  Popcorn,
  Record,
  Refresh,
  Rock,
  Rocket,
  ShoppingBag,
  Slots,
  Tree,
  Volcano,
  Worker,
} from './symbol.js';
import * as Util from './util.js'

const makeCatalog = () => [
  new Balloon(),
  new Bank(),
  new Bell(),
  // new Bomb(),
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
  // new Firefighter(),
  new Fox(),
  // new FreeTurn(),
  // new Grave(),
  new Hole(),
  new MagicWand(),
  new Mango(),
  new MoneyBag(),
  new Moon(),
  new Multiplier(),
  new Pineapple(),
  new Record(),
  new Refresh(),
  new Rock(),
  new Rocket(),
  new ShoppingBag(),
  new Slots(),
  new Tree(),
  // new Volcano(),
  new Worker(),
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
    this.symbolsDiv = document.querySelector('.game .inventory');
    this.uiDiv = document.querySelector('.game .ui');
    this.money = 1;
    this.turns = 50;
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
      symbolDiv.innerText = '💵';
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = this.money;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    }
    {
      const symbolDiv = document.createElement('div');
      symbolDiv.innerText = '⏰';
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = this.turns;
      symbolDiv.appendChild(countSpan);
      this.uiDiv.appendChild(symbolDiv);
    }
  }
}

class Shop {
  constructor() {
    this.shopDiv = document.querySelector('.game .shop');
    this.isOpen = false;
    this.refreshCost = 1;
    this.refreshCount = 0;
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
    luck += checkLuckyItem(Clover.name, 0.01);
    luck += checkLuckyItem(CrystalBall.name, 0.03);

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
            await game.shop.close(game);
          }
      });
      this.shopDiv.appendChild(shopItemDiv);
    }

    // Refresh
    if (game.inventory.money > this.refreshCost) {
      if (game.shop.refreshable || game.shop.refreshCount === 0) {
        const shopItemDiv = makeShopItem('', '💵' + this.refreshCost,
          async () => {
            game.shop.refreshCount++;
            if (game.inventory.money > 0) {
              game.inventory.addMoney(-this.refreshCost);
              this.refreshCost *= 2;
              this.isOpen = false;
              this.open(game);
            }
        }, /*refresh=*/true);
        this.shopDiv.appendChild(shopItemDiv);
      }
    }

    await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close(game) {
    if (!this.isOpen) {
      return;
    }
    this.refreshable = false;
    this.refreshCost = 1 + (game.inventory.money * 0.01) | 0;
    this.refreshCount = 0;

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
    this.gridDiv = document.querySelector('.game .grid');
    this.gridDiv.replaceChildren();
    for (let i = 0; i < Util.BOARD_SIZE; ++i) {
      const row = [];
      const rowDiv = document.createElement('div');
      rowDiv.classList.add('row');
      for (let j = 0; j < Util.BOARD_SIZE; ++j) {
        row.push(new Empty());
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        const symbolDiv = document.createElement('div');
        symbolDiv.classList.add('symbol');
        symbolDiv.innerText = '⬜';
        const counterDiv = document.createElement('div');
        counterDiv.classList.add('symbolCounter');
        counterDiv.innerText = '';
        cellDiv.appendChild(symbolDiv);
        cellDiv.appendChild(counterDiv);
        rowDiv.appendChild(cellDiv);
      }
      this.cells.push(row);
      this.gridDiv.appendChild(rowDiv);
    }
  }
  getSymbolDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[0];
  }
  updateCounter(game, x, y) {
    const counterDiv = this.gridDiv.children[y].children[x].children[1];
    const counter = this.cells[y][x].counter(game);
    if (counter !== null) {
      counterDiv.innerText = counter;
    }
  }
  getCounterDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[1];
  }
  async showMoneyEarned(x, y, value) {
    const moneyDiv = document.createElement('div');
    moneyDiv.classList.add('moneyEarned');
    moneyDiv.innerText = `💵${value}`;
    this.gridDiv.appendChild(moneyDiv);

    await Util.animate(moneyDiv, 'fadeOutMoveDown', 0.3);
    this.gridDiv.removeChild(moneyDiv);
  }
  clearCell(x, y) {
    this.getCounterDiv(x, y).innerText = '';
    this.cells[y][x] = new Empty();
  }
  async spinDiv(game, x, y, symbol) {
    await Util.delay(Util.random(600));
    const div = this.getSymbolDiv(x, y);
    const counterDiv = this.getCounterDiv(x, y);
    counterDiv.innerText = '';
    const randomSymbol = () => {
      const set = new Set();
      for (const symbol of Object.values(game.inventory.symbols)) {
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
    if (symbol.counter(game) != null) {
      counterDiv.innerText = symbol.counter(game);
    }
  }
  async spinDivOnce(game, x, y) {
    const div = this.getSymbolDiv(x, y);
    const counterDiv = this.getCounterDiv(x, y);
    counterDiv.innerText = '';
    await Util.animate(div, 'startSpin', 0.1);
    const symbol = this.cells[y][x];
    div.innerText = symbol.name();
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
    if (symbol.counter(game) != null) {
      counterDiv.innerText = symbol.counter(game);
    }
  }
  async roll(game) {
    const symbols = [...game.inventory.symbols];
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
          this.spinDiv(game, j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  async evaluate(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => tasks.push(
      async () => { 
        // If the symbol has since been removed from the board, do not evaluate.
        if (this.cells[y][x] !== cell) {
          return;
        }
        await cell.evaluate(game, x, y);
      } ));
    for (const task of tasks) {
      await task();
    }
    this.forAllCells((cell, x, y) => {
      this.updateCounter(game, x, y);
    });
  }
  async finalScore(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        await cell.finalScore(game, x, y);
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
        await cell.score(game, x, y);
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
  async addSymbol(game, sym, x, y) {
    game.inventory.add(sym);
    if (this.cells[y][x].name() === Hole.name) {
      const hole = this.cells[y][x];
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
      this.cells[y][x] = hole;
      await this.spinDivOnce(game, x, y);
    } else {
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
    }
    this.updateCounter(game, x, y);
  }
  async removeSymbol(game, x, y) {
    game.inventory.remove(this.cells[y][x]);
    this.clearCell(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'flip', 0.15);
    await this.spinDivOnce(game, x, y);
  }
}

class Game {
  constructor() {
    this.inventory = new Inventory(startingSet());
    this.inventory.update();
    this.board = new Board();
    this.shop = new Shop();
    this.rolling = false;
    this.info = document.querySelector('.game .info');
    Util.drawText(this.info, "hi there. press (🕹️) when you are ready to play.");
    document.querySelector('.game .roll')
      .addEventListener('click', () => this.roll());
    console.log(this);
  }
  async over() {
    document.querySelector('.game .roll').disabled = true;
    await this.board.finalScore(this);
    const blurDiv = document.querySelector('.game .blur-me');
    blurDiv.classList.add('blur');
    await Util.animate(blurDiv, 'blurStart', 0.6);
    {
      const scoreContainer = document.createElement('div');
      scoreContainer.classList.add('scoreContainer');
      const scoreDiv = document.createElement('div');
      scoreDiv.classList.add('score');
      scoreDiv.innerText = '💵' + this.inventory.money;
      scoreContainer.appendChild(scoreDiv);
      document.querySelector('.game').appendChild(scoreContainer);
      await Util.animate(scoreDiv, 'scoreIn', 0.4);
    }
    let trophy = null;
    if (this.inventory.money >= 30000) {
      trophy = '🏆';
    } else if (this.inventory.money >= 20000) {
      trophy = '🥇';
    } else if (this.inventory.money >= 15000) {
      trophy = '🥈';
    } else if (this.inventory.money >= 10000) {
      trophy = '🥉';
    } else {
      trophy = '💩';
    }
    {
      const trophyContainer = document.createElement('div');
      trophyContainer.classList.add('scoreContainer');
      const trophyDiv = document.createElement('div');
      trophyDiv.classList.add('trophy');
      trophyDiv.innerText = trophy;
      trophyContainer.appendChild(trophyDiv);
      document.querySelector('.game').appendChild(trophyContainer);
      await Util.animate(trophyDiv, 'scoreIn', 0.4);
    }
    document.querySelector('body').addEventListener(
      'click', load);
  }
  async roll() {
    Util.deleteText(this.info);
    if (this.rolling) {
      Util.animationOff();
      return;
    } else {
      Util.animationOn();
    }
    this.rolling = true;
    if (this.inventory.money > 0) {
      this.inventory.turns--;
      this.inventory.updateUi();
      this.inventory.addMoney(-1);
      this.inventory.symbols.forEach(s => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
    } else {
      // Handle the case where player ran out of money
    }
    if (this.inventory.turns === 0) {
      await this.over();
    } else {
      await this.shop.open(this);
    }
    if (this.inventory.turns === 49) {
      Util.drawText(this.info, 'you can add a symbol to your inventory. press (✅) to do that, refresh the shop (🔀), or roll again.');
    } else if (this.inventory.turns === 48) {
      Util.drawText(this.info, 'you have 48 turns left. earn 💵10000 for 🥉, 💵15000 for 🥈, 💵20000 for 🥇, 💵30000 for 🏆. good luck!');
    }
    this.rolling = false;
  }
}

const load = () => {
  document.querySelector('body').removeEventListener(
    'click', load);
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);
  const game = new Game();
};
load();

// class AutoGame {
//   constructor() {
//     this.inventory = new Inventory(startingSet());
//     this.inventory.update();
//     this.board = new Board();
//     this.shop = new Shop();
//     totalTurns = 0;
//     this.scores = [];
//     this.isOver = false;

//     this.allowed = new Set([
//       Multiplier,
//     ]);
//     this.buyOnce = [
//       Record, Bug, Drums, Drums, Drums, Bell, Bell, Bell, BullsEye, Rocket, CrystalBall, MagicWand
//     ];
//     this.symbolLimit = 1000;
//   }
//   async over() {
//     this.isOver = true;
//     await this.board.finalScore(this);
//   }
//   async roll() {
//     if (this.isOver) {
//       return;
//     }
//     if (this.inventory.money > 0) {
//       this.inventory.turns--;
//       this.inventory.updateUi();
//       this.inventory.addMoney(-1);
//       this.inventory.symbols.forEach(s => s.reset());
//       await this.shop.close(this);
//       await this.board.roll(this);
//       await this.board.evaluate(this);
//       await this.board.score(this);
//       await this.shop.open(this);
//     } else {
//       await this.over();
//       return;
//     }

//     // Choose item to buy
//     if (this.inventory.symbols.length < this.symbolLimit) {
//       const tryOnce = (first) => {
//         const buttons = Array.from(document.getElementsByClassName('buyButton'));
//         const refreshButton = buttons.splice(3, 1)[0];
//         let bought = false;
//         const tryBuy = (sym) => {
//           for (const button of buttons) {
//             if (button.parentElement.parentElement.children[0].innerText === sym.name) {
//               button.click();
//               return true;
//             }
//           }
//           return false;
//         };
//         for (let i = 0; i < this.buyOnce.length; ++i) {
//           bought |= tryBuy(this.buyOnce[i]);
//           if (bought) {
//             this.buyOnce.splice(i, 1);
//             return true;
//           }
//         }
//         for (const sym of this.allowed) {
//           bought |= tryBuy(sym);
//           if (bought) {
//             return true;
//           }
//         }
//         if (first && !bought && refreshButton !== undefined) {
//           refreshButton.click();
//         }
//         return false;
//       }
//       if (!tryOnce(/*first=*/true)) {
//         tryOnce(/*first=*/false);
//       }
//     }
//     if (this.inventory.turns <= 0) {
//       await this.over();
//     }
//     totalTurns++;
//   }
//   async simulate() {
//     for (let i = 0; i < 200 && !this.isOver; ++i) {
//       await this.roll();
//     }
//   }
// }
// Util.toggleAnimation();
// const run = async () => {
//   const scores = [];
//   let over10k = 0;
//   let over15k = 0;
//   let over20k = 0;
//   for (let i = 0; i < 200; ++i) {
//     const game = new AutoGame();
//     await game.simulate();
//     const score = game.inventory.money;
//     scores.push(score);
//     const avg = scores.reduce((acc, val) => acc + val, 0) / scores.length | 0;
//     const max = Math.max(...scores);
//     const min = Math.min(...scores);
//     console.log(`${i}\tscore ${score}\tavg ${avg}\tmax ${max}`);
//     if (totalTurns === 200) {
//       console.log('inf!');
//     }
//     if (score > 10000) {
//       over10k++;
//     }
//     if (score > 15000) {
//       over15k++;
//     }
//     if (score > 20000) {
//       over20k++;
//     }
//   }
//   console.log(over10k, over15k, over20k);
// };
// await run();
