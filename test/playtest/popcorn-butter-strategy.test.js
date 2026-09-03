// @vitest-environment jsdom
//
// Balance-testing playtest harness -- NOT part of the regular suite (see
// cocktail-strategy.test.js's header for the general rationale). Drives the
// real Board/Shop/Inventory/Catalog on production GameSettings with an
// adaptive "popcorn engine" strategy -- a fourth alternative, per the
// player's own framing:
//   - Core engine: 🍿 Popcorn.score() pays 💵17, MULTIPLIED BY 4 for each
//     neighboring 🧈 Butter (food.js -- `score *= 4` per neighbor, not the
//     generic Multiplier-symbol mechanism at all) -- so one Popcorn with a
//     full ring of 7 Butter neighbors pays 17 * 4^7 = 278,528 per turn
//     before even touching Luck or anything else. "Make one pop corn locked
//     next to 7 butters and 1 ice" per the player -- patient pin for a full
//     8-neighbor cell (same pattern as the cocktail strategy's Cocktail
//     placement and the fortune-cookie strategy's cookie placement), then
//     lock Butter into up to 7 of its neighbor slots, reserving the 8th for
//     an anchor Ice.
//   - Both Popcorn (timeToLive = 2-7 turns) and Butter (7 turns) self-
//     destruct on their own internal `turns` counter regardless of being
//     pinned -- Board.evaluate() increments EVERY cell's `turns` every turn
//     unconditionally (see board.js), and locking only prevents random
//     replacement via roll(), not this. 🧊 Ice's evaluateProduce decrements
//     every NEIGHBOR's `turns` by 1 each turn, so one Ice permanently
//     adjacent to Popcorn/Butter exactly cancels that unconditional +1,
//     freezing its self-destruct clock indefinitely -- this is the actual
//     mechanical reason to lock Ice next to them, not just flavor. The one
//     anchor Ice in Popcorn's own ring only freezes Popcorn itself (plus
//     whichever 1-2 Butters happen to be geometrically adjacent to that
//     specific Ice cell too) -- freezing the REST of the 7 Butter ring needs
//     its own separate Ice, each placed adjacent to whichever Butter(s)
//     still lack Ice coverage -- "cover all the 7 neighboring butters with
//     ice as well" per the player.
//   - Late game: once a protected Popcorn/Butter's own natural remaining
//     life (counter(game) -- turns until it would melt/expire unaided)
//     already exceeds the turns actually left in the game, the Ice keeping
//     it frozen is no longer doing anything useful -- Axe it and let a
//     fresh Pin (via the same general Butter-ring-filling logic) claim that
//     now-open neighbor slot for one more Butter instead. "If the number of
//     turns left for the pop corn/butter is greater than the turns we have,
//     we can start clearing the last ices and try and fill those spots with
//     more butter" per the player.
//   - Popcorn is bought directly from the shop (rarity 0 -- needs enough
//     Luck stacked to ever be offered at all, same mechanism as Champagne/
//     Pin/Eye in the other strategies), capped at POPCORN_CAP (6) -- "let's
//     try this strategy without relying on corn entirely, just buying pop
//     corn from the shop, let's say up to 6 of them" per the player. 🌽 Corn
//     itself (which can spawn Popcorn for free, 15% chance/turn) is never
//     bought.
//   - Luck (CrystalBall/Clover) is stacked, but modestly (smaller caps than
//     the fortune-cookie strategy) -- "stack luck, shopping bag, post box,
//     but not extremely, we want to leave space on the board" per the
//     player: here Luck only helps surface rare/zero-rarity shop offers
//     (Popcorn/Pin/Ice/Axe/Eye), it isn't directly converted to money the
//     way FortuneCookie does, so it doesn't need nearly as much investment.
//   - One-time Cocktail purchase to auto-clear the starting Cherries, and
//     an early-money bootstrap (Dragon/Jar/Briefcase) placed as a Tier-2
//     settle-for so it never competes with the ramp -- both carried over
//     unchanged from the fortune-cookie strategy, including the same
//     buy-then-prune-later shape and the same lessons learned there (a
//     rebuy-churn bug fixed by gating removal on Popcorn actually being
//     pinned, and Tier-2 placement for the bootstrap so it can't pre-empt
//     refreshing for something better).
//   - Caps only count copies still in the active pool (not ones already
//     converted to passive) and the pool-space ceiling is relative to a
//     FIXED board (no Rows bought at all here either) -- same fix as the
//     fortune-cookie strategy, applied from the start this time instead of
//     being discovered as a bug partway through.
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

