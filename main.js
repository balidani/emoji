import * as Util from './util.js'
import { GameSettings } from './game_settings.js'
import { Catalog } from './catalog.js';
import { Board } from './board.js';

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
  constructor(catalog) {
    this.catalog = catalog;
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
    luck += checkLuckyItem('🍀', 0.01);
    luck += checkLuckyItem('🔮', 0.03);

    this.shopDiv.replaceChildren();
    const newCatalog = this.catalog.generateShop(3, luck);

    const makeShopItem = (symbol, description, descriptionLong, handler, refresh=false) => {
      const shopItemDiv = document.createElement('div');
      shopItemDiv.classList.add('shopItem');
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('cell');
      symbolDiv.innerText = symbol;
      symbolDiv.addEventListener('click', () => {
        Util.drawText(game.info, descriptionLong);
      });
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
      const shopItemDiv = makeShopItem(symbol.name(), symbol.description(), symbol.descriptionLong(), 
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
        const shopItemDiv = makeShopItem('', '💵' + this.refreshCost, '',
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

class Game {
  constructor(gameSettings, catalog) {
    this.gameSettings = gameSettings;
    this.catalog = catalog;
    this.inventory = new Inventory(this.catalog.symbolsFromString(this.gameSettings.startingSet));
    this.inventory.update();
    this.board = new Board(this.gameSettings, this.catalog);
    this.shop = new Shop(this.catalog);
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
    // blurDiv.classList.add('blur');
    // await Util.animate(blurDiv, 'blurStart', 0.6);
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
    if (this.inventory.money >= 25000) {
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
    if (this.rolling) {
      Util.animationOff();
      return;
    } else {
      Util.animationOn();
    }
    this.rolling = true;

    Util.deleteText(this.info);
    switch (this.inventory.turns) {
      case 50:
        Util.drawText(this.info, 'you can add a symbol to your inventory. press (✅) to do that, refresh the shop (🔀), or roll again.');
        break;
      case 49:
        Util.drawText(this.info, 'you have 48 turns left. earn 💵10000 for 🥉, 💵15000 for 🥈, 💵20000 for 🥇, 💵25000 for 🏆. good luck!');
        break;
      case 48:
        Util.drawText(this.info, 'you can double tap the roll (🕹️) button to skip animation.');
        break;
      case 47:
        Util.drawText(this.info, 'you can tap on any symbol, on the board or in the shop, to get more information.');
        break;
      default:
        break;
    }

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
    
    this.rolling = false;
  }
}

export const load = async (gameSettings) => {
  document.querySelector('body').removeEventListener(
    'click', load);
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);
  gameSettings = gameSettings || new GameSettings();
  // TODO: This is probably a sign of a bug: but the simple fix is this next line:
  gameSettings.isOpen = false;
  const catalog = new Catalog(gameSettings.symbolSources)
  await catalog.updateSymbols();
  const game = new Game(gameSettings, catalog);
  GameSettings.loadFn = load
  return game;
};

class AutoGame {
  constructor(startingSet, buyAlways, buyOnce) {
    this.inventory = new Inventory(startingSet);
    this.inventory.update();
    this.board = new Board();
    this.shop = new Shop();
    totalTurns = 0;
    this.scores = [];
    this.isOver = false;

    this.buyAlways = new Set(buyAlways);
    this.buyOnce = buyOnce;
    this.symbolLimit = 1000;
  }
  async over() {
    this.isOver = true;
    await this.board.finalScore(this);
  }
  async roll() {
    if (this.isOver) {
      return;
    }
    if (this.inventory.money > 0) {
      this.inventory.turns--;
      this.inventory.updateUi();
      this.inventory.addMoney(-1);
      this.inventory.symbols.forEach(s => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      await this.shop.open(this);
    } else {
      await this.over();
      return;
    }

    // Choose item to buy
    if (this.inventory.symbols.length < this.symbolLimit) {
      const tryOnce = (first) => {
        const buttons = Array.from(document.getElementsByClassName('buyButton'));
        const refreshButton = buttons.splice(3, 1)[0];
        let bought = false;
        const tryBuy = (sym) => {
          for (const button of buttons) {
            if (button.parentElement.parentElement.children[0].innerText === sym.name) {
              button.click();
              return true;
            }
          }
          return false;
        };
        for (let i = 0; i < this.buyOnce.length; ++i) {
          bought |= tryBuy(this.buyOnce[i]);
          if (bought) {
            this.buyOnce.splice(i, 1);
            return true;
          }
        }
        for (const sym of this.buyAlways) {
          bought |= tryBuy(sym);
          if (bought) {
            return true;
          }
        }
        if (first && !bought && refreshButton !== undefined) {
          refreshButton.click();
        }
        return false;
      }
      if (!tryOnce(/*first=*/true)) {
        tryOnce(/*first=*/false);
      }
    }
    if (this.inventory.turns <= 0) {
      await this.over();
    }
    totalTurns++;
  }
  async simulate() {
    for (let i = 0; i < 200 && !this.isOver; ++i) {
      await this.roll();
    }
  }
}

const simulate = async (buyAlways, buyOnce, rounds=200) => {
  Util.toggleAnimation();

  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);

  const scores = [];
  let over10k = 0;
  let over15k = 0;
  let over20k = 0;

  const simulateGameSettings = GameSettings()
  // example: simulateGameSettings.startingSet = "🔮🔮🪙🪙🪙"

  for (let i = 0; i < rounds; ++i) {
    const catalog = new Catalog(simulateGameSettings.symbolSources)
    const game = new AutoGame(catalog.symbolsFromString(simulateGameSettings.startingSet), buyAlways, [...buyOnce]);
    await game.simulate();
    const score = game.inventory.money;
    scores.push(score);
    const avg = scores.reduce((acc, val) => acc + val, 0) / scores.length | 0;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    console.log(`${i}\tscore ${score}\tavg ${avg}\tmax ${max}`);
    if (totalTurns === 200) {
      console.log('inf!');
    }
    if (score > 10000) {
      over10k++;
    }
    if (score > 15000) {
      over15k++;
    }
    if (score > 20000) {
      over20k++;
    }
  }
  console.log(over10k, over15k, over20k);
};

load();
