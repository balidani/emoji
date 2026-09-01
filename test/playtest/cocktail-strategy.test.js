// @vitest-environment jsdom
//
// Balance-testing playtest harness -- NOT part of the regular suite (lives
// outside test/unit, so vitest.config.mjs's include glob skips it; run it
// explicitly with `npx vitest run test/playtest/cocktail-strategy.test.js`).
// Drives the real Board/Shop/Inventory/Catalog on production GameSettings
// (5x5 board, 50 turns, full symbol pool) with an adaptive, per-turn
// decision policy -- not a fixed buy-list -- implementing the "cocktail
// engine" strategy, refined twice now from a real player's corrections plus
// a recorded human run's raw action log (turn/buy/refresh counts and
// tool-target coordinates -- decoded straight from the replay's event list,
// not a working replay of it, which diverges immediately for unrelated
// reasons -- see git history for that investigation):
//   - pin Cocktail in a high-neighbor-count cell, then pin exactly ONE
//     Multiplier next to it (an early money-generation accelerant) while
//     still buying up to MULTIPLIER_OWN_CAP (8) *unpinned* copies -- those
//     stack on whatever turns they happen to land adjacent too, without
//     permanently occupying a neighbor slot Champagne needs to cycle
//     through to ever get "triggered" (eaten) by Cocktail.
//   - pin Ice (and, secondarily, Tree) away from Cocktail's own
//     neighborhood -- that neighborhood is already self-protected
//     (anything landing there gets eaten before its own explode check runs
//     the same turn), so Ice's timer-slowing only matters for Champagne
//     sitting elsewhere on the board, buying it more rolls to eventually
//     cycle into a cell next to Cocktail instead of popping into a Bubble.
//   - Eye is for things whose effect doesn't care about board position
//     (Refresh/PostBox/ShoppingBag/Luck) -- Pin is for things that need to
//     stay put (Cocktail, the one Multiplier, Ice/Tree coverage).
//   - explicitly never buys Rows (🎰, more board rows) -- board expansion
//     dilutes this strategy rather than helping it.
//   - caps ShoppingBag around SHOPPING_BAG_CAP (4): enough buy throughput
//     to catch what matters, without piling up more copies than there are
//     turns/refreshes to spend the extra buys on.
//   - whenever exactly one buy is left this turn, always reaches for
//     Champagne over any other priority if it's offered.
//   - refreshes down to as close to ~0 money as it can afford every turn
//     until the last 3 turns -- refreshCost is reset each turn from
//     *current* money (Shop.reset()), so draining it low keeps next turn's
//     first refresh cheap instead of carrying a big balance into a shop
//     that starts expensive.
// Prints per-game diagnostics and summary stats via console.log rather than
// asserting anything -- it's a measurement tool for tuning, not a
// pass/fail regression test. A naive "buy first affordable thing" baseline
// runs alongside it for comparison.
import { describe, it } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { animationOff } from '../../src/render/animations.js';
animationOff();
import * as Const from '../../src/consts.js';
import { GameSettings } from '../../src/game_settings.js';
import { Catalog } from '../../src/catalog.js';
import { Board } from '../../src/board.js';
import { Inventory } from '../../src/inventory.js';
import { Shop } from '../../src/shop.js';
import { EventLog } from '../../src/eventlog.js';
import { SimRenderer } from '../../src/render/SimRenderer.js';

const COCKTAIL = '🍹';
const CHAMPAGNE = '🍾';
const PINEAPPLE = '🍍';
const CHERRY = '🍒';
const MULT = '❎';
const TREE = '🌳';
const ICE = '🧊';
const PIN = '📌';
const EYE = '🧿';
const REFRESH = '🔀';
const BAG = '🛍️';
const POSTBOX = '📮';
// Clover (🍀) has no constant -- it's never actively bought or targeted;
// it's simply left out of KEEP_SET so findJunkTarget prunes it like any
// other non-essential symbol (see KEEP_SET's comment). The one from the
// starting set gets Axed once the pool needs the space.
const CRYSTAL = '🔮';

const AXE = '🪓';
const ROWS = '🎰'; // Board expansion -- never bought, see header comment.
const JAR = '🫙';
const DRAGON = '🐉';
const BRIEFCASE = '💼';
const CLOUD = '☁️';
const CREDIT_CARD = '💳';
const FORTUNE_COOKIE = '🥠';
const SANTA = '🧑‍🎄';
const LOOTBOX = '🎁';

