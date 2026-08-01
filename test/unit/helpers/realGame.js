// Tier-2 (jsdom) harness: wires the *real* Board/Inventory/Shop/Catalog on a
// *real* NullRenderer. This exercises the wiring Tier-1's spy-based harness
// stubs out -- in particular real Inventory bookkeeping and real Shop
// economy. The only reason this needs jsdom at all is NullRenderer's
// constructor building a real ShopView, which does
// `document.querySelector('.game .shop')` (see UNIT_TEST_PLAN.md section
// 4, "the one seam to be careful about").
import { Board } from '../../../src/board.js';
import { Inventory } from '../../../src/inventory.js';
import { Shop } from '../../../src/shop.js';
import { Catalog } from '../../../src/catalog.js';
import { EventLog } from '../../../src/eventlog.js';
import { NullRenderer } from '../../../src/render/NullRenderer.js';

const DEFAULT_SOURCES = [
  './symbols/money.js',
  './symbols/animals.js',
  './symbols/food.js',
  './symbols/music.js',
  './symbols/rocks.js',
  './symbols/advanced.js',
  './symbols/things.js',
  './symbols/tools.js',
  './symbols/ui.js',
];

export function ensureShopDom() {
  if (document.querySelector('.game .shop')) {
    return;
  }
  const gameDiv = document.createElement('div');
  gameDiv.classList.add('game');
  const shopDiv = document.createElement('div');
  shopDiv.classList.add('shop');
  gameDiv.appendChild(shopDiv);
  document.body.appendChild(gameDiv);
}

export async function buildRealCatalog(sources = [...DEFAULT_SOURCES]) {
  const catalog = new Catalog(sources);
  await catalog.updateSymbols();
  return catalog;
}

export async function buildRealGame({
  boardX = 3,
  boardY = 3,
  gameLength = 10,
  startingSet = '🪙🪙🪙',
  initiallyLockedCells = {},
  catalog,
} = {}) {
  ensureShopDom();
  catalog = catalog || (await buildRealCatalog());
  const settings = {
    boardX,
    boardY,
    gameLength,
    startingSet,
    initiallyLockedCells,
  };
  const view = new NullRenderer();
  const game = { settings, catalog, view };
  game.inventory = new Inventory(settings, catalog, view);
  const board = new Board(game); // self-assigns game.board
  game.eventlog = new EventLog(view);
  game.shop = new Shop(catalog, view);
  return {
    game,
    board,
    inventory: game.inventory,
    shop: game.shop,
    catalog,
    view,
  };
}
