import * as Util from './util.js';
import { GameSettings } from './game_settings.js';
import { Catalog } from './catalog.js';
import { Board } from './board.js';

class Inventory {
  constructor(turns, symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector(".game .inventory");
    this.uiDiv = document.querySelector(".game .ui");
    this.infoDiv = document.querySelector(".info");
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
      const symbolDiv = document.createElement("div");
      symbolDiv.addEventListener("click", (e) => {
        Util.drawText(this.infoDiv, `${name}: ${description}`);
      });
      symbolDiv.classList.add("inventoryEntry");
      symbolDiv.innerText = name;

      const countSpan = document.createElement("span");
      countSpan.classList.add("inventoryEntryCount");
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

    this.shopDiv.replaceChildren();
    const newCatalog = this.catalog.generateShop(
      3,
      game.inventory.lastLuckBonus
    );

    const makeShopItem = (
      symbol,
      description,
      descriptionLong,
      handler,
      refresh = false
    ) => {
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
    };
    for (let i = 0; i < 3; ++i) {
      const symbol = Util.randomRemove(newCatalog);
      const shopItemDiv = makeShopItem(
        symbol.emoji(),
        symbol.description(),
        symbol.descriptionLong(),
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
        }
      );
      this.shopDiv.appendChild(shopItemDiv);
    }

    // Refresh
    if (game.inventory.money > this.refreshCost) {
      if (game.shop.refreshable || game.shop.refreshCount === 0) {
        const shopItemDiv = makeShopItem(
          '',
          '💵' + this.refreshCost,
          '',
          async () => {
            game.shop.refreshCount++;
            if (game.inventory.money > 0) {
              game.inventory.addMoney(-this.refreshCost);
              this.refreshCost *= 2;
              this.isOpen = false;
              this.open(game);
            }
          },
          /*refresh=*/ true
        );
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
    this.refreshCost = (1 + game.inventory.money * 0.01) | 0;
    this.refreshCount = 0;

    this.buyCount = 1;
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv;
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }
}

class Game {
  constructor(gameSettings, catalog) {
    this.gameSettings = gameSettings;
    this.catalog = catalog;
    this.inventory = new Inventory(
      this.gameSettings.gameLength,
      this.catalog.symbolsFromString(this.gameSettings.startingSet)
    );
    this.inventory.update();
    this.board = new Board(this.gameSettings, this.catalog);
    this.shop = new Shop(this.catalog);
    this.rolling = false;
    this.info = document.querySelector('.game .info');
    Util.drawText(
      this.info,
      'hi there. press (🕹️) when you are ready to play.'
    );
    document
      .querySelector('.game .roll')
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
    document.querySelector('body').addEventListener('click', loadListener);
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
        Util.drawText(
          this.info,
          'you can add a symbol to your inventory. press (✅) to do that, refresh the shop (🔀), or roll again.'
        );
        break;
      case 49:
        Util.drawText(
          this.info,
          'you have 48 turns left. earn 💵10000 for 🥉, 💵15000 for 🥈, 💵20000 for 🥇, 💵25000 for 🏆. good luck!'
        );
        break;
      case 48:
        Util.drawText(
          this.info,
          'you can double tap the roll (🕹️) button to skip animation.'
        );
        break;
      case 47:
        Util.drawText(
          this.info,
          'you can tap on any symbol, on the board or in the shop, to get more information.'
        );
        break;
      default:
        break;
    }

    if (this.inventory.money > 0) {
      this.inventory.turns--;
      this.inventory.updateUi();
      this.inventory.addMoney(-1);
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      this.inventory.resetLuck();
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

export const loadSettings = async (settings = GameSettings.instance()) => {
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);
  const catalog = new Catalog(settings.symbolSources);
  await catalog.updateSymbols();
  const game = new Game(settings, catalog);
  GameSettings.loadFn = loadSettings;
  return game;
};

export const loadListener = async (event) => {
  document.querySelector('body').removeEventListener('click', loadListener);
  loadSettings(GameSettings.instance());
};

class AutoGame {
  constructor(gameSettings, catalog, buyAlways, buyOnce, buyRandom) {
    this.gameSettings = gameSettings;
    this.catalog = catalog;
    this.inventory = new Inventory(
      gameSettings.gameLength,
      this.catalog.symbolsFromString(this.gameSettings.startingSet)
    );
    this.inventory.update();
    this.board = new Board(this.gameSettings, this.catalog);
    this.shop = new Shop(this.catalog);
    this.totalTurns = 0;
    this.buyAlways = new Set(buyAlways);
    this.buyOnce = buyOnce;
    this.buyRandom = buyRandom;
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
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      await this.shop.open(this);
      this.inventory.resetLuck();
    } else {
      await this.over();
      return;
    }

    if (this.buyRandom) {
      Array.from(document.getElementsByClassName('buyButton'))[
        Util.random(3)
      ].click();
    } else {
      // Choose item to buy
      if (this.inventory.symbols.length < this.symbolLimit) {
        const tryOnce = () => {
          const buttons = Array.from(
            document.getElementsByClassName('buyButton')
          );
          let bought = false;
          const tryBuy = (sym) => {
            for (const button of buttons) {
              if (button.disabled) {
                return true;
              }
              if (
                button.parentElement.parentElement.children[0].innerText ===
                sym.emoji()
              ) {
                button.click();
                button.disabled = true;
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
          return false;
        };
        let buys = this.shop.buyCount;
        while (buys >= 1) {
          if (tryOnce()) {
            buys--;
          } else {
            if (this.inventory.turns <= 10) {
              // No more refresh.
              break;
            }
            const buttons = Array.from(
              document.getElementsByClassName('buyButton')
            );
            const refreshButton = buttons.splice(3, 1)[0];
            if (refreshButton !== undefined) {
              refreshButton.click();
              if ((this.shop.refreshCost >= this.inventory.money / 2) | 0) {
                break;
              }
            } else {
              break;
            }
          }
        }
      }
    }

    if (this.inventory.turns <= 0) {
      await this.over();
    }
    this.totalTurns++;
  }
  async simulate() {
    for (let i = 0; i < 200 && !this.isOver; ++i) {
      await this.roll();
    }
  }
}

window.simulate = async (
  buyAlways,
  buyOnce,
  rounds = 100,
  buyRandom = false
) => {
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

  const settings = GameSettings.instance();

  for (let i = 0; i < rounds; ++i) {
    const catalog = new Catalog(settings.symbolSources);
    await catalog.updateSymbols();
    const game = new AutoGame(
      settings,
      catalog,
      catalog.symbolsFromString(buyAlways),
      catalog.symbolsFromString(buyOnce),
      buyRandom
    );
    await game.simulate();
    const score = game.inventory.money;
    scores.push(score);
    const avg = (scores.reduce((acc, val) => acc + val, 0) / scores.length) | 0;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    console.log(`${i}\tscore ${score}\tavg ${avg}\tmax ${max}`);
    if (game.totalTurns === 200) {
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

loadSettings();

// For balancing:
// simulate(/*buyAlways=*/'🍾❎🍍🍒', /*buyOnce=*/'🔀🛍️🛍️🛍️🍹🔮🔮🔮🐌🐌🐌🌳');
// simulate(/*buyAlways=*/'🍾❎🍍🍒', /*buyOnce=*/'🍹🔮🔮🔮🐌🐌🐌🌳🌳');
// simulate(/*buyAlways=*/'❎🎲🎯🪄', /*buyOnce=*/'🐛🔮');

// This is our "integration test" for now, lol.
// simulate('','',/*rounds=*/100,/*buyRandom=*/true);