// Buy Multiplier freely up to this many owned copies (inventory + passive)
// -- floating unpinned copies still stack whenever they happen to land
// next to Cocktail, so more copies raises the odds of that most turns.
// Only ONE of them ever gets permanently pinned (MULTIPLIER_LOCK_CAP,
// below) -- pinning more would permanently occupy neighbor slots Champagne
// needs to cycle through to ever get eaten.
const MULTIPLIER_OWN_CAP = 8;
// Cap on ShoppingBag copies (bought + passive): 3-4 total, per the player.
const SHOPPING_BAG_CAP = 4;
// Ice: buy up to this many (separate from COVERAGE_PIN_CAP, which is how
// many of them end up permanently *pinned* -- this is just having enough
// in the pool to pin from).
const ICE_OWN_TARGET = 4;
// CrystalBall is deliberately uncapped -- "super important" per the
// player, at *least* 6 copies but no ceiling. Each is +3% Luck (stacking
// additively -- see catalog.js's generateShop, which adds Luck/100 to
// every symbol's rarity check), and more Luck raises the shop odds of
// *everything*, Champagne included -- a direct lever on the "Champagne
// barely gets offered" problem in a way none of the pin/refresh mechanics
// above touch. Buying more is only throttled by the pool-space logic
// below (nearPoolLimit), not by any per-symbol cap. Can be made passive
// later via Eye.
// Total early-game money generators to own across all of
// EARLY_BOOTSTRAP_PRIORITY combined -- bumped to 3-4 (from an original
// "1 or 2") per the player: once there are lots of buys and Luck running,
// these can reliably be Axed away, so it's fine to lean on more of them
// while the ramp is still building.
const EARLY_BOOTSTRAP_TOTAL_CAP = 4;
// Turn to stop treating Champagne as forbidden and start taking it
// unconditionally (see the Tier-0 Champagne check) -- "avoid buying
// champagne before turn 25, we need to build the ramp first" per the
// player: many buys, lots of Luck, some good early money generators.
// Before this turn, Pineapple is the closest substitute (still feeds
// Cocktail's stockpile) when nothing better is available -- see its
// Tier-2 comment.
const CHAMPAGNE_RAMP_TURN = 25;
// How close the *next* refresh's cost can get to current money before
// treating the turn's refresh budget as "tight" -- i.e. stop holding out
// for Tier-1 wants (ShoppingBag/Crystal/PostBox/Multiplier/bootstrap
// money) via more refreshing, and settle for a Tier-2 fallback instead.
// 0.5 means "the next refresh would eat at least half of what's left".
const REFRESH_TIGHT_RATIO = 0.5;
// Rough inventory-pool size to stay near: board.roll() draws
// min(pool, boardCells) symbols per turn without replacement, so once the
// pool grows much past board size (~25 cells), any single symbol's odds of
// actually landing on the board a given turn keep shrinking -- including
// Champagne once it's finally been bought, and (before it's passive) the
// single Refresh copy this bot now relies on exclusively (see the
// dedicated Eye-conversion priority block, and its comment, for why no
// more copies are ever bought). Once Refresh *is* passive, that specific
// risk is gone, so a bigger pool is tolerable --
// POOL_SIZE_TARGET_WITH_REFRESH_PASSIVE -- per the player, "okay to go
// over the 25 limit by a little, maybe to size 30".
const POOL_SIZE_TARGET = 25;
const POOL_SIZE_TARGET_WITH_REFRESH_PASSIVE = 30;
// How close to the effective pool limit counts as "near" it -- within
// this many slots, buying stops favoring more Crystal/PostBox/ShoppingBag
// and shifts to freeing space with Eye instead (see nearPoolLimit).
const POOL_SPACE_MARGIN = 3;

const COIN = '🪙';

const FEED_PRIORITY = [CHAMPAGNE, MULT, PINEAPPLE, CHERRY, TREE, ICE];
// Tier-2 fallback once Champagne/Multiplier/Pineapple/Ice are all already
// handled by their own dedicated checks -- just the plain remainder.
const FEED_FALLBACK = [CHERRY, TREE];
const UTILITY_SET = new Set([REFRESH, BAG, POSTBOX]);
// Clover deliberately excluded -- the player wants it Axed for space, not
// kept as a (much weaker than CrystalBall) passive, see KEEP_SET's comment.
const EYE_TARGET_PRIORITY = [REFRESH, POSTBOX, BAG, CRYSTAL];
// Explicitly named as the priority early bootstrap by the player this bot
// is modeling, ahead of generic feeding: Jar (pays 💵8 per *unique* emoji
// owned -- highest early, when the inventory is still small and every new
// symbol counts), Dragon (💵42 flat, just very rare -- 1% base rarity, grab
// it on sight), Briefcase ("usually good", 💵5 per 4 symbols owned), Cloud
// ("very good in the beginning", 💵6 per *empty* board cell -- with a
// mostly-empty board and a tiny starting pool, that's a lot of empty cells
// early on), FortuneCookie (💵5 per point of Luck -- directly rewards the
// Crystal Ball stacking this whole strategy leans on), and Santa+Lootbox
// (Lootbox transforms into a random symbol for free, bypassing the shop
// entirely, and Santa pays 💵25 per Lootbox opened -- "we can deal with
// any unwanted symbols produced later" per the player, i.e. via Axe).
// These are meant to be picked up *and later removed* (Axe, once Cocktail
// is running and every inventory slot should be feeding it instead)
// rather than kept all game, unlike FEED_PRIORITY/KEEP_SET.
const EARLY_BOOTSTRAP_PRIORITY = [
  JAR,
  DRAGON,
  BRIEFCASE,
  CLOUD,
  FORTUNE_COOKIE,
  SANTA,
  LOOTBOX,
  CREDIT_CARD,
];
// Balloon (🎈, 💵20/turn, 50% pop chance) -- present in the recorded human
// run's early buys but not named explicitly by the player like the above,
// so it's a lower-priority fallback rather than part of the actively
// hunted bootstrap set.
const MONEY_ENGINES = new Set([
  COIN,
  '🏦',
  BRIEFCASE,
  '💰',
  JAR,
  '🌽',
  '🍿',
  '🧈',
  LOOTBOX,
  SANTA,
  '🎈',
  CLOUD,
]);
// Away from Cocktail's own (self-protected) neighborhood: Ice first, Tree
// second (Tree spawns Cherry onto empty neighbors every 3 turns -- pinning
// it somewhere with open neighbors keeps that supply flowing without
// depending on it re-landing in a useful spot).
const COVERAGE_PIN_PRIORITY = [ICE, TREE];
// Everything worth keeping in the inventory pool once Cocktail is running --
// anything else drawn onto the board is Axe bait: a real recorded human run
// (see notes below) used Axe 11 times, with several targets landing on
// Cocktail's own neighbor cells, which only makes sense as inventory-pool
// pruning (removeSymbol deletes the symbol from the pool permanently -- the
// cleared cell itself gets refilled next roll regardless, so Axe can't be
// "fixing" a bad roll, only shrinking the pool so what's left is denser in
// the stuff we want landing next to Cocktail).
// Clover is deliberately NOT kept -- the player explicitly wants it Axed
// (along with Coin) once it's served its tiny early-Luck purpose, freeing
// the space for CrystalBall (3x the Luck per copy) and Champagne/
// Multiplier/etc. instead.
const KEEP_SET = new Set([COCKTAIL, ...FEED_PRIORITY, ...UTILITY_SET, CRYSTAL]);

