// @vitest-environment jsdom
//
// Balance-testing playtest harness -- NOT part of the regular suite (see
// cocktail-strategy.test.js's header for the general rationale). Drives the
// real Board/Shop/Inventory/Catalog on production GameSettings with an
// adaptive "fortune cookie engine" strategy -- a third alternative to the
// cocktail and gift-santa strategies, per the player's own framing:
//   - Core engine: 🥠 FortuneCookie pays 💵5 per point of [Luck](luck) --
//     but Luck is a PER-TURN resource (Inventory.resetLuck() zeroes it after
//     scoring every turn -- see playTurn below), accumulated during
//     evaluate() from whatever Clover(+1%)/CrystalBall(+3%) happens to be
//     active THAT turn (on the board, or passive -- passives evaluate too,
//     see board.js). So consistent, EVERY-TURN Luck income matters far more
//     here than in the cocktail/gift-santa strategies (where Luck only
//     nudged shop rarity odds, not a direct per-turn payout) -- hence
//     CrystalBall gets its own early, unconditional Eye-to-passive priority
//     below (Tier 0), not just the usual "once near the pool limit" space
//     relief every other strategy uses.
//   - Pin ONE FortuneCookie in the best available cell (patient: hold out
//     for a full 8-neighbor cell like the cocktail strategy's Cocktail
//     placement, settling only once the game's nearly over), then pin every
//     unlocked Multiplier adjacent to it, up to all 8 neighbors -- "trying
//     to get one cookie surrounded by 8 multipliers if possible" per the
//     player. Extra FortuneCookie copies (up to FORTUNE_COOKIE_CAP, a flat 6
//     -- down from an earlier 30%-of-pool share, which let too many copies
//     compete with the ramp for pool space) stay unpinned and just pay
//     their own flat Luck*5 wherever they land -- only the one target cell
//     gets the Multiplier-stacking
//     treatment (Multiplier.evaluateProduce doubles a neighbor's `.multiplier`
//     field every turn it stays adjacent -- permanent once pinned, so N
//     pinned Multipliers means a permanent x2^N on that one cookie).
//   - Buy exactly one 🍹 Cocktail early -- not to run the cocktail engine,
//     just as automatic cleanup: it eats neighboring Cherry/Pineapple/
//     Champagne on its own (evaluateConsume), so it clears the three
//     starting 🍒 Cherries over a few turns with zero Axe spend -- "cocktail
//     helps so we only need one [buy] for all the fruit" per the player.
//     Cocktail itself becomes prunable (generic Tier-2 cleanup) once no
//     Cherry remains anywhere, since it has no further role in this engine.
//   - A few 🍀 Clover early (CLOVER_CAP) to jumpstart Luck before CrystalBall
//     supply is established, then pruned once there's enough CrystalBall to
//     not miss the difference -- same idea, and the same
//     buy-then-prune-later shape, as the cocktail strategy's Clover
//     handling, just actively bought here instead of only ever removed.
//   - Early money bootstrap (🐉 Dragon, 🫙 Jar, 💼 Briefcase -- up to
//     EARLY_MONEY_TOTAL_CAP, 3, combined) for income before the cookie
//     engine ramps up -- "this strategy could also use some early money
//     generators before multiple fortune cookies show up" per the player.
//     Same buy-then-prune-later shape as Clover/Cocktail: not in KEEP_SET,
//     so once the real engine is running they're ordinary Tier-2 Axe bait
//     (gated on the cookie being pinned, same reasoning as Cocktail -- see
//     findMessTarget). Deliberately a Tier-2 settle-for, not Tier 1 --
//     "ramping up luck should always be priority number one" per the
//     player. Tier 1 buys whatever's offered immediately and moves on to
//     the next shop offer, so putting this bootstrap there at all (tried
//     first, at multiple priority positions within Tier 1) meant taking it
//     pre-empted refreshing further to look for CrystalBall/Clover that
//     turn, and measurably hurt the average score. Tier 2 only runs once
//     the refresh budget is already tight -- i.e. the policy has already
//     given up hunting for something better -- so it can only ever fire
//     when it isn't competing with the Luck ramp.
//   - PostBox/ShoppingBag/Rows: same capped "ramp, then prune once no
//     longer needed" treatment as the other two strategies (POSTBOX_CAP/
//     SHOPPING_BAG_CAP/ROWS_MARGIN) -- "same strategy... within a limit"
//     per the player.
//   - Same gift-mess-style hazard cleanup as gift-santa (Volcano first,
//     unconditionally; then Gambler/Dice; then generic junk) -- Volcano/
//     Gambler/Dice are universal hazards, not specific to any one engine.
//   - Refresh: exactly one copy from the start, converted to passive ASAP,
//     protected from Axe by a standalone guard rather than KEEP_SET
//     membership (same reasoning as gift-santa-strategy.test.js). Same
//     late-game pin-hunting/throttled-refresh window as gift-santa
//     (LATE_GAME_WINDOW/LATE_GAME_MAX_REFRESHES), retargeted at this
//     strategy's own pin opportunities (the ideal cookie cell, or a
//     Multiplier neighbor of the already-pinned one).
// Prints per-game diagnostics and summary stats via console.log rather than
// asserting anything -- a measurement tool for tuning, not a pass/fail
// regression test. A naive "buy first affordable thing" baseline runs
// alongside it for comparison.
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