const POPCORN = '🍿';
const BUTTER = '🧈';
const ICE = '🧊';
const CRYSTAL = '🔮';
const POSTBOX = '📮';
const BAG = '🛍️';
const REFRESH = '🔀';
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

// "Up to 6 of them" per the player.
const POPCORN_CAP = 6;
// 7 needed for a full ring, plus a couple spares for replacement odds.
const BUTTER_CAP = 9;
// 1 anchor (Popcorn's own ring) + up to 7 coverage copies (one per Butter,
// though geometry means some coverage cells reach 2 Butters at once, so
// actual usage is usually well under this).
const ICE_CAP = 8;

// Modest -- "not extremely" per the player. Luck here only raises shop
// odds (Popcorn/Pin/Ice/Axe/Eye all benefit), it isn't scored directly.
const CRYSTAL_CAP = 4;
const CLOVER_CAP = 2;
const CLOVER_CRYSTAL_THRESHOLD = 2;
const POSTBOX_CAP = 4;
const SHOPPING_BAG_CAP = 3;

const EARLY_MONEY_PRIORITY = [DRAGON, JAR, BRIEFCASE];
const EARLY_MONEY_TOTAL_CAP = 3;

const POOL_SPACE_MARGIN = 3;
const REFRESH_TIGHT_RATIO = 0.5;

const LATE_GAME_WINDOW = 10;
const LATE_GAME_MAX_REFRESHES = 5;

const MESS_PRIORITY = [VOLCANO, GAMBLER, DICE];

// Everything worth keeping in the pool. Refresh is deliberately NOT in here
// (see findMessTarget's standalone guard); neither is Clover/Cocktail --
// both bought for a purpose and pruned once it's served.
const KEEP_SET = new Set([POPCORN, BUTTER, ICE, CRYSTAL, POSTBOX, BAG]);

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

// Only copies still in the active pool -- board.roll() draws exclusively
// from game.inventory.symbols (see poolSize's comment), so a passive copy
// doesn't compete for a board cell or dilute anything and shouldn't count
// against its own buy cap (a bug caught and fixed in the fortune-cookie
// strategy; applied correctly from the start here).
function countOwned(game, emoji) {
  return game.inventory.symbols.filter((s) => s.emoji() === emoji).length;
}

function boardArea(game) {
  return game.settings.boardX * game.inventory.rowCount;
}

// Only the active pool -- see countOwned's comment.
function poolSize(game) {
  return game.inventory.symbols.length;
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

function derivePopcornState(game) {
  const owned = game.inventory.symbols.some((s) => s.emoji() === POPCORN);
  let pinned = false;
  let pinnedAt = null;
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() === POPCORN) {
      pinned = true;
      pinnedAt = addr.split(',').map(Number);
    }
  }
  return { owned, pinned, pinnedAt };
}

function bestPopcornCell(game) {
  let coord = null;
  let neighbors = -1;
  game.board.forAllCells((cell, x, y) => {
    if (cell.emoji() === POPCORN && !game.board.lockedAt(x, y)) {
      const n = game.board.nextToCoords(x, y).length;
      if (n > neighbors) {
        neighbors = n;
        coord = [x, y];
      }
    }
  });
  return { coord, neighbors };
}

function countLockedNeighborsOfType(game, pinnedAt, emoji) {
  if (!pinnedAt) return 0;
  return game.board
    .nextToCoords(pinnedAt[0], pinnedAt[1])
    .filter(
      ([x, y]) =>
        game.board.lockedAt(x, y) &&
        game.board.getSymbol(x, y).emoji() === emoji
    ).length;
}

function findNeighborTarget(game, pinnedAt, emoji) {
  if (!pinnedAt) return null;
  const [px, py] = pinnedAt;
  for (const [x, y] of game.board.nextToCoords(px, py)) {
    if (game.board.lockedAt(x, y)) continue;
    if (game.board.getSymbol(x, y).emoji() === emoji) return [x, y];
  }
  return null;
}