function ensureShopDom() {
  document.body.innerHTML = '';
  const gameDiv = document.createElement('div');
  gameDiv.classList.add('game');
  const shopDiv = document.createElement('div');
  shopDiv.classList.add('shop');
  gameDiv.appendChild(shopDiv);
  document.body.appendChild(gameDiv);
}

async function buildGame(settings, catalog) {
  ensureShopDom();
  const view = new SimRenderer();
  const game = { settings, catalog, view, isOver: false };
  game.inventory = new Inventory(settings, catalog, view);
  game.board = new Board(game);
  game.eventlog = new EventLog(view);
  game.shop = new Shop(catalog, view);
  return game;
}

function deriveCocktailState(game) {
  const cocktailOwned = game.inventory.symbols.some(
    (s) => s.emoji() === COCKTAIL
  );
  let cocktailPinned = false;
  let pinnedAt = null;
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() === COCKTAIL) {
      cocktailPinned = true;
      pinnedAt = addr.split(',').map(Number);
    }
  }
  return { cocktailOwned, cocktailPinned, pinnedAt };
}

function bestCocktailCell(game) {
  let coord = null;
  let neighbors = -1;
  game.board.forAllCells((cell, x, y) => {
    if (cell.emoji() === COCKTAIL && !game.board.lockedAt(x, y)) {
      const n = game.board.nextToCoords(x, y).length;
      if (n > neighbors) {
        neighbors = n;
        coord = [x, y];
      }
    }
  });
  return { coord, neighbors };
}

// A live, unlocked Multiplier sitting next to the pinned Cocktail -- worth
// permanently locking there with a spare Pin charge (see notes above the
// KEEP_SET const): Multiplier isn't consumed by Cocktail the way Cherry/
// Pineapple/Champagne are, so once it's neighboring and pinned, every future
// turn's payout is multiplied for free instead of depending on it randomly
// re-landing there.
function findMultiplierNeighbor(game, pinnedAt) {
  if (!pinnedAt) return null;
  const [px, py] = pinnedAt;
  for (const [x, y] of game.board.nextToCoords(px, py)) {
    if (game.board.lockedAt(x, y)) continue;
    if (game.board.getSymbol(x, y).emoji() === MULT) return [x, y];
  }
  return null;
}

// How many Multiplier cells are already permanently locked next to
// Cocktail -- capped at MULTIPLIER_LOCK_CAP (1): the recorded human run
// used exactly one, as an early money-generation accelerant, not something
// to keep chasing all game. An earlier version of this bot tried locking
// as many as it could find and it measurably hurt the average score --
// the refresh spend hunting for more starves Champagne/Cherry feeding.
const MULTIPLIER_LOCK_CAP = 1;
function countLockedMultiplierNeighbors(game, pinnedAt) {
  if (!pinnedAt) return 0;
  return game.board
    .nextToCoords(pinnedAt[0], pinnedAt[1])
    .filter(
      ([x, y]) =>
        game.board.lockedAt(x, y) && game.board.getSymbol(x, y).emoji() === MULT
    ).length;
}

// Coverage cap: how many cells to permanently lock (Ice, then Tree) around
// the board. The recorded human run used ~4 Ice pins -- spread away from
// Cocktail's own neighborhood, which is already self-protecting (see the
// header comment: Champagne next to a pinned Cocktail is eaten before it
// can ever explode).
const COVERAGE_PIN_CAP = 5;

// A live, unlocked Ice or Tree symbol (COVERAGE_PIN_PRIORITY order) sitting
// somewhere worth permanently locking -- i.e. not on Cocktail's own cell or
// one of its neighbors (self-protected already, see header comment), and
// not already covered by a previously-locked coverage cell's own
// neighborhood (spreads coverage instead of stacking it on one spot). Ice
// slows *neighboring* timers, so locking it here means any Champagne that
// later lands next to this cell gets its 3-turn explode clock stretched
// out, buying it more rolls to eventually land next to Cocktail instead of
// popping into a Bubble first. Tree spawns Cherry onto empty neighbors
// every 3 turns, so the same "give it a fixed spot with open neighbors"
// logic keeps that supply flowing too.
//
// Among several valid candidates for the same emoji, prefers the cell with
// the *fewest* neighbors (a corner over an edge over an interior cell):
// permanently locking anything removes that cell from the random reshuffle
// every other roll draws from, so parking a fixture in a corner "wastes"
// the least potential Champagne-adjacency value -- an interior cell left
// open has 8 neighbor slots' worth of chances to matter, a corner only 3.
function findCoverageTarget(game, pinnedAt) {
  const protectedCells = new Set();
  if (pinnedAt) {
    protectedCells.add(pinnedAt.join(','));
    for (const [x, y] of game.board.nextToCoords(pinnedAt[0], pinnedAt[1])) {
      protectedCells.add(`${x},${y}`);
    }
  }
  const alreadyCovered = new Set();
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (!COVERAGE_PIN_PRIORITY.includes(lc.symbol.emoji())) continue;
    const [ix, iy] = addr.split(',').map(Number);
    alreadyCovered.add(addr);
    for (const [x, y] of game.board.nextToCoords(ix, iy)) {
      alreadyCovered.add(`${x},${y}`);
    }
  }
  for (const want of COVERAGE_PIN_PRIORITY) {
    let best = null;
    let bestNeighbors = Infinity;
    game.board.forAllCells((cell, x, y) => {
      if (game.board.lockedAt(x, y)) return;
      if (cell.emoji() !== want) return;
      const addr = `${x},${y}`;
      if (protectedCells.has(addr) || alreadyCovered.has(addr)) return;
      const n = game.board.nextToCoords(x, y).length;
      if (n < bestNeighbors) {
        bestNeighbors = n;
        best = [x, y];
      }
    });
    if (best) return best;
  }
  return null;
}

