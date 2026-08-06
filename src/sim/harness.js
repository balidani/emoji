import * as Const from '../consts.js';
import { GameSettings } from '../game_settings.js';
import { Catalog } from '../catalog.js';
import { Board } from '../board.js';
import { EventLog } from '../eventlog.js';
import { Inventory } from '../inventory.js';
import { Shop } from '../shop.js';
import { NullRenderer } from '../render/NullRenderer.js';

// Headless simulation driver. Runs the real Board/Shop/Inventory logic on
// NullRenderer for balancing runs -- and doubles as the substrate the
// golden-master trace harness (test/run-trace.mjs) drives via
// window.simulate.
export class AutoGame {
  constructor(settings, catalog, buyAlways, buyOnce, refreshTurns = 30) {
    this.settings = settings;
    this.catalog = catalog;
    // Renderer port, used by every subsystem. NullRenderer's shop rendering
    // still builds real DOM buy buttons -- this simulator's own buying logic
    // below reads them directly (see NullRenderer.js for why).
    this.view = new NullRenderer();
    this.inventory = new Inventory(settings, this.catalog, this.view);
    this.inventory.update();
    this.board = new Board(this);
    this.info = document.querySelector('.game .info');
    this.eventlog = new EventLog(this.view);
    this.shop = new Shop(this.catalog, this.view);
    this.totalTurns = 0;
    this.buyAlways = new Set(buyAlways);
    this.buyOnce = buyOnce;
    // Refreshing the shop is only worthwhile while there's still time left
    // to spend the offers it turns up -- this caps refreshing to the first
    // `refreshTurns` turns of the game (this.totalTurns counts turns
    // completed so far, starting at 0), instead of stopping based on turns
    // remaining.
    this.refreshTurns = refreshTurns;
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
      await this.board.transformWildcards(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      await this.board.revertWildcards(this);
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
              // Just this offer is unaffordable/already bought this turn --
              // keep scanning, a later offer may still match and be
              // affordable. (Bailing out here used to make one expensive
              // offer earlier in shop order block every cheaper purchase
              // for the rest of the turn.)
              continue;
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
          if (
            (this.buyOnce.length === 0 && this.buyAlways.size === 0) ||
            this.totalTurns >= this.refreshTurns
          ) {
            // Nothing left on the want list, or too close to the end of the
            // game -- refreshing would just spend money hunting for offers
            // we're never going to buy.
            break;
          }
          const buttons = Array.from(
            document.getElementsByClassName('buyButton')
          );
          // The refresh button is always the last one rendered, right after
          // the offers -- but PostBox (game.shop.buyLines++) can grow the
          // shop past 3 offers, so a hardcoded index 3 would grab a real
          // offer instead and "refresh" would silently buy it.
          const refreshButton = buttons.splice(
            this.shop.currentOffers.length,
            1
          )[0];
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

async function simulate(buyAlways, buyOnce, rounds = 10) {
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
}

// Exposes window.simulate for manual balancing runs from the console and
// for the golden-master trace harness (test/run-trace.mjs), which drives
// the real game purely by calling window.simulate(...) inside headless
// Chromium.
export function installSimulationHarness() {
  window.simulate = simulate;
}