// For each Butter locked next to Popcorn, is there already a locked Ice
// adjacent to THAT Butter (any Ice -- the anchor one counts if it happens
// to reach it geometrically)? If not, look for an unlocked Ice sitting in
// one of that Butter's own neighbor cells -- "cover all the 7 neighboring
// butters with ice as well" per the player.
function findButterCoverageTarget(game, pinnedAt) {
  if (!pinnedAt) return null;
  for (const [bx, by] of game.board.nextToCoords(pinnedAt[0], pinnedAt[1])) {
    if (!game.board.lockedAt(bx, by)) continue;
    if (game.board.getSymbol(bx, by).emoji() !== BUTTER) continue;
    const covered = game.board
      .nextToCoords(bx, by)
      .some(
        ([x, y]) =>
          game.board.lockedAt(x, y) &&
          game.board.getSymbol(x, y).emoji() === ICE
      );
    if (covered) continue;
    const target = game.board
      .nextToCoords(bx, by)
      .find(
        ([x, y]) =>
          !game.board.lockedAt(x, y) &&
          game.board.getSymbol(x, y).emoji() === ICE
      );
    if (target) return target;
  }
  return null;
}

// Once the game's remaining turns are shorter than a protected symbol's own
// remaining lifespan (counter(game): turns until it melts/expires unaided),
// keeping it frozen no longer matters -- it would survive to game-end on
// its own anyway. Scans every locked Ice cell; an Ice qualifies for release
// once EVERY locked Popcorn/Butter neighbor it touches individually clears
// that bar (never releases one still protecting something that needs it).
// See the header comment.
function findReleasableIceTarget(game, turnsRemaining) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (!game.board.lockedAt(x, y)) return;
    if (cell.emoji() !== ICE) return;
    const protectedNeighbors = game.board
      .nextToCoords(x, y)
      .filter(([nx, ny]) => {
        if (!game.board.lockedAt(nx, ny)) return false;
        const e = game.board.getSymbol(nx, ny).emoji();
        return e === POPCORN || e === BUTTER;
      });
    if (protectedNeighbors.length === 0) return;
    const stillNeeded = protectedNeighbors.some(([nx, ny]) => {
      const sym = game.board.getSymbol(nx, ny);
      const remaining = sym.counter(game);
      return remaining === null || remaining <= turnsRemaining;
    });
    if (!stillNeeded) found = [x, y];
  });
  return found;
}

const SPACE_RELIEF_PRIORITY = [CRYSTAL, POSTBOX, BAG];
function findSpaceRelieverTarget(game) {
  for (const want of SPACE_RELIEF_PRIORITY) {
    const hit = findEmojiTarget(game, want);
    if (hit) return hit;
  }
  return null;
}

// `popcornPinned`: gates early-money removal (see EARLY_MONEY_PRIORITY's
// comment) -- the clearest available signal that the real engine is
// running, same reasoning as the fortune-cookie strategy's cookiePinned.
function findMessTarget(game, popcornPinned) {
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
    if (EARLY_MONEY_PRIORITY.includes(emoji) && !popcornPinned) return;
    if (!KEEP_SET.has(emoji)) found = [x, y];
  });
  return found;
}