// CreditCard pays 💵1000 the first turn it scores, then -💵1100 on the
// very last turn of the game (finalScore) -- if it's still around then.
// Axing it away any time after that first payout keeps the 1000 and never
// pays the penalty, since removeSymbol deletes it from the pool entirely.
// `.turn` is CreditCard's own paid-once counter (symbols/money.js), not
// the game's turn number -- >=1 means it has already scored.
function findPaidCreditCardTarget(game) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    if (cell.emoji() === CREDIT_CARD && cell.turn >= 1) found = [x, y];
  });
  return found;
}

// Once the pool is near its effective limit (nearPoolLimit), converting an
// existing Crystal/PostBox/ShoppingBag to passive frees a slot without
// losing its effect -- cheaper than pruning something useful via Axe, and
// the whole point of stockpiling them in the first place was to eventually
// free them from board real estate. Refresh is deliberately not a
// candidate here -- it has its own dedicated, unconditional top-priority
// Eye slot above, since losing that one specifically is far more costly
// than losing throughput from these.
const SPACE_RELIEF_PRIORITY = [CRYSTAL, POSTBOX, BAG];
function findSpaceRelieverTarget(game, pinnedAt) {
  for (const want of SPACE_RELIEF_PRIORITY) {
    let found = null;
    game.board.forAllCells((cell, x, y) => {
      if (found) return;
      if (game.board.lockedAt(x, y)) return;
      if (pinnedAt && x === pinnedAt[0] && y === pinnedAt[1]) return;
      if (cell.emoji() === want) found = [x, y];
    });
    if (found) return found;
  }
  return null;
}

// Any unlocked, non-Cocktail board cell holding something outside KEEP_SET
// -- Axe fodder to shrink the inventory pool (see KEEP_SET comment). This
// also covers Bubbles (Champagne's explosion leftovers -- pure dead
// weight, and one Ice can end up neighboring can stall its own removal
// clock indefinitely, see the header) and Coin/Clover, all deliberately
// LOW priority ("a low priority task while we have space" per the player)
// -- this is only reached (Tier-2, gated on cocktailPinned/poolAtLimit)
// once there's nothing higher-value left to do, not on sight.
// CreditCard is deliberately excluded here even though it's outside
// KEEP_SET -- an *unpaid* one axed by generic pruning loses its 💵1000
// before it ever scores; findPaidCreditCardTarget (checked first, above)
// is the only thing allowed to remove it, and only after it's paid.
function findJunkTarget(game) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    const emoji = cell.emoji();
    if (emoji === '⬜' || emoji === COCKTAIL || emoji === CREDIT_CARD) return;
    if (!KEEP_SET.has(emoji)) found = [x, y];
  });
  return found;
}

// Total copies of an emoji this game already has, on the board, still in
// the buyable pool, or already converted to a passive -- used to cap
// Multiplier and ShoppingBag purchases (MULTIPLIER_OWN_CAP,
// SHOPPING_BAG_CAP) once there are enough copies in circulation.
function countOwned(game, emoji) {
  const inInventory = game.inventory.symbols.filter(
    (s) => s.emoji() === emoji
  ).length;
  const passive = game.board.passiveCells.filter(
    (s) => s.emoji() === emoji
  ).length;
  return inInventory + passive;
}

function findEyeTarget(game, pinnedAt) {
  for (const want of EYE_TARGET_PRIORITY) {
    let found = null;
    game.board.forAllCells((cell, x, y) => {
      if (found) return;
      if (game.board.lockedAt(x, y)) return;
      if (pinnedAt && x === pinnedAt[0] && y === pinnedAt[1]) return;
      if (cell.emoji() === want) {
        found = [x, y];
      }
    });
    if (found) return found;
  }
  return null;
}