const FORTUNE_COOKIE = '🥠';
const MULT = '❎';
const CRYSTAL = '🔮';
const POSTBOX = '📮';
const BAG = '🛍️';
const REFRESH = '🔀';
const ROWS = '🎰';
const PIN = '📌';
const EYE = '🧿';
const AXE = '🪓';
const CLOVER = '🍀';
const COCKTAIL = '🍹';
const CHERRY = '🍒';

const VOLCANO = '🌋';
const GAMBLER = '🤑';
const DICE = '🎲';
const CREDIT_CARD = '💳';

const DRAGON = '🐉';
const JAR = '🫙';
const BRIEFCASE = '💼';

// Cap FortuneCookie purchases at a flat number -- down from an earlier
// 30%-of-pool share, which (in a ~25-32 pool) allowed 8-10 copies,
// crowding out ramp items (CrystalBall/PostBox/ShoppingBag/Multiplier) for
// pool space without adding much: only the one pinned cookie gets the
// Multiplier-stacking treatment, so extra unpinned copies are worth much
// less than the ramp items they were displacing. "Let's try with 6 fortune
// cookies max" per the player.
const FORTUNE_COOKIE_CAP = 6;

// A handful of Clover to jumpstart Luck before CrystalBall supply exists,
// then pruned -- see the header comment. Both the buy-stop and the
// removal-allowed conditions share this one CrystalBall-count threshold:
// once CrystalBall is established, Clover's much smaller +1% (vs +3%) isn't
// worth either buying more of or keeping around.
const CLOVER_CAP = 3;
const CLOVER_CRYSTAL_THRESHOLD = 3;

// Early income bootstrap, ahead of the FortuneCookie engine actually
// ramping up -- "this strategy could also use some early money generators
// before multiple fortune cookies show up" per the player. Dragon (💵42
// flat, just rare), Jar (💵8 per unique emoji owned -- best early, when the
// inventory is still small), and Briefcase (💵5 per 4 symbols owned) are
// meant to be picked up now and pruned later (not in KEEP_SET) once the
// cookie/multiplier engine is doing the real work -- same
// buy-then-prune-later shape as Clover. Capped at 3 total across all three
// combined, not per-symbol.
const EARLY_MONEY_PRIORITY = [DRAGON, JAR, BRIEFCASE];
const EARLY_MONEY_TOTAL_CAP = 3;

// CrystalBall is generous here (not just "at least a few" like the other
// strategies) since every extra passive copy is a permanent, guaranteed
// addition to literally every turn's Luck -- and Luck converts directly to
// money every turn via FortuneCookie, unlike in the other strategies where
// it only nudges shop odds. Bumped further (6 -> 10) per the player's
// "more priority to ramp building (luck especially, buy lines and some
// shopping bags)" -- PostBox (buy lines) and ShoppingBag (buy count) bumped
// alongside it for the same reason, since more buy throughput is what lets
// the policy actually spend on all this Luck/ramp supply once it's found.
const CRYSTAL_CAP = 10;
const POSTBOX_CAP = 6;
const SHOPPING_BAG_CAP = 5;
// Multiplier: enough for all 8 pins on the one target cookie plus some
// floating spares that occasionally land next to it or another cookie
// copy for a one-turn boost.
const MULTIPLIER_OWN_CAP = 12;
// A cell only has 8 neighbors -- this is a natural ceiling, not really a
// "cap" in the tunable sense, but named for consistency with the other
// strategies' explicit caps (documents the intent: no artificial limit
// below the physical maximum, unlike the cocktail strategy's
// MULTIPLIER_LOCK_CAP of 1).
const FORTUNE_MULTIPLIER_LOCK_CAP = 8;

