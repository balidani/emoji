// Tier-1 (DOM-free) game harness. See UNIT_TEST_PLAN.md section 4.1.
//
// Design note: rather than hand-rolling a fake board that re-implements
// Board's query semantics (nextToSymbol, nextToCategory, ...) and risks
// drifting from the real thing (see the plan's section 8 "conformance
// suite" worry), we construct the *real* `Board` class directly. Board's
// constructor and every query/mutator method are already DOM-free -- the
// only DOM touches in board.js are the `getSymbolDiv`/`getCellDiv` shims,
// which symbol *logic* paths never call. The one real seam is
// `NullRenderer`, whose constructor builds a `ShopView` that touches
// `document`; we avoid that entirely by injecting the spy renderer above
// instead of a real `NullRenderer`.
//
// The catalog is likewise real: it's built from the actual default symbol
// classes (money/animals/food/music/rocks/advanced/things/tools/ui), so
// category membership (CATEGORY_FOOD, CATEGORY_EMPTY_SPACE, ...) used by
// nextToCategory/Volcano/Lootbox is the genuine, current data -- not a
// hand-copied duplicate that could go stale.

import * as Const from '../../../src/consts.js';
import * as Util from '../../../src/util.js';
import { Board } from '../../../src/board.js';
import { CATEGORY_UNBUYABLE, Symb } from '../../../src/symbol.js';

import * as MoneySymbols from '../../../src/symbols/money.js';
import * as AnimalSymbols from '../../../src/symbols/animals.js';
import * as FoodSymbols from '../../../src/symbols/food.js';
import * as MusicSymbols from '../../../src/symbols/music.js';
import * as RockSymbols from '../../../src/symbols/rocks.js';
import * as AdvancedSymbols from '../../../src/symbols/advanced.js';
import * as ThingsSymbols from '../../../src/symbols/things.js';
import * as ToolsSymbols from '../../../src/symbols/tools.js';
import * as UiSymbols from '../../../src/symbols/ui.js';
import * as WildcardSymbols from '../../../src/symbols/wildcard.js';

import { makeSpyRenderer } from './spyRenderer.js';

// All symbol source modules loaded by the default game (game_settings.js),
// minus the optional extra-symbols/ packs (beta/example/lock -- out of
// scope, see UNIT_TEST_PLAN.md section 7.10).
const DEFAULT_MODULES = [
  MoneySymbols,
  AnimalSymbols,
  FoodSymbols,
  MusicSymbols,
  RockSymbols,
  AdvancedSymbols,
  ThingsSymbols,
  ToolsSymbols,
  UiSymbols,
  WildcardSymbols,
];

export function buildCatalog(modules = DEFAULT_MODULES) {
  const symbols = new Map();
  const categories = new Map();
  for (const mod of modules) {
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function' || !(value.prototype instanceof Symb)) {
        continue;
      }
      const instance = new value();
      symbols.set(instance.emoji(), instance);
      for (const cat of instance.categories()) {
        const old = categories.get(cat) || [];
        old.push(instance.emoji());
        categories.set(cat, old);
      }
    }
  }
  return {
    symbols,
    categories,
    symbol(emoji) {
      if (!symbols.has(emoji)) {
        throw new Error('Unknown symbol: ' + emoji);
      }
      return symbols.get(emoji).copy();
    },
    // Mirrors Catalog.generateShop (catalog.js) exactly, over the fake's
    // own symbol set, for Lootbox/shop-adjacent tests.
    generateShop(
      minCount,
      luck,
      rareOnly = false,
      bannedCategories = [CATEGORY_UNBUYABLE]
    ) {
      const bag = [];
      const checkCategory = (item) => {
        for (const cat of bannedCategories) {
          if (item.categories().includes(cat)) {
            return false;
          }
        }
        return true;
      };
      if (rareOnly) {
        for (const [, item] of symbols) {
          if (!checkCategory(item)) continue;
          if (item.rarity < 0.101) bag.push(item.copy());
        }
        return bag;
      }
      while (bag.length <= minCount) {
        for (const [, item] of symbols) {
          if (!checkCategory(item)) continue;
          if (Util.randomFloat(true) < item.rarity + luck / 100.0) {
            bag.push(item.copy());
          }
        }
      }
      return bag;
    },
  };
}