// Adaptive "cocktail engine" policy. Structured as an explicit decision
// tree with three tiers, per the player's own framing:
//   Tier 0 (unconditional): Champagne (once the ramp is built, see
//     CHAMPAGNE_RAMP_TURN), Cocktail, converting Refresh to passive, Pin
//     actions (Cocktail placement, the one Multiplier lock, Ice/Tree
//     coverage), defusing a paid CreditCard, and space relief once the
//     pool is close to its limit. None of these wait on refresh budget.
//   Tier 1 ("build the ramp"): ShoppingBag/CrystalBall/PostBox/Multiplier/
//     early money generators. While there's still refresh budget to spare
//     and none of these are currently offered, the policy REFRESHES
//     instead of settling -- "even if we have many buys but several
//     refreshes left, we should focus on getting crystal balls and
//     postboxes" per the player.
//   Tier 2 ("misc, settle for it"): Ice, Pineapple, Eye/Axe cleanup, and
//     generic feed/money fallbacks -- only consulted once the refresh
//     budget is actually tight ("once we are close to the refresh limit
//     we can do misc buys").
async function cocktailPolicy(game, diag, turn) {
  const turnsRemaining = game.inventory.getResource(Const.TURNS);
  // Board layout is fixed for the whole turn (refreshing only re-samples
  // shop offers), so whether Cocktail is currently reachable to pin is a
  // per-turn constant, not something that changes across refreshes.
  const cocktailSpot = bestCocktailCell(game);
  let offersRef = null;
  let boughtIds = new Set();
  let guard = 0;
  // Hunting (refreshing specifically for Pin instead of taking a normal
  // buy) is high-value but not free -- an earlier, unbounded version of
  // this spent so much of the turn's economy chasing a lock that it
  // starved Champagne/Cherry feeding and made the *average* score worse
  // despite landing more locks in the games it did work. Capping the
  // number of hunting-refreshes per turn keeps the upside without letting
  // one turn's search crowd out everything else this policy needs to do.
  let huntBudget = 15;
  while (game.shop.buyCount > 0 && guard++ < 80) {
    if (game.shop.currentOffers !== offersRef) {
      offersRef = game.shop.currentOffers;
      boughtIds = new Set();
      if (game.shop.currentOffers.some((o) => o.symbol.emoji() === CHAMPAGNE)) {
        diag.champagneOffered = (diag.champagneOffered || 0) + 1;
      }
    }
    const state = deriveCocktailState(game);
    const available = game.shop.currentOffers
      .map((o, id) => ({ ...o, id }))
      .filter((o) => !boughtIds.has(o.id) && o.symbol.emoji() !== ROWS);

    let chosenId = -1;
    let toolTarget = undefined; // undefined = not a tool buy
    let multiplierNeighbor = null;
    let coverageTarget = null;

    // Space bookkeeping: only ONE Refresh copy is ever bought (the
    // starting one) -- "one is enough if we keep track of the inventory
    // size carefully, and if we make it passive it will always work" per
    // the player. With the pool kept small enough, it reliably lands on
    // the board on its own, and once Eye converts it to passive it always
    // works regardless of pool size after that. So the effective pool
    // ceiling is more generous once that conversion has already happened
    // (~30) than while it's still pending (~25, to keep that single
    // copy's on-board odds high enough for Eye to actually catch it).
    // "Near" the limit means within POOL_SPACE_MARGIN of it -- close
    // enough that the next few buys should go to freeing space (via Eye)
    // rather than acquiring more.
    const refreshIsPassive = game.inventory.getResource(REFRESH) > 0;
    const poolSize =
      game.inventory.symbols.length + game.board.passiveCells.length;
    const poolLimit = refreshIsPassive
      ? POOL_SIZE_TARGET_WITH_REFRESH_PASSIVE
      : POOL_SIZE_TARGET;
    const nearPoolLimit = poolSize >= poolLimit - POOL_SPACE_MARGIN;
    const poolAtLimit = poolSize >= poolLimit;

    // Commits whatever chosenId/toolTarget this iteration landed on and
    // records diagnostics -- called from both the Tier-1 and Tier-2 commit
    // points below, so it's a closure rather than duplicated inline.
    const commitBuy = async () => {
      boughtIds.add(chosenId);
      const boughtEmoji = game.shop.currentOffers[chosenId]?.symbol.emoji();
      if (toolTarget !== undefined) {
        game.view.primeToolTarget(toolTarget);
        if (boughtEmoji === PIN) {
          diag.pinCount = (diag.pinCount || 0) + 1;
          if (diag.pinTurn === null) {
            diag.pinTurn = turn;
          } else if (toolTarget === multiplierNeighbor) {
            diag.multiplierLocks = (diag.multiplierLocks || 0) + 1;
          } else if (toolTarget === coverageTarget) {
            diag.coveragePins = (diag.coveragePins || 0) + 1;
          }
        }
        if (boughtEmoji === AXE) diag.axeCount = (diag.axeCount || 0) + 1;
      }
      await game.shop.attemptPurchase(game, chosenId);
    };

    // ===== Tier 0: unconditional, no exceptions =====

    // Champagne, but only once the ramp is built (CHAMPAGNE_RAMP_TURN) --
    // "avoid buying champagne before turn 25, we need to build the ramp
    // first: many buys, lots of luck, some good early money generators"
    // per the player. Before that turn, buying it would just compete for
    // shop slots and refresh attention that should go to Tier 1 instead.
    if (chosenId === -1 && turn >= CHAMPAGNE_RAMP_TURN) {
      const hit = available.find((o) => o.symbol.emoji() === CHAMPAGNE);
      if (hit) chosenId = hit.id;
    }

    if (chosenId === -1 && !state.cocktailOwned) {
      const hit = available.find((o) => o.symbol.emoji() === COCKTAIL);
      if (hit) {
        chosenId = hit.id;
        if (diag.cocktailBoughtTurn === null) diag.cocktailBoughtTurn = turn;
      }
    }

    // Get the single Refresh copy converted to a passive as fast as
    // possible -- once it is, unlimited refreshing per turn stops
    // depending on it happening to be one of the ~25 cells a given roll
    // drew (Shop.haveRefreshSymbol), which is what actually capped refresh
    // volume hard before this fix (see git history). No more copies are
    // ever bought -- keeping the pool small is what keeps the *one* copy
    // reliable until this fires.
    if (chosenId === -1 && !refreshIsPassive) {
      const eyeHit = available.find((o) => o.symbol.emoji() === EYE);
      if (eyeHit) {
        let refreshCell = null;
        game.board.forAllCells((cell, x, y) => {
          if (refreshCell || game.board.lockedAt(x, y)) return;
          if (cell.emoji() === REFRESH) refreshCell = [x, y];
        });
        if (refreshCell) {
          chosenId = eyeHit.id;
          toolTarget = refreshCell;
        }
      }
    }

    // A true 8-neighbor cell for Cocktail is rare and won't necessarily
    // come back soon -- if Pin isn't offered this exact shop, it's worth
    // refreshing specifically to look for one (skipping other buys this
    // pass) rather than spending the turn's buys on something else and
    // hoping the alignment repeats. Only for the *first* pin and only at
    // the ideal 8-neighbor spot -- not the <=10-turns-left fallback below,
    // which settles for whatever cell it can get.
    let huntingIdealPin = false;
    if (
      chosenId === -1 &&
      huntBudget > 0 &&
      state.cocktailOwned &&
      !state.cocktailPinned &&
      cocktailSpot.coord &&
      cocktailSpot.neighbors === 8 &&
      !available.some((o) => o.symbol.emoji() === PIN)
    ) {
      huntingIdealPin = true;
    }

    // Patient pin: hold out for an 8-neighbor interior cell -- a recorded
    // human run waited until turn 24/50 for exactly this rather than
    // settling early, and that patience measurably paid off in testing
    // here too. Only cave in once the game is nearly over.
    if (
      chosenId === -1 &&
      state.cocktailOwned &&
      !state.cocktailPinned &&
      cocktailSpot.coord &&
      (cocktailSpot.neighbors === 8 || turnsRemaining <= 10)
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = cocktailSpot.coord;
      }
    }

    // Second use for Pin once Cocktail is settled: permanently lock exactly
    // one Multiplier next to it (MULTIPLIER_LOCK_CAP) as an early
    // money-generation accelerant. Multiplier isn't consumed by Cocktail
    // (unlike Cherry/Pineapple/Champagne), so pinning it turns a one-turn-
    // lucky buff into a permanent one. Capped at one on purpose -- chasing
    // more measurably hurt the average score in testing (see the cap's
    // comment), even though each additional lock roughly doubles score
    // *when it lands* (0 locks avg ~6k, 1 ~11k, 2 ~24k, 3 ~38k) -- the
    // refresh spend hunting for extras isn't worth it on average.
    multiplierNeighbor =
      state.cocktailPinned &&
      countLockedMultiplierNeighbors(game, state.pinnedAt) < MULTIPLIER_LOCK_CAP
        ? findMultiplierNeighbor(game, state.pinnedAt)
        : null;
    if (chosenId === -1 && multiplierNeighbor) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = multiplierNeighbor;
      }
    }

    // Third use for Pin: lock Ice (then Tree) around the rest of the board
    // (up to COVERAGE_PIN_CAP), covering the area Cocktail's own
    // neighborhood doesn't already self-protect. Champagne sitting there
    // needs its 3-turn explode clock stretched out by Ice to survive long
    // enough to eventually cycle into a cell next to Cocktail -- see the
    // header comment and findCoverageTarget's comment for why.
    if (
      chosenId === -1 &&
      state.cocktailPinned &&
      countLockedMultiplierNeighbors(game, state.pinnedAt) >=
        MULTIPLIER_LOCK_CAP
    ) {
      const lockedCoverageCount = Object.values(game.board.lockedCells).filter(
        (lc) => COVERAGE_PIN_PRIORITY.includes(lc.symbol.emoji())
      ).length;
      if (lockedCoverageCount < COVERAGE_PIN_CAP) {
        coverageTarget = findCoverageTarget(game, state.pinnedAt);
      }
    }
    if (chosenId === -1 && coverageTarget) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = coverageTarget;
      }
    }

    // Defuse a paid-off CreditCard the moment Axe is available, any time --
    // see findPaidCreditCardTarget's comment for why this can't wait.
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findPaidCreditCardTarget(game);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Close to the pool limit: shift focus to freeing space with Eye
    // (Crystal/PostBox/ShoppingBag, in that order -- see
    // findSpaceRelieverTarget) instead of continuing to acquire more of
    // them, which would only make the problem worse.
    if (chosenId === -1 && nearPoolLimit) {
      const hit = available.find((o) => o.symbol.emoji() === EYE);
      if (hit) {
        const target = findSpaceRelieverTarget(game, state.pinnedAt);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // ===== Tier 1: build the ramp -- worth refreshing to find rather
    // than settling for a Tier-2 fallback (see the decision point below) =====

    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, BAG) < SHOPPING_BAG_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === BAG);
      if (hit) chosenId = hit.id;
    }

    // CrystalBall: "super important" per the player, and NOT capped at 6 --
    // that's a floor, not a ceiling (see the const's comment for why Luck
    // matters this much).
    if (chosenId === -1 && !huntingIdealPin && !nearPoolLimit) {
      const hit = available.find((o) => o.symbol.emoji() === CRYSTAL);
      if (hit) chosenId = hit.id;
    }

    // PostBox: 5+ per the player -- more buy lines is close to strictly
    // good, unlike ShoppingBag's extra *buys*, which run out of game to
    // spend past SHOPPING_BAG_CAP, so this only stops near the pool limit,
    // not at any fixed count.
    if (chosenId === -1 && !huntingIdealPin && !nearPoolLimit) {
      const hit = available.find((o) => o.symbol.emoji() === POSTBOX);
      if (hit) chosenId = hit.id;
    }

    // Multiplier: buy up to MULTIPLIER_OWN_CAP (8) -- more copies raises
    // the odds some are neighboring Cocktail any given turn, on top of the
    // one permanently pinned one (MULTIPLIER_LOCK_CAP above).
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      countOwned(game, MULT) < MULTIPLIER_OWN_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === MULT);
      if (hit) chosenId = hit.id;
    }

    // Early income bootstrap, ahead of generic feeding: without real money
    // coming in before Champagne/Cocktail are doing any work, there's
    // nothing to fund the refresh volume this whole strategy depends on.
    // Capped at EARLY_BOOTSTRAP_TOTAL_CAP total across all of
    // EARLY_BOOTSTRAP_PRIORITY combined, not per-symbol. Meant to be
    // picked up now and pruned later via Axe once Cocktail is running
    // (see EARLY_BOOTSTRAP_PRIORITY's comment) -- they're not in KEEP_SET.
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !state.cocktailPinned &&
      !nearPoolLimit &&
      EARLY_BOOTSTRAP_PRIORITY.reduce((n, e) => n + countOwned(game, e), 0) <
        EARLY_BOOTSTRAP_TOTAL_CAP
    ) {
      const hit = available.find((o) =>
        EARLY_BOOTSTRAP_PRIORITY.includes(o.symbol.emoji())
      );
      if (hit) chosenId = hit.id;
    }

    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    // No Tier-0/Tier-1 want is offered right now -- decide whether it's
    // still worth refreshing to look for one, or whether this turn's
    // refresh budget is tight enough to settle for a Tier-2 fallback
    // instead. "Even if we have many buys but several refreshes left, we
    // should focus on getting crystal balls and postboxes... once we are
    // close to the refresh limit we can do misc buys" per the player.
    const money = game.inventory.getResource(Const.MONEY);
    const canRefresh =
      turnsRemaining > 3 &&
      game.shop.allowRefresh &&
      (game.shop.haveRefreshSymbol || game.shop.refreshCount === 0);
    const affordableRefresh = canRefresh && game.shop.refreshCost <= money;
    const budgetTight =
      !affordableRefresh ||
      game.shop.refreshCost >= money * REFRESH_TIGHT_RATIO;

    if (!budgetTight) {
      if (huntingIdealPin) huntBudget--;
      diag.refreshCount = (diag.refreshCount || 0) + 1;
      await game.shop.attemptRefresh(game);
      continue;
    }

    // ===== Tier 2: misc settle-for fallback, once refresh budget is tight =====

    // Ice: buy up to ICE_OWN_TARGET (4) -- separate from how many end up
    // pinned (COVERAGE_PIN_CAP), just keeping enough in the pool to pin
    // from and to feed Cocktail with in the meantime.
    if (chosenId === -1 && countOwned(game, ICE) < ICE_OWN_TARGET) {
      const hit = available.find((o) => o.symbol.emoji() === ICE);
      if (hit) chosenId = hit.id;
    }

    // Pineapple feeds Cocktail's stockpile directly and is worth taking
    // even before the Champagne ramp turn -- "more useful than champagne
    // in the first ~4-5 iterations" per the player.
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === PINEAPPLE);
      if (hit) chosenId = hit.id;
    }

    if (chosenId === -1 && !huntingIdealPin) {
      const hit = available.find((o) => o.symbol.emoji() === EYE);
      if (hit) {
        const target = findEyeTarget(game, state.pinnedAt);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Inventory-pool pruning (Bubble/Coin/Clover/etc.): cut anything
    // outside KEEP_SET, once either Cocktail is pinned or the pool is
    // actually at/over its effective limit -- deliberately LOW priority
    // ("while we have space in the inventory" per the player), reached
    // only here in Tier 2.
    if (chosenId === -1 && (state.cocktailPinned || poolAtLimit)) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findJunkTarget(game);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    if (chosenId === -1 && !huntingIdealPin) {
      for (const want of FEED_FALLBACK) {
        const hit = available.find((o) => o.symbol.emoji() === want);
        if (hit) {
          chosenId = hit.id;
          break;
        }
      }
    }

    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !state.cocktailPinned &&
      turnsRemaining > 3
    ) {
      // Excludes EARLY_BOOTSTRAP_PRIORITY members -- those are already
      // handled above with their own total cap; letting this generic
      // fallback buy more of them too would blow right past it.
      const hit = available.find(
        (o) =>
          MONEY_ENGINES.has(o.symbol.emoji()) &&
          !EARLY_BOOTSTRAP_PRIORITY.includes(o.symbol.emoji()) &&
          game.shop.canAfford(game, o.cost)
      );
      if (hit) chosenId = hit.id;
    }

    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    // Truly nothing worth buying -- refresh anyway if still affordable
    // (the budget's tight, not necessarily zero), else stop for the turn.
    if (affordableRefresh) {
      diag.refreshCount = (diag.refreshCount || 0) + 1;
      await game.shop.attemptRefresh(game);
      continue;
    }
    break;
  }
}