const POOL_SPACE_MARGIN = 3;
const ROWS_MARGIN = 2;
const REFRESH_TIGHT_RATIO = 0.5;

const LATE_GAME_WINDOW = 10;
const LATE_GAME_MAX_REFRESHES = 5;

// Universal hazards, not specific to this engine -- same ordering and
// reasoning as gift-santa-strategy.test.js's GIFT_MESS_PRIORITY.
const MESS_PRIORITY = [VOLCANO, GAMBLER, DICE];

// Everything worth keeping in the pool. Refresh is deliberately NOT in here
// (see findMessTarget's standalone guard); neither is Clover/Cocktail/Rows
// -- all three are bought for a purpose and pruned once it's served (see
// the header comment).
const KEEP_SET = new Set([FORTUNE_COOKIE, MULT, CRYSTAL, POSTBOX, BAG]);

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

function countOwned(game, emoji) {
  const inInventory = game.inventory.symbols.filter(
    (s) => s.emoji() === emoji
  ).length;
  const passive = game.board.passiveCells.filter(
    (s) => s.emoji() === emoji
  ).length;
  return inInventory + passive;
}

function boardArea(game) {
  return game.settings.boardX * game.inventory.rowCount;
}

function poolSize(game) {
  return game.inventory.symbols.length + game.board.passiveCells.length;
}

function findEmojiTarget(game, emoji) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found || game.board.lockedAt(x, y)) return;
    if (cell.emoji() === emoji) found = [x, y];
  });
  return found;
}

function findPaidCreditCardTarget(game) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    if (cell.emoji() === CREDIT_CARD && cell.turn >= 1) found = [x, y];
  });
  return found;
}

function deriveCookieState(game) {
  const owned = game.inventory.symbols.some(
    (s) => s.emoji() === FORTUNE_COOKIE
  );
  let pinned = false;
  let pinnedAt = null;
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() === FORTUNE_COOKIE) {
      pinned = true;
      pinnedAt = addr.split(',').map(Number);
    }
  }
  return { owned, pinned, pinnedAt };
}

function bestCookieCell(game) {
  let coord = null;
  let neighbors = -1;
  game.board.forAllCells((cell, x, y) => {
    if (cell.emoji() === FORTUNE_COOKIE && !game.board.lockedAt(x, y)) {
      const n = game.board.nextToCoords(x, y).length;
      if (n > neighbors) {
        neighbors = n;
        coord = [x, y];
      }
    }
  });
  return { coord, neighbors };
}

function countLockedMultiplierNeighbors(game, pinnedAt) {
  if (!pinnedAt) return 0;
  return game.board
    .nextToCoords(pinnedAt[0], pinnedAt[1])
    .filter(
      ([x, y]) =>
        game.board.lockedAt(x, y) && game.board.getSymbol(x, y).emoji() === MULT
    ).length;
}

function findMultiplierNeighbor(game, pinnedAt) {
  if (!pinnedAt) return null;
  const [px, py] = pinnedAt;
  for (const [x, y] of game.board.nextToCoords(px, py)) {
    if (game.board.lockedAt(x, y)) continue;
    if (game.board.getSymbol(x, y).emoji() === MULT) return [x, y];
  }
  return null;
}

const SPACE_RELIEF_PRIORITY = [POSTBOX, BAG];
function findSpaceRelieverTarget(game) {
  for (const want of SPACE_RELIEF_PRIORITY) {
    const hit = findEmojiTarget(game, want);
    if (hit) return hit;
  }
  return null;
}

