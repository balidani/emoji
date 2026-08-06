import * as Const from '../consts.js';
import { GameSettings } from '../game_settings.js';
import { Catalog } from '../catalog.js';
import { Board } from '../board.js';
import { EventLog } from '../eventlog.js';
import { Inventory } from '../inventory.js';
import { Shop } from '../shop.js';
import { SimRenderer } from '../render/SimRenderer.js';
import { CATEGORY_TOOL } from '../symbols/tools.js';

// Resolves the simulator's targeting policy (the Eye/Axe slots) into a
// mutable per-run shape keyed by tool emoji:
//   { '🧿': { always: Set<emoji>, repeat: [{emoji, count}] }, '🪓': {...} }
// `repeat` entries are copied so decrementing them during a run never
// touches the caller's saved strategy. Empty/null input (every trace
// fixture) yields `{}`, under which the tool-buy pass never finds a live
// target.
function normaliseTargeting(targeting) {
  const result = {};
  if (!targeting) {
    return result;
  }
  for (const [toolEmoji, policy] of Object.entries(targeting)) {
    if (!policy) continue;
    result[toolEmoji] = {
      always: new Set(policy.always || []),
      repeat: (policy.repeat || [])
        .filter((r) => r.count > 0)
        .map((r) => ({ emoji: r.emoji, count: r.count })),
    };
  }
  return result;
}