// Naive baseline for comparison: buy whatever's first & affordable, one
// refresh per turn if nothing looks buyable, no synergy awareness at all.
async function naivePolicy(game) {
  let guard = 0;
  while (game.shop.buyCount > 0 && guard++ < 20) {
    const offers = game.shop.currentOffers;
    const idx = offers.findIndex((o) => game.shop.canAfford(game, o.cost));
    if (idx !== -1) {
      if (offers[idx].symbol.categories?.().includes('category:Tool')) {
        game.view.primeToolTarget(null);
      }
      await game.shop.attemptPurchase(game, idx);
      continue;
    }
    if (
      game.shop.allowRefresh &&
      (game.shop.haveRefreshSymbol || game.shop.refreshCount === 0) &&
      game.shop.refreshCost <= game.inventory.getResource(Const.MONEY)
    ) {
      await game.shop.attemptRefresh(game);
      continue;
    }
    break;
  }
}

async function playTurn(game, policy, diag, turn) {
  if (game.isOver) return;
  if (game.inventory.getResource(Const.TURNS) > 0) {
    await game.inventory.addResource(Const.TURNS, -1);
    game.inventory.symbols.forEach((s) => s.reset());
    await game.shop.close(game);
    await game.board.roll(game);
    await game.board.transformWildcards(game);
    await game.board.evaluate(game);
    await game.board.score(game);
    await game.board.revertWildcards(game);
    await game.shop.open(game);
    game.inventory.resetLuck();
  } else {
    game.isOver = true;
    await game.board.finalScore(game);
    return;
  }
  await policy(game, diag, turn);
  if (game.inventory.getResource(Const.TURNS) <= 0) {
    game.isOver = true;
    await game.board.finalScore(game);
  }
}