// Ordered hazard cleanup, then generic low-priority pruning of anything
// else outside KEEP_SET -- with three conditional exceptions: Refresh is
// never a target (standalone guard, see KEEP_SET's comment), CreditCard is
// only handled by findPaidCreditCardTarget, Clover is skipped until enough
// CrystalBall exists, and Cocktail is skipped until it's finished eating
// the starting Cherries (see the header comment on both).
// `cookiePinned`: whether the one target FortuneCookie is already pinned --
// the clearest available signal that "the real engine is running" (see the
// header comment on the early-money bootstrap). Gating early-money removal
// on this, rather than making it fair game from turn 1, avoids a rebuy
// churn bug caught in testing: without this gate, generic cleanup could
// prune a Dragon/Jar/Briefcase well before the cookie/multiplier engine was
// actually ready to replace its income, so the policy just rebought it --
// some games cycled through 4-5+ copies against a cap of 3 (the same shape
// of bug fixed for Cocktail above, via countOwned(CHERRY) === 0).
function findMessTarget(game, cookiePinned) {
  for (const want of MESS_PRIORITY) {
    const hit = findEmojiTarget(game, want);
    if (hit) return hit;
  }
  const cloverRemovable = countOwned(game, CRYSTAL) >= CLOVER_CRYSTAL_THRESHOLD;
  const cocktailRemovable = countOwned(game, CHERRY) === 0;
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    const emoji = cell.emoji();
    if (emoji === '⬜' || emoji === CREDIT_CARD || emoji === REFRESH) return;
    if (emoji === CLOVER && !cloverRemovable) return;
    if (emoji === COCKTAIL && !cocktailRemovable) return;
    if (EARLY_MONEY_PRIORITY.includes(emoji) && !cookiePinned) return;
    if (!KEEP_SET.has(emoji)) found = [x, y];
  });
  return found;
}

