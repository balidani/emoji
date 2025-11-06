import * as Const from './consts.js';
import * as Util from './util.js';
import { GameSettings } from './game_settings.js';
import { Catalog } from './catalog.js';
import { Board } from './board.js';
import { EventLog } from './eventlog.js';
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

  // On reload, re-apply scaling.
  applyScale();
  // If fonts/images change height, re-measure
  const ro = new ResizeObserver(() => {
    scheduleApply();
  });
  const content = document.querySelector('.grid-scaler-content');
  ro.observe(content);
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
  constructor(settings, catalog, buyAlways, buyOnce) {
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = new Inventory(settings, this.catalog);
    this.inventory.update();
    this.board = new SimBoard(this);
    this.info = document.querySelector('.game .info');
    this.eventlog = new EventLog();
    this.shop = new Shop(this.catalog);
    this.totalTurns = 0;
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

    // Randomly remove item
    // if (Util.randomFloat() < 0.2) {
    //   const emoji = this.board.getEmoji(2, 2);
    //   if (emoji !== Const.EMPTY) {
    //     await this.board.removeSymbol(this, 2, 2);
    //   }
    // }

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

window.simulate = async (buyAlways, buyOnce, rounds = 10) => {
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
      catalog.symbolsFromString(buyOnce)
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

// All emoji except for tools.
// const allEmoji = '🎈🏦🔔💼🐛🎯🧈🍾🍒🐣🐔🍀🍹🪙🌽💳🔮💃💎🎲🐉🥁🥚💸🥠🦊🧊🫙🪄💰🌝❎🍍🍿📀🔀🪨🚀🎰🧵🌳🌋👷📮';
// await simulate(/*buyAlways=*/'🔮🎰', allEmoji, 100);

// Find seed
// #olibvcin 

// const settings = GameSettings.instance();
// const catalog = new Catalog(settings.symbolSources);
// await catalog.updateSymbols();
// let maxCount = 0;
// let bestPhrase = '';
// for (let k = 0; k < 1000000; ++k) {
//   const phrase = await Util.setRandomSeed();

//   let counter = 0;
//   let box = 0;
//   let nextBox = 0;
//   for (let k = 0; k < 12; ++k) {
//     const selection = catalog.generateShop(3 + box, 1, false);
//     box += nextBox;
//     nextBox = 0;
//     for (let i = 0; i < 3 + box; ++i) {
//       const sym = Util.randomRemove(selection, /* shop= */ true);
//       if ('🛍️🔮🎰📮'.includes(sym.emoji())) {
//         counter++;
//       }
//       if (sym.emoji() === '📮') {
//         nextBox++;
//       }
//     }
//   }
//   if (counter > maxCount) {
//     maxCount = counter;
//     bestPhrase = phrase;
//     console.log(`new best ${bestPhrase} with ${maxCount}`);
//   }
//   if (k % 10000 === 0) {
//     console.log(`tried ${k} phrases`);
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

const BASE_VW = 226.67;
const MIN_S = 0.5;
const MAX_S = 3;

const MAX_VW_FRAC = 0.7;
const MAX_VH_FRAC = 0.5;

let baseW0 = 0;  // initial unscaled width (frozen)
let baseH0 = 0;  // initial unscaled height (frozen)
let sMaxByInitialHeight = Infinity;  // computed from baseH0
let currentBaseH = 0;  // live unscaled height as rows change

function measureOnceInitialSize() {
  if (baseW0 && baseH0) return;
  const content = document.querySelector('.grid-scaler-content');
  const prev = content.style.transform;
  content.style.transform = 'none';
  baseW0 = content.offsetWidth;
  baseH0 = content.offsetHeight;
  content.style.transform = prev || '';

  // compute the INITIAL height cap (≤ 50% of current viewport height)
  sMaxByInitialHeight = (window.innerHeight * MAX_VH_FRAC) / baseH0;
}

function measureCurrentHeight() {
  const content = document.querySelector('.grid-scaler-content');
  const prev = content.style.transform;
  content.style.transform = 'none';
  currentBaseH = content.offsetHeight; // can grow as rows are added
  content.style.transform = prev || '';
}

function computeScaleWidthOnlyWithInitialHeightCap() {
  const sDesign = window.innerWidth / BASE_VW;
  const sMaxByWidth = (window.innerWidth * MAX_VW_FRAC) / baseW0;
  return Math.max(MIN_S, Math.min(sDesign, sMaxByWidth, sMaxByInitialHeight, MAX_S));
}

function applyScale() {
  const wrapper = document.querySelector('.grid-scaler');
  const content = document.querySelector('.grid-scaler-content');

  measureOnceInitialSize();
  measureCurrentHeight();

  const s = computeScaleWidthOnlyWithInitialHeightCap();

  // expose for overlay
  content.style.setProperty('--s', s);

  // reserve layout space so following sections move down
  const scaledH = currentBaseH * s;
  wrapper.style.setProperty('--scaled-h', `${scaledH}px`);
  
  const scaledW = baseW0 * s;
  wrapper.style.setProperty('--scaled-w', `${scaledW}px`);
}

// rAF debounce
let raf = 0;
function scheduleApply() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    applyScale();
  });
}

window.addEventListener('resize', () => {
  // Recompute the initial height cap on resize so “≤ 50% of viewport height”
  // stays true for the current viewport, but still based on baseH0 (initial rows).
  if (baseH0) {
    sMaxByInitialHeight = (window.innerHeight * MAX_VH_FRAC) / baseH0;
  }
  scheduleApply();
});

applyScale();
// If fonts/images change height, re-measure
const ro = new ResizeObserver(() => {
  scheduleApply();
});
const content = document.querySelector('.grid-scaler-content');
ro.observe(content);
// TODO: remove observer on game end?