async function playOneGame(seedPhrase, policy) {
  await setSeed(seedPhrase);
  const settings = GameSettings.instance();
  const catalog = new Catalog([...settings.symbolSources]);
  await catalog.updateSymbols();
  const game = await buildGame(settings, catalog);
  const diag = {
    pinTurn: null,
    cocktailBoughtTurn: null,
    champagneBought: 0,
    pinCount: 0,
    multiplierLocks: 0,
    coveragePins: 0,
    axeCount: 0,
    refreshCount: 0,
    champagneOffered: 0,
  };
  let turn = 0;
  while (!game.isOver && turn < 60) {
    turn++;
    await playTurn(game, policy, diag, turn);
  }
  diag.champagneBought = game.inventory.graveyard
    .concat(game.inventory.symbols)
    .filter((s) => s.emoji() === CHAMPAGNE).length;
  const score = game.inventory.getResource(Const.MONEY);
  return { score, diag };
}

function getTrophy(settings, score) {
  const sortedThresholds = Object.keys(settings.resultLookup)
    .map(Number)
    .sort((a, b) => b - a);
  for (const t of sortedThresholds) {
    if (score >= t) return settings.resultLookup[t];
  }
  return '💩';
}

describe('scratch: cocktail strategy playtest', () => {
  it('plays N full games with the adaptive cocktail policy', async () => {
    const N = 60;
    const results = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(`cocktail-playtest-${i}`, cocktailPolicy);
      results.push(r);
    }
    const settings = GameSettings.instance();
    const scores = results.map((r) => r.score).sort((a, b) => a - b);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2
        ? scores[mid]
        : Math.round((scores[mid - 1] + scores[mid]) / 2);
    console.log('\n=== Cocktail strategy results ===');
    results.forEach((r, i) => {
      console.log(
        `game ${i}\tscore ${r.score}\tcocktailTurn=${r.diag.cocktailBoughtTurn}\tpinTurn=${r.diag.pinTurn}\tchampagne=${r.diag.champagneBought}\tpins=${r.diag.pinCount}\tmultLocks=${r.diag.multiplierLocks}\tcoveragePins=${r.diag.coveragePins}\taxe=${r.diag.axeCount}\ttrophy=${getTrophy(settings, r.score)}`
      );
    });
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );
    const pinRate =
      results.filter((r) => r.diag.pinTurn !== null).length / results.length;
    console.log(`cocktail-pinned rate: ${(pinRate * 100).toFixed(0)}%`);

    const avgRefresh =
      results.reduce((s, r) => s + r.diag.refreshCount, 0) / results.length;
    const avgOffered =
      results.reduce((s, r) => s + r.diag.champagneOffered, 0) / results.length;
    const avgBought =
      results.reduce((s, r) => s + r.diag.champagneBought, 0) / results.length;
    console.log(
      `avg refreshes/game: ${avgRefresh.toFixed(1)} (human reference: ~424/50 turns)`
    );
    console.log(
      `avg champagne-offered shops/game: ${avgOffered.toFixed(1)}, avg champagne bought/game: ${avgBought.toFixed(1)}`
    );

    const byLocks = new Map();
    for (const r of results) {
      const k = r.diag.multiplierLocks;
      if (!byLocks.has(k)) byLocks.set(k, []);
      byLocks.get(k).push(r.score);
    }
    console.log('\navg score by permanent multiplier locks:');
    [...byLocks.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([locks, s]) => {
        const a = Math.round(s.reduce((x, y) => x + y, 0) / s.length);
        console.log(`  ${locks} locks: n=${s.length} avg=${a}`);
      });
  }, 120000);

  it('plays N full games with a naive baseline for comparison', async () => {
    const N = 40;
    const scores = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(`naive-playtest-${i}`, naivePolicy);
      scores.push(r.score);
    }
    scores.sort((a, b) => a - b);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / scores.length);
    const mid = Math.floor(scores.length / 2);
    const median =
      scores.length % 2
        ? scores[mid]
        : Math.round((scores[mid - 1] + scores[mid]) / 2);
    console.log('\n=== Naive baseline results ===');
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );
  }, 120000);
});