// Adaptive "fortune cookie engine" policy -- see the file header for the
// full rationale behind each tier.
async function fortuneCookiePolicy(game, diag, turn) {
  const turnsRemaining = game.inventory.getResource(Const.TURNS);
  const cookieSpot = bestCookieCell(game);
  let offersRef = null;
  let boughtIds = new Set();
  let guard = 0;
  // Same reasoning as the cocktail strategy's huntBudget: hunting
  // specifically for the ideal 8-neighbor cell is valuable but not free,
  // capped so it can't crowd out everything else the policy needs to do in
  // one turn.
  let huntBudget = 15;
  while (game.shop.buyCount > 0 && guard++ < 80) {
    if (game.shop.currentOffers !== offersRef) {
      offersRef = game.shop.currentOffers;
      boughtIds = new Set();
    }
    const state = deriveCookieState(game);
    const available = game.shop.currentOffers
      .map((o, id) => ({ ...o, id }))
      .filter((o) => !boughtIds.has(o.id));

    let chosenId = -1;
    let toolTarget = undefined;

    const commitBuy = async () => {
      boughtIds.add(chosenId);
      const boughtEmoji = game.shop.currentOffers[chosenId]?.symbol.emoji();
      if (toolTarget !== undefined) {
        game.view.primeToolTarget(toolTarget);
        if (boughtEmoji === PIN) {
          if (
            game.board.getSymbol(toolTarget[0], toolTarget[1]).emoji() ===
            FORTUNE_COOKIE
          ) {
            diag.cookiePins = (diag.cookiePins || 0) + 1;
            if (diag.cookiePinTurn === null) diag.cookiePinTurn = turn;
          } else {
            diag.multiplierLocksOnCookie =
              (diag.multiplierLocksOnCookie || 0) + 1;
          }
        }
        if (boughtEmoji === AXE) {
          const targetEmoji = game.board
            .getSymbol(toolTarget[0], toolTarget[1])
            .emoji();
          diag.axeCount = (diag.axeCount || 0) + 1;
          if (targetEmoji === VOLCANO)
            diag.volcanoAxed = (diag.volcanoAxed || 0) + 1;
          if (targetEmoji === CLOVER)
            diag.cloverAxed = (diag.cloverAxed || 0) + 1;
          if (targetEmoji === COCKTAIL)
            diag.cocktailAxed = (diag.cocktailAxed || 0) + 1;
          if (EARLY_MONEY_PRIORITY.includes(targetEmoji))
            diag.earlyMoneyAxed = (diag.earlyMoneyAxed || 0) + 1;
        }
      }
      if (boughtEmoji === FORTUNE_COOKIE) {
        diag.cookieBought = (diag.cookieBought || 0) + 1;
        if (diag.cookieBoughtTurn === null) diag.cookieBoughtTurn = turn;
      }
      if (boughtEmoji === COCKTAIL)
        diag.cocktailBought = (diag.cocktailBought || 0) + 1;
      if (boughtEmoji === CLOVER)
        diag.cloverBought = (diag.cloverBought || 0) + 1;
      if (boughtEmoji === CRYSTAL)
        diag.crystalBought = (diag.crystalBought || 0) + 1;
      if (boughtEmoji === ROWS) diag.rowsBought = (diag.rowsBought || 0) + 1;
      if (EARLY_MONEY_PRIORITY.includes(boughtEmoji))
        diag.earlyMoneyBought = (diag.earlyMoneyBought || 0) + 1;
      await game.shop.attemptPurchase(game, chosenId);
    };

    // ===== Tier 0: unconditional =====

    // Volcano: remove on sight, no exceptions.
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findEmojiTarget(game, VOLCANO);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Convert the starting Refresh copy to passive as soon as possible.
    const refreshIsPassive = game.inventory.getResource(REFRESH) > 0;
    if (chosenId === -1 && !refreshIsPassive) {
      const eyeHit = available.find((o) => o.symbol.emoji() === EYE);
      if (eyeHit) {
        const target = findEmojiTarget(game, REFRESH);
        if (target) {
          chosenId = eyeHit.id;
          toolTarget = target;
        }
      }
    }

    // CrystalBall -> passive, unconditionally and early -- see the header
    // comment: Luck resets every turn, so a passive CrystalBall (always
    // active) is worth far more than one that only helps on the turns it
    // happens to be drawn onto the board.
    if (chosenId === -1) {
      const eyeHit = available.find((o) => o.symbol.emoji() === EYE);
      if (eyeHit) {
        const target = findEmojiTarget(game, CRYSTAL);
        if (target) {
          chosenId = eyeHit.id;
          toolTarget = target;
        }
      }
    }

    // Hunting flag: a true 8-neighbor cell is rare -- worth refreshing
    // specifically to look for one (skipping other buys this pass) rather
    // than settling early, same reasoning as the cocktail strategy.
    let huntingIdealPin = false;
    if (
      chosenId === -1 &&
      huntBudget > 0 &&
      state.owned &&
      !state.pinned &&
      cookieSpot.coord &&
      cookieSpot.neighbors === 8 &&
      !available.some((o) => o.symbol.emoji() === PIN)
    ) {
      huntingIdealPin = true;
    }

    // Patient pin: hold out for an 8-neighbor cell, settling only once the
    // game is nearly over.
    if (
      chosenId === -1 &&
      state.owned &&
      !state.pinned &&
      cookieSpot.coord &&
      (cookieSpot.neighbors === 8 || turnsRemaining <= 10)
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = cookieSpot.coord;
      }
    }

    // Lock every unlocked Multiplier neighbor of the pinned cookie, up to
    // all 8 -- "trying to get one cookie surrounded by 8 multipliers if
    // possible" per the player.
    const multiplierNeighbor =
      state.pinned &&
      countLockedMultiplierNeighbors(game, state.pinnedAt) <
        FORTUNE_MULTIPLIER_LOCK_CAP
        ? findMultiplierNeighbor(game, state.pinnedAt)
        : null;
    if (chosenId === -1 && multiplierNeighbor) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = multiplierNeighbor;
      }
    }

    // Defuse a paid-off CreditCard the moment Axe is available.
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

    // Close to the pool limit: free space via Eye (PostBox/ShoppingBag --
    // CrystalBall already has its own earlier, unconditional slot above)
    // instead of continuing to acquire more.
    const poolLimit = boardArea(game) + (refreshIsPassive ? 5 : 0);
    const nearPoolLimit = poolSize(game) >= poolLimit - POOL_SPACE_MARGIN;
    if (chosenId === -1 && nearPoolLimit) {
      const hit = available.find((o) => o.symbol.emoji() === EYE);
      if (hit) {
        const target = findSpaceRelieverTarget(game);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // ===== Tier 1: build the ramp -- worth refreshing for =====

    // Cocktail: exactly one, to auto-clear the starting Cherries (see
    // header comment) -- not part of this engine's scoring. Gated on
    // remaining Cherry too, not just "not already owned": once the Cherries
    // are gone, a from-scratch Cocktail has nothing left to eat and would
    // just become immediate Axe bait again, needlessly repurchasing and
    // re-pruning it every time one gets cleaned up (a real bug caught in
    // testing -- some games bought/axed Cocktail 5-6 times over).
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      countOwned(game, COCKTAIL) < 1 &&
      countOwned(game, CHERRY) > 0
    ) {
      const hit = available.find((o) => o.symbol.emoji() === COCKTAIL);
      if (hit) chosenId = hit.id;
    }

    // Clover: a few, to jumpstart Luck before CrystalBall supply exists --
    // stop once CrystalBall has caught up (see CLOVER_CRYSTAL_THRESHOLD).
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, CLOVER) < CLOVER_CAP &&
      countOwned(game, CRYSTAL) < CLOVER_CRYSTAL_THRESHOLD
    ) {
      const hit = available.find((o) => o.symbol.emoji() === CLOVER);
      if (hit) chosenId = hit.id;
    }

    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, CRYSTAL) < CRYSTAL_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === CRYSTAL);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, POSTBOX) < POSTBOX_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === POSTBOX);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, BAG) < SHOPPING_BAG_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === BAG);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, MULT) < MULTIPLIER_OWN_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === MULT);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, FORTUNE_COOKIE) < FORTUNE_COOKIE_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === FORTUNE_COOKIE);
      if (hit) chosenId = hit.id;
    }
    // Rows: grow the board toward the pool size, not past it.
    if (chosenId === -1 && boardArea(game) < poolSize(game) - ROWS_MARGIN) {
      const hit = available.find((o) => o.symbol.emoji() === ROWS);
      if (hit) chosenId = hit.id;
    }
    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    // Decision point: refresh looking for a Tier-0/1 want, or settle for
    // Tier-2 cleanup -- same late-game throttle/pin-hunting bias as
    // gift-santa-strategy.test.js, retargeted at this strategy's own pin
    // opportunities.
    const inLateGame = turnsRemaining <= LATE_GAME_WINDOW;
    const lateRefreshExhausted =
      inLateGame && (diag.lateRefreshCount || 0) >= LATE_GAME_MAX_REFRESHES;
    const money = game.inventory.getResource(Const.MONEY);
    const canRefresh =
      turnsRemaining > 3 &&
      !lateRefreshExhausted &&
      game.shop.allowRefresh &&
      (game.shop.haveRefreshSymbol || game.shop.refreshCount === 0);
    const affordableRefresh = canRefresh && game.shop.refreshCost <= money;
    const budgetTight =
      !affordableRefresh ||
      game.shop.refreshCost >= money * REFRESH_TIGHT_RATIO;

    const pinHuntTarget =
      inLateGame && affordableRefresh
        ? (!state.pinned && cookieSpot.coord) ||
          findMultiplierNeighbor(game, state.pinnedAt)
        : null;
    const huntingLatePin =
      pinHuntTarget && !available.some((o) => o.symbol.emoji() === PIN);

    if (!budgetTight || huntingLatePin) {
      if (huntingIdealPin) huntBudget--;
      diag.refreshCount = (diag.refreshCount || 0) + 1;
      if (inLateGame) diag.lateRefreshCount = (diag.lateRefreshCount || 0) + 1;
      await game.shop.attemptRefresh(game);
      continue;
    }

    // ===== Tier 2: settle for it, once refresh budget is tight =====

    // Early money bootstrap (Dragon/Jar/Briefcase): a true settle-for --
    // "ramping up luck should always be priority number one" per the
    // player. Tier 1 buys anything offered there immediately and moves on,
    // so putting this in Tier 1 at all (regardless of priority order among
    // Tier-1 items -- tried and measured) meant taking it pre-empted
    // refreshing further to look for CrystalBall/Clover that turn. Tier 2
    // only runs once budgetTight is already true, i.e. the policy has
    // already given up hunting for something better this turn -- so this
    // can only ever fire when it isn't competing with the Luck ramp.
    if (
      chosenId === -1 &&
      EARLY_MONEY_PRIORITY.reduce((n, e) => n + countOwned(game, e), 0) <
        EARLY_MONEY_TOTAL_CAP
    ) {
      const hit = available.find((o) =>
        EARLY_MONEY_PRIORITY.includes(o.symbol.emoji())
      );
      if (hit) chosenId = hit.id;
    }

    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findMessTarget(game, state.pinned);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    if (affordableRefresh) {
      diag.refreshCount = (diag.refreshCount || 0) + 1;
      if (inLateGame) diag.lateRefreshCount = (diag.lateRefreshCount || 0) + 1;
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
    cookiePins: 0,
    cookiePinTurn: null,
    cookieBought: 0,
    cookieBoughtTurn: null,
    multiplierLocksOnCookie: 0,
    cocktailBought: 0,
    cocktailAxed: 0,
    cloverBought: 0,
    cloverAxed: 0,
    crystalBought: 0,
    rowsBought: 0,
    earlyMoneyBought: 0,
    earlyMoneyAxed: 0,
    axeCount: 0,
    volcanoAxed: 0,
    refreshCount: 0,
    lateRefreshCount: 0,
  };
  let turn = 0;
  while (!game.isOver && turn < 60) {
    turn++;
    await playTurn(game, policy, diag, turn);
  }
  const score = game.inventory.getResource(Const.MONEY);
  diag.finalBoardArea = boardArea(game);
  diag.finalPoolSize = poolSize(game);
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