// Adaptive "popcorn engine" policy -- see the file header for the full
// rationale behind each tier.
async function popcornButterPolicy(game, diag, turn) {
  const turnsRemaining = game.inventory.getResource(Const.TURNS);
  const popcornSpot = bestPopcornCell(game);
  let offersRef = null;
  let boughtIds = new Set();
  let guard = 0;
  let huntBudget = 15;
  while (game.shop.buyCount > 0 && guard++ < 80) {
    if (game.shop.currentOffers !== offersRef) {
      offersRef = game.shop.currentOffers;
      boughtIds = new Set();
    }
    const state = derivePopcornState(game);
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
          const targetEmoji = game.board
            .getSymbol(toolTarget[0], toolTarget[1])
            .emoji();
          if (targetEmoji === POPCORN) {
            diag.popcornPinTurn = diag.popcornPinTurn ?? turn;
          } else if (targetEmoji === BUTTER) {
            diag.butterLocks = (diag.butterLocks || 0) + 1;
          } else if (targetEmoji === ICE) {
            diag.iceLocks = (diag.iceLocks || 0) + 1;
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
          if (targetEmoji === ICE)
            diag.iceReleased = (diag.iceReleased || 0) + 1;
        }
      }
      if (boughtEmoji === POPCORN)
        diag.popcornBought = (diag.popcornBought || 0) + 1;
      if (boughtEmoji === BUTTER)
        diag.butterBought = (diag.butterBought || 0) + 1;
      if (boughtEmoji === ICE) diag.iceBought = (diag.iceBought || 0) + 1;
      if (boughtEmoji === COCKTAIL)
        diag.cocktailBought = (diag.cocktailBought || 0) + 1;
      if (boughtEmoji === CLOVER)
        diag.cloverBought = (diag.cloverBought || 0) + 1;
      if (boughtEmoji === CRYSTAL)
        diag.crystalBought = (diag.crystalBought || 0) + 1;
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

    // Hunting flag: a true 8-neighbor cell is required for the full ring
    // (a corner/edge cell physically can't hold 7 Butter + 1 Ice) -- worth
    // refreshing specifically to look for one rather than settling early.
    let huntingIdealPin = false;
    if (
      chosenId === -1 &&
      huntBudget > 0 &&
      state.owned &&
      !state.pinned &&
      popcornSpot.coord &&
      popcornSpot.neighbors === 8 &&
      !available.some((o) => o.symbol.emoji() === PIN)
    ) {
      huntingIdealPin = true;
    }

    // Patient pin: hold out for an 8-neighbor cell, settling only once the
    // game is nearly over (a partial ring is still better than none).
    if (
      chosenId === -1 &&
      state.owned &&
      !state.pinned &&
      popcornSpot.coord &&
      (popcornSpot.neighbors === 8 || turnsRemaining <= 10)
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        chosenId = hit.id;
        toolTarget = popcornSpot.coord;
      }
    }

    // Anchor Ice: exactly one, directly adjacent to Popcorn -- checked
    // ahead of Butter so an early Ice claims a ring slot before 8 Butters
    // could fill every one of them.
    if (
      chosenId === -1 &&
      state.pinned &&
      countLockedNeighborsOfType(game, state.pinnedAt, ICE) < 1
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        const target = findNeighborTarget(game, state.pinnedAt, ICE);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Butter ring: up to 7 (reserving the 8th slot for the anchor Ice).
    if (
      chosenId === -1 &&
      state.pinned &&
      countLockedNeighborsOfType(game, state.pinnedAt, BUTTER) < 7
    ) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        const target = findNeighborTarget(game, state.pinnedAt, BUTTER);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Per-Butter Ice coverage -- see findButterCoverageTarget's comment.
    if (chosenId === -1 && state.pinned) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        const target = findButterCoverageTarget(game, state.pinnedAt);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Late game: release Ice that's no longer protecting anything that
    // needs it, freeing the slot for one more Butter -- see the header
    // comment and findReleasableIceTarget.
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findReleasableIceTarget(game, turnsRemaining);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
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

    // Close to the pool limit: free space via Eye instead of continuing to
    // acquire more Crystal/PostBox/ShoppingBag.
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

    // ===== Tier 1: build the (modest) ramp -- worth refreshing for =====

    // Cocktail: exactly one, to auto-clear the starting Cherries -- gated
    // on remaining Cherry too, not just "not already owned" (a rebuy-churn
    // bug fixed in the fortune-cookie strategy).
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      countOwned(game, COCKTAIL) < 1 &&
      countOwned(game, CHERRY) > 0
    ) {
      const hit = available.find((o) => o.symbol.emoji() === COCKTAIL);
      if (hit) chosenId = hit.id;
    }
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
      countOwned(game, POPCORN) < POPCORN_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === POPCORN);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, BUTTER) < BUTTER_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === BUTTER);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !huntingIdealPin &&
      !nearPoolLimit &&
      countOwned(game, ICE) < ICE_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === ICE);
      if (hit) chosenId = hit.id;
    }

    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    // Decision point: refresh looking for a Tier-0/1 want, or settle for
    // Tier-2 cleanup -- same late-game throttle/pin-hunting bias as the
    // fortune-cookie strategy, retargeted at this strategy's own pin
    // opportunities (anchor Ice, the Butter ring, per-Butter coverage).
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
        ? (!state.pinned && popcornSpot.coord) ||
          findNeighborTarget(game, state.pinnedAt, ICE) ||
          findNeighborTarget(game, state.pinnedAt, BUTTER) ||
          findButterCoverageTarget(game, state.pinnedAt)
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

    // Early money bootstrap: a true settle-for -- see the header comment
    // and the fortune-cookie strategy's own note on why this can't be
    // Tier 1 without competing with the ramp.
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
    popcornBought: 0,
    popcornPinTurn: null,
    butterBought: 0,
    butterLocks: 0,
    iceBought: 0,
    iceLocks: 0,
    iceReleased: 0,
    cocktailBought: 0,
    cocktailAxed: 0,
    cloverBought: 0,
    cloverAxed: 0,
    crystalBought: 0,
    earlyMoneyBought: 0,
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

