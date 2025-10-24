import * as Const from './consts.js';
import * as Util from './util.js';
import { GameSettings } from './game_settings.js';
import { Catalog } from './catalog.js';
import { Board } from './board.js';
import { Inventory } from './inventory.js';
import { Shop } from './shop.js';
import { Game } from './game.js';
import { Progression } from './progression.js';

import { CATEGORY_UNBUYABLE } from './symbol.js';

// TODO: someday, we may want to support "multiple tracks" of progression aka different packs of levels.
// For now, hardcode a single default progression.
const PROGRESSION = new Progression();
PROGRESSION.load();

export const loadSettings = async (settings = GameSettings.instance()) => {
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);
  const catalog = new Catalog(settings.symbolSources);
  await catalog.updateSymbols();
  const game = new Game(PROGRESSION, settings, catalog);

  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('interactive-emoji')) {
      const emoji = e.target.dataset.emoji;
      const symbol = game.catalog.symbol(emoji);
      if (symbol) {
        const interactiveDescription = Util.createInteractiveDescription(
          symbol.descriptionLong(),
          /*emoji=*/ symbol.emoji()
        );
        Util.drawText(game.info, interactiveDescription, true);
      }
    }
  });
  return game;
};

export const loadListener = async (_) => {
  document.querySelector('body').removeEventListener('click', loadListener);
  const scoreContainer = document.querySelector('.game .scoreContainer');
  const scoreDiv = document.querySelector('.game .scoreContainer .score');
  await Util.animate(scoreDiv, 'scoreOut', 0.65);
  document.querySelector('.game').removeChild(scoreContainer);
  loadSettings(PROGRESSION.levelData[PROGRESSION.activeLevel]);
};

if (window.location.hash === '#dev') {
  document.querySelectorAll('.dev-hidden').forEach((e) => {
    e.classList.remove('dev-hidden');
  });
}

const game = await loadSettings(PROGRESSION.levelData[PROGRESSION.activeLevel]);
// Debug
window.game = game;

///// TEST RELATED CODE BELOW //////

class SimBoard extends Board {
  redrawCell(_, __, ___) {}
}

class AutoGame {
  constructor(settings, catalog, buyAlways, buyOnce, buyRandom) {
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = new Inventory(settings, this.catalog);
    this.inventory.update();
    this.board = new SimBoard(this);
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
    if (this.inventory.getResource(Const.TURNS) > 0) {
      await this.inventory.addResource(Const.TURNS, -1);
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
            if (this.inventory.getResource(Const.TURNS) <= 10) {
              // No more refresh.
              break;
            }
            const buttons = Array.from(
              document.getElementsByClassName('buyButton')
            );
            const refreshButton = buttons.splice(3, 1)[0];
            if (refreshButton !== undefined && !refreshButton.disabled) {
              if (
                (this.shop.refreshCost >=
                  this.inventory.getResource(Const.MONEY) / 2) |
                0
              ) {
                break;
              }
              await refreshButton.clickSim();
            } else {
              break;
            }
          }
        }
      }
    }

    if (this.inventory.getResource(Const.TURNS) <= 0) {
      await this.over();
    } else {
      this.totalTurns++;
    }
  }
  async simulate() {
    for (let i = 0; i < 200 && !this.isOver; ++i) {
      await this.roll();
    }
  }
}

window.simulate = async (buyAlways, buyOnce, rounds = 10, buyRandom = false) => {
  // console.log('strategy', buyAlways, buyOnce);
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);

  const scores = [];
  let over5k = 0;
  let over10k = 0;
  let over20k = 0;
  let lastMax = 0;
  let lastAvg = 0;

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
    const score = game.inventory.getResource(Const.MONEY);
    scores.push(score);
    const avg = (scores.reduce((acc, val) => acc + val, 0) / scores.length) | 0;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    console.log(`${i}\tscore ${score}\tavg ${avg}\tmax ${max}\tmin ${min}`);
    if (game.totalTurns === 200) {
      console.log('inf!');
    }
    if (score > 5000) {
      over5k++;
    }
    if (score > 10000) {
      over10k++;
    }
    if (score > 20000) {
      over20k++;
    }
    lastMax = max;
    lastAvg = avg;
  }
  console.log(over5k, over10k, over20k, lastMax, lastAvg);
};

const simulate = window.simulate;
Util.toggleAnimation();