describe('scratch: fortune-cookie strategy playtest', () => {
  it('plays N full games with the adaptive fortune-cookie policy', async () => {
    const N = 60;
    const results = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(
        `fortune-cookie-playtest-${i}`,
        fortuneCookiePolicy
      );
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
    console.log('\n=== Fortune-cookie strategy results ===');
    results.forEach((r, i) => {
      console.log(
        `game ${i}\tscore ${r.score}\tcookieTurn=${r.diag.cookieBoughtTurn}\tpinTurn=${r.diag.cookiePinTurn}\tmultLocks=${r.diag.multiplierLocksOnCookie}\tcookieBought=${r.diag.cookieBought}\tcocktailBought=${r.diag.cocktailBought}\tcocktailAxed=${r.diag.cocktailAxed}\tcloverBought=${r.diag.cloverBought}\tcloverAxed=${r.diag.cloverAxed}\tcrystalBought=${r.diag.crystalBought}\trowsBought=${r.diag.rowsBought}\tearlyMoneyBought=${r.diag.earlyMoneyBought}\tearlyMoneyAxed=${r.diag.earlyMoneyAxed}\tvolcanoAxed=${r.diag.volcanoAxed}\taxe=${r.diag.axeCount}\tboard=${r.diag.finalBoardArea}\tpool=${r.diag.finalPoolSize}\ttrophy=${getTrophy(settings, r.score)}`
      );
    });
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );

    const pinRate =
      results.filter((r) => r.diag.cookiePinTurn !== null).length /
      results.length;
    console.log(`cookie-pinned rate: ${(pinRate * 100).toFixed(0)}%`);

    const avgRefresh =
      results.reduce((s, r) => s + r.diag.refreshCount, 0) / results.length;
    const avgLateRefresh =
      results.reduce((s, r) => s + r.diag.lateRefreshCount, 0) / results.length;
    console.log(
      `avg refreshes/game: ${avgRefresh.toFixed(1)} (of which late-game: ${avgLateRefresh.toFixed(1)}, cap ${LATE_GAME_MAX_REFRESHES})`
    );

    const avgMultLocks =
      results.reduce((s, r) => s + r.diag.multiplierLocksOnCookie, 0) /
      results.length;
    console.log(
      `avg multiplier locks on cookie/game: ${avgMultLocks.toFixed(1)}`
    );

    const avgCocktailAxed =
      results.reduce((s, r) => s + r.diag.cocktailAxed, 0) / results.length;
    const avgCloverBought =
      results.reduce((s, r) => s + r.diag.cloverBought, 0) / results.length;
    const avgCloverAxed =
      results.reduce((s, r) => s + r.diag.cloverAxed, 0) / results.length;
    console.log(
      `avg cocktail axed/game: ${avgCocktailAxed.toFixed(2)} (1.0 = fully cleaned up), avg clover bought/game: ${avgCloverBought.toFixed(1)}, avg clover axed/game: ${avgCloverAxed.toFixed(1)}`
    );

    const avgEarlyMoneyBought =
      results.reduce((s, r) => s + r.diag.earlyMoneyBought, 0) / results.length;
    const avgEarlyMoneyAxed =
      results.reduce((s, r) => s + r.diag.earlyMoneyAxed, 0) / results.length;
    console.log(
      `avg early-money (dragon/jar/briefcase) bought/game: ${avgEarlyMoneyBought.toFixed(1)}, axed/game: ${avgEarlyMoneyAxed.toFixed(1)}`
    );

    const byLocks = new Map();
    for (const r of results) {
      const k = r.diag.multiplierLocksOnCookie;
      if (!byLocks.has(k)) byLocks.set(k, []);
      byLocks.get(k).push(r.score);
    }
    console.log('\navg score by multiplier locks on cookie:');
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
      const r = await playOneGame(`fortune-cookie-naive-${i}`, naivePolicy);
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