describe('scratch: popcorn-butter strategy playtest', () => {
  it('plays N full games with the adaptive popcorn-butter policy', async () => {
    const N = 60;
    const results = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(
        `popcorn-butter-playtest-${i}`,
        popcornButterPolicy
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
    console.log('\n=== Popcorn-butter strategy results ===');
    results.forEach((r, i) => {
      console.log(
        `game ${i}\tscore ${r.score}\tpinTurn=${r.diag.popcornPinTurn}\tbutterLocks=${r.diag.butterLocks}\ticeLocks=${r.diag.iceLocks}\ticeReleased=${r.diag.iceReleased}\tpopcornBought=${r.diag.popcornBought}\tbutterBought=${r.diag.butterBought}\ticeBought=${r.diag.iceBought}\tcocktailBought=${r.diag.cocktailBought}\tcocktailAxed=${r.diag.cocktailAxed}\tcrystalBought=${r.diag.crystalBought}\tearlyMoneyBought=${r.diag.earlyMoneyBought}\tvolcanoAxed=${r.diag.volcanoAxed}\taxe=${r.diag.axeCount}\tpool=${r.diag.finalPoolSize}\ttrophy=${getTrophy(settings, r.score)}`
      );
    });
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );

    const pinRate =
      results.filter((r) => r.diag.popcornPinTurn !== null).length /
      results.length;
    console.log(`popcorn-pinned rate: ${(pinRate * 100).toFixed(0)}%`);

    const avgRefresh =
      results.reduce((s, r) => s + r.diag.refreshCount, 0) / results.length;
    const avgLateRefresh =
      results.reduce((s, r) => s + r.diag.lateRefreshCount, 0) / results.length;
    console.log(
      `avg refreshes/game: ${avgRefresh.toFixed(1)} (of which late-game: ${avgLateRefresh.toFixed(1)}, cap ${LATE_GAME_MAX_REFRESHES})`
    );

    const avgButterLocks =
      results.reduce((s, r) => s + r.diag.butterLocks, 0) / results.length;
    const avgIceLocks =
      results.reduce((s, r) => s + r.diag.iceLocks, 0) / results.length;
    const avgIceReleased =
      results.reduce((s, r) => s + r.diag.iceReleased, 0) / results.length;
    console.log(
      `avg butter locks/game: ${avgButterLocks.toFixed(1)} (lifetime total -- can exceed 7 if an earlier Popcorn died and a new one was pinned elsewhere, orphaning its old ring), avg ice locks/game: ${avgIceLocks.toFixed(1)}, avg ice released late-game/game: ${avgIceReleased.toFixed(1)}`
    );

    const byLocks = new Map();
    for (const r of results) {
      const k = r.diag.butterLocks;
      if (!byLocks.has(k)) byLocks.set(k, []);
      byLocks.get(k).push(r.score);
    }
    console.log('\navg score by butter locks:');
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
      const r = await playOneGame(`popcorn-butter-naive-${i}`, naivePolicy);
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