// Headless simulation driver. Runs the real Board/Shop/Inventory logic on
// SimRenderer for balancing runs -- and doubles as the substrate the
// golden-master trace harness (test/run-trace.mjs) drives via
// window.simulate.
export class AutoGame {
  constructor(
    settings,
    catalog,
    buyAlways,
    buyOnce,
    refreshTurns = 30,
    targeting = null
  ) {
    this.settings = settings;
    this.catalog = catalog;
    // Renderer port, used by every subsystem. SimRenderer's shop rendering
    // still builds real DOM buy buttons -- this simulator's own buying logic
    // below reads them directly (see NullRenderer.js for why). Its
    // tool-target queue starts empty, so pickCellForTool behaves exactly
    // like NullRenderer until the tool-buy pass below primes a target.
    this.view = new SimRenderer();
    this.inventory = new Inventory(settings, this.catalog, this.view);
    this.inventory.update();
    this.board = new Board(this);
    this.info = document.querySelector('.game .info');
    this.eventlog = new EventLog(this.view);
    this.shop = new Shop(this.catalog, this.view);
    this.totalTurns = 0;

    // Split acquisition by CATEGORY_TOOL so the generic buy loop below --
    // unchanged from before tool support existed -- never sees a tool offer
    // and stays byte-identical when no tool is in the buy lists (every
    // trace fixture).
    const isTool = (s) => s.categories().includes(CATEGORY_TOOL);
    this.buyAlways = new Set(buyAlways.filter((s) => !isTool(s)));
    this.buyOnce = buyOnce.filter((s) => !isTool(s));
    // Tool purchases, as an ordered want-list with per-entry purchase
    // budgets: a buyOnce tool is one entry per copy (consumed on buy), a
    // buyAlways tool is a single unlimited entry. buyOnce wants are listed
    // first, mirroring the generic loop's Repeat-before-Always priority.
    this.toolBuys = [
      ...buyOnce.filter(isTool).map((s) => ({ symbol: s, always: false })),
      ...[...new Set(buyAlways.filter(isTool))].map((s) => ({
        symbol: s,
        always: true,
      })),
    ];
    this.targeting = normaliseTargeting(targeting);

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
            (this.buyOnce.length === 0 &&
              this.buyAlways.size === 0 &&
              this.toolBuys.length === 0) ||
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
      // Tools are bought in a separate, awaited pass (see toolBuyPass) so
      // their effect resolves before the next roll -- blanket-awaiting the
      // generic loop above would re-interleave the microtasks its traced
      // resource-change events depend on. Entirely skipped when nothing in
      // Shopping is a tool (every trace fixture).
      if (this.toolBuys.length > 0) {
        await this.toolBuyPass();
      }
    }
    if (this.inventory.getResource(Const.TURNS) <= 0) {
      await this.over();
    } else {
      this.totalTurns++;
    }
  }
  // Deterministic: fixed want order, fixed board scan, no RNG draws. Buys
  // tool wants (in this.toolBuys) one at a time -- Repeat wants first, then
  // Always wants -- while the shop still has buys left and at least one
  // want is currently offered and affordable. A want that isn't offered
  // this turn is skipped (not retried) for the rest of this pass, but stays
  // on the list for later turns.
  async toolBuyPass() {
    const unbuyableThisTurn = new Set();
    for (;;) {
      if (this.shop.buyCount <= 0) {
        break;
      }
      const want = this.toolBuys.find((w) => !unbuyableThisTurn.has(w));
      if (!want) {
        break;
      }
      const emoji = want.symbol.emoji();
      const button = this.findToolBuyButton(emoji);
      if (!button) {
        unbuyableThisTurn.add(want);
        continue;
      }
      const target = this.pickToolTarget(emoji);
      // Capture the target's emoji before buying -- the tool's effect (Eye
      // makePassive / Axe removeSymbol) mutates that cell as part of the
      // awaited buy below, so it can't be read back afterwards.
      const targetEmoji = target
        ? this.board.getSymbol(target[0], target[1]).emoji()
        : null;
      this.view.primeToolTarget(target);
      // Purchase budget: a buyOnce want is consumed on buy; a buyAlways
      // want is never removed. The buy happens regardless of target --
      // Shopping said "buy it", so a null target still spends the money
      // and simply resolves as a no-op.
      if (!want.always) {
        const idx = this.toolBuys.indexOf(want);
        this.toolBuys.splice(idx, 1);
      }
      await button.clickSim();
      button.disabled = true;
      if (targetEmoji !== null) {
        this.consumeTargetHit(emoji, targetEmoji);
      }
    }
  }
  findToolBuyButton(emoji) {
    const buttons = Array.from(document.getElementsByClassName('buyButton'));
    for (const button of buttons) {
      if (button.disabled) {
        continue;
      }
      if (button.parentElement.parentElement.children[0].innerText === emoji) {
        return button;
      }
    }
    return null;
  }
  // Fixed board scan (y outer, x inner -- Board.forAllCells order) for the
  // first cell whose symbol is a live target under this tool's policy.
  // Skips the centre cell, locked cells, and empty cells.
  pickToolTarget(toolEmoji) {
    const policy = this.targeting[toolEmoji];
    if (!policy) {
      return null;
    }
    let found = null;
    this.board.forAllCells((cell, x, y) => {
      if (found || (x === 2 && y === 2) || this.board.lockedAt(x, y)) {
        return;
      }
      const cellEmoji = cell.emoji();
      if (cellEmoji === Const.EMPTY) {
        return;
      }
      if (this.isLiveTarget(policy, cellEmoji)) {
        found = [x, y];
      }
    });
    return found;
  }
  isLiveTarget(policy, emoji) {
    if (policy.always.has(emoji)) {
      return true;
    }
    return policy.repeat.some((r) => r.emoji === emoji && r.count > 0);
  }
  // Only decrements a Repeat hit budget, and only when Always didn't
  // already cover the hit -- Always entries are never consumed.
  consumeTargetHit(toolEmoji, targetEmoji) {
    const policy = this.targeting[toolEmoji];
    if (!policy || policy.always.has(targetEmoji)) {
      return;
    }
    const entry = policy.repeat.find(
      (r) => r.emoji === targetEmoji && r.count > 0
    );
    if (!entry) {
      return;
    }
    entry.count--;
    if (entry.count === 0) {
      policy.repeat.splice(policy.repeat.indexOf(entry), 1);
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