// await simulate(/*buyAlways=*/'❎🪙', /*buyOnce=*/'🐛💰🔮🪄🏦🏦🏦');
// await simulate(/*buyAlways=*/'❎💎🪨', /*buyOnce=*/'🐛👷🌋🔮🪄🎯');
// await simulate(/*buyAlways=*/'🍾❎', /*buyOnce=*/'🍹🔮🔮🧊🧊🧊🍍🍍🍍🌳🌳');
// await simulate(/*buyAlways=*/'❎🐉🎲', /*buyOnce=*/'🐛🪄🪄🎯🎯🔮🔮');
// await simulate(/*buyAlways=*/'❎', /*buyOnce=*/'📀🐛🎯🪄🔮🔮🥁🥁🔔🔔🚀');
// await simulate(/*buyAlways=*/'❎💳🕳️🪄', /*buyOnce=*/'🐛🎯🎯🎯🔮🔮🔮');
// await simulate(/*buyAlways=*/'❎🥚🐉🦊', /*buyOnce=*/'🐛🪄🎯🎯🎯🔮🔮');
// await simulate(/*buyAlways=*/'❎💼🕳️🪄🎯🔮', /*buyOnce=*/'🐛🐉🐉🐉');
// await simulate(/*buyAlways=*/'❎🌝🚀', /*buyOnce=*/'🐛🔮🪄🎯');
// await simulate(/*buyAlways=*/'❎🧈🍿', /*buyOnce=*/'🔮🔮🪄🌽🌽🌽🧊🧊🧊🎯🎯');

// Find seed
// #nhsvjwcp

// const settings = GameSettings.instance();
// const catalog = new Catalog(settings.symbolSources);
// await catalog.updateSymbols();
// for (let k = 0; k < 100000; ++k) {
//   const phrase = await Util.setRandomSeed();

//   let hasGift = false;
//   const selection = catalog.generateShop(3, 1, false);
//   for (let i = 0; i < 3; ++i) {
//     const sym = Util.randomRemove(selection, /* shop= */ true);
//     if (sym.emoji() === '🎁') {
//       hasGift = true;
//     }
//   }
//   if (!hasGift) {
//     continue;
//   }

//   // Simulate roll
//   for (let i = 0; i < 166; ++i) {
//     Util.random(10);
//   }
  
//   for (let i = 0; i < 163; ++i) {
//     Util.random(10);
//   }

//   // Generate
//   let rareOnly = Util.randomFloat() < 0.2;
//   const bag = catalog.generateShop(
//     1, 1,
//     /* rareOnly= */ rareOnly,
//     /* bannedCategories= */[CATEGORY_UNBUYABLE, CATEGORY_TOOL]);
//   const sym = Util.randomChoose(bag);
//   if (sym.emoji() === '🎁') {
//     console.log(k, 'found', phrase);
//     break;
//   }
// }

// TODO: extract to ui.js

const hamburgerButton = document.getElementById('hamburger');
const sidebar = document.getElementById('sidebar-menu');
const closeButton = document.getElementById('close-sidebar');

hamburgerButton.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

closeButton.addEventListener('click', () => {
  sidebar.classList.remove('active');
});

const viewSymbolsButton = document.getElementById('view-symbols');
const symbolListDiv = document.querySelector('.sidebar-content .symbol-list');
viewSymbolsButton.addEventListener('click', () => {
  symbolListDiv.classList.toggle('hidden');
  viewSymbolsButton.innerText = symbolListDiv.classList.contains('hidden') ? 'view symbols' : 'hide symbols';
});

const allSymbols = [];
for (const [emoji, symbol] of game.catalog.symbols) {
  if (symbol.categories().includes(CATEGORY_UNBUYABLE)) {
    continue;
  }
  allSymbols.push(symbol);
}
// Sort by name:
allSymbols.sort((a, b) => {
  if (a.constructor.name < b.constructor.name) {
    return -1;
  } else if (a.constructor.name > b.constructor.name) {
    return 1;
  }
  return 0;
});
for (const symbol of allSymbols) {
  const symbolDiv = Util.createDiv('', 'symbol-info-entry');
  const emojiSpan = Util.createSpan(`${symbol.emoji()}: `, 'symbol-info-emoji');
  const descSpan = Util.createSpan('', 'symbol-info-desc');
  descSpan.innerHTML = symbol.descriptionLong();
  symbolDiv.appendChild(emojiSpan);
  symbolDiv.appendChild(descSpan);
  symbolListDiv.appendChild(symbolDiv);
}