// Parses a row like '🪙 ❎ ⬜' into ['🪙', '❎', '⬜']. Tokens are
// whitespace-separated so multi-codepoint emoji (🕳️, 🧑‍🚒, 🎅🏻) survive intact.
function parseGridRow(row) {
  return row.trim().split(/\s+/);
}

// buildGame({ grid, luck, resources, ... }) -> { game, board, spy, catalog, inventory }
//
// `grid` is a list of row strings (see parseGridRow); every cell is
// resolved through the catalog, so any default-game emoji can be used,
// including '⬜' for empty.
export function buildGame({
  grid = ['⬜'],
  luck = 0,
  resources = {},
  rowCount,
  giftsOpened = 0,
  inventorySymbols = [],
  startingMoney = 1,
  turns = 10,
  catalog = buildCatalog(),
} = {}) {
  const rows = grid.map(parseGridRow);
  const boardY = rows.length;
  const boardX = rows[0].length;

  const spy = makeSpyRenderer();

  const resourceState = {
    [Const.MONEY]: startingMoney,
    [Const.TURNS]: turns,
    [Const.LUCK]: luck,
    ...resources,
  };

  const inventory = {
    symbols: [...inventorySymbols],
    resources: resourceState,
    tempLuckBonus: 0,
    giftsOpened,
    rowCount: rowCount ?? boardY,
    graveyard: [],
    getResource(key) {
      return this.resources[key] === undefined ? 0 : this.resources[key];
    },
    async addResource(key, value) {
      this.resources[key] = this.getResource(key) + value;
    },
    addLuck(bonus) {
      this.tempLuckBonus += bonus;
    },
    resetLuck() {
      this.resources[Const.LUCK] = this.tempLuckBonus;
      this.tempLuckBonus = 0;
    },
    resetRows() {
      this.rowCount = boardY;
    },
    add(symbol) {
      this.symbols.push(symbol);
    },
    remove(symbol, { toGraveyard = true } = {}) {
      const index = this.symbols.indexOf(symbol);
      if (index >= 0) {
        this.symbols.splice(index, 1);
      }
      if (toGraveyard) {
        this.graveyard.push(symbol);
      }
    },
    getRandomOwnedEmoji() {
      if (this.symbols.length === 0) {
        return Const.EMPTY;
      }
      return Util.randomChoose(this.symbols).emoji();
    },
  };

  const shop = {
    haveRefreshSymbol: false,
    refreshCount: 0,
    buyCount: 1,
    buyLines: 3,
    hide() {},
    show() {},
  };

  const eventlogCalls = [];
  const eventlog = {
    calls: eventlogCalls,
    async logResourceChange(key, value, source, direction = 'earned') {
      eventlogCalls.push({ key, value, source, direction });
    },
  };

  // Board's constructor unconditionally pokes `this.cells[2][2] = new
  // PlayButton()` (the intro board's play button), so it needs at least a
  // 3x3 grid to exist yet -- pad the *construction-time* settings, then
  // shrink back down to the caller's real grid dimensions afterwards.
  const settings = {
    boardX: Math.max(boardX, 3),
    boardY: Math.max(boardY, 3),
    initiallyLockedCells: {},
  };

  const game = { settings, catalog, view: spy, inventory, shop, eventlog };

  // Board's constructor self-assigns `game.board = this` and builds a
  // default (padded) grid of Empty (plus a center PlayButton) -- we
  // immediately overwrite `cells` with the caller's real grid below.
  const board = new Board(game);
  spy.calls.length = 0; // discard the constructor's own spinCellOnce noise

  settings.boardX = boardX;
  settings.boardY = boardY;
  board.cells = rows.map((row) => row.map((emoji) => catalog.symbol(emoji)));
  board.currentRows = boardY;

  return { game, board, spy, catalog, inventory, eventlog };
}
