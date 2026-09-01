// @vitest-environment jsdom
//
// Balance-testing playtest harness -- NOT part of the regular suite (see
// cocktail-strategy.test.js's header for the general rationale; same idea
// here, separate file since this is a genuinely different scoring engine).
// Drives the real Board/Shop/Inventory/Catalog on production GameSettings
// with an adaptive "gift engine" strategy, per the player's own framing:
//   - Same overall ramp as the cocktail strategy (Luck via CrystalBall, buy
//     count via ShoppingBag, buy lines via PostBox) but a LIGHTER version --
//     smaller caps (see CRYSTAL_CAP/POSTBOX_CAP/SHOPPING_BAG_CAP) -- since
//     this engine doesn't depend on cycling one specific rare item (Champagne)
//     through one specific cell the way Cocktail does; it just needs enough
//     Luck/throughput to keep finding Lootbox/Santa/Multiplier.
//   - Prioritize buying 🎁 Lootbox and 🧑‍🎄 Santa on sight, unconditionally.
//     Lootbox transforms into a random symbol (any non-tool, non-unbuyable
//     emoji, 20% chance of a rare one -- catalog.js's generateShop) the
//     first turn it's drawn onto the board, incrementing
//     inventory.giftsOpened; Santa pays 💵25 for every gift opened THIS RUN
//     (a single game-wide counter), so more copies of Lootbox opened over
//     the game raises the payout of every Santa at once, and (unlike a
//     shared-pool stockpile) N Santas each independently pay the full
//     25*giftsOpened, so stacking multiple Santas is straightforwardly good
//     rather than splitting a fixed resource.
//   - Pin every Santa found (no patience for an ideal neighbor count, unlike
//     Cocktail -- "lighter"/simpler), then pin every unlocked Multiplier
//     adjacent to an already-pinned Santa, with NO CAP on how many -- unlike
//     the cocktail strategy's MULTIPLIER_LOCK_CAP (1), the player explicitly
//     asked for "pinning as many santas to as many multipliers as possible,
//     no limit here": each pinned Multiplier permanently doubles that
//     Santa's neighbor-multiplier field every turn it stays adjacent
//     (advanced.js's Multiplier.evaluateProduce), so this is a genuinely
//     multiplicative (not additive) engine once several stack on one Santa.
//   - Gift-generated mess cleanup, in explicit priority order
//     (GIFT_MESS_PRIORITY): 🌋 Volcano is unconditionally removed the
//     instant Axe is available and it's found anywhere unlocked -- "the top
//     one is volcano for sure, because that can mess up the entire run"
//     per the player: its evaluateProduce has a 10% per-turn chance to
//     destroy whatever's in a random board cell (any cell, not just its own
//     neighbors) and replace it with a Hole + 5 Rocks, which could easily
//     wipe out a pinned Santa/Multiplier. 🤑 Gambler (drains 1% Luck every
//     turn it's on the board, and eats a neighboring CreditCard for -500)
//     and 🎲 Dice (slightly negative expected value: 0.2*456 - 0.8*123 =
//     -7.2/turn) are cleaned up next, then anything else outside KEEP_SET
//     falls to the same generic low-priority Axe pruning the cocktail
//     strategy uses (Rock/Hole/Coin/MoneyBag/etc. -- low-value clutter that
//     only dilutes the pool). CreditCard itself is handled the same way as
//     the cocktail strategy -- defused via Axe only *after* it's already
//     paid its one-time +1000 (see findPaidCreditCardTarget), never before.
//   - Lootbox purchases are gated by pool-vs-board size: "when the
//     inventory size is greater than the board size don't open too many
//     gifts" per the player -- board.roll() draws min(poolSize, boardCells)
//     symbols per turn, so once the pool outgrows the board, each
//     individual pool member's odds of even landing on the board (let alone
//     an unopened Lootbox specifically) start shrinking, making further
//     Lootbox purchases increasingly wasted buys sitting in the pool rather
//     than actually getting opened. See LOOTBOX_POOL_MARGIN.
//   - Rows (🎰, board expansion) are bought -- unlike the cocktail strategy,
//     which explicitly never buys them -- but targeted to keep the board
//     "close to" the pool size rather than let either run away: bought
//     while boardArea < poolSize - ROWS_MARGIN, and NOT in KEEP_SET, so once
//     that gap closes any copy still sitting in the pool gets pruned by the
//     generic Axe cleanup instead of continuing to grow the board every
//     time it happens to be drawn onto the board (Rows.evaluateProduce adds
//     a row EVERY turn it's on the board, not just once -- leaving one
//     permanently in the pool/on the board risks unbounded board growth,
//     which is exactly the "overboard" the player warned against).
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

const LOOTBOX = '🎁';
const SANTA = '🧑‍🎄';
const MULT = '❎';
const CRYSTAL = '🔮';
const POSTBOX = '📮';
const BAG = '🛍️';
const REFRESH = '🔀';
const ROWS = '🎰';
const PIN = '📌';
const EYE = '🧿';
const AXE = '🪓';

const VOLCANO = '🌋';
const GAMBLER = '🤑';
const DICE = '🎲';
const CREDIT_CARD = '💳';

// Lighter ramp than the cocktail strategy's (which left CrystalBall/PostBox
// uncapped) -- this engine doesn't need as much throughput, just enough
// Luck/buy-count/buy-lines to keep finding Lootbox/Santa/Multiplier.
const CRYSTAL_CAP = 5;
const POSTBOX_CAP = 4;
const SHOPPING_BAG_CAP = 3;

// How close pool size can get to the effective refresh-symbol-reliability
// limit before shifting to space relief -- same idea as the cocktail
// strategy's POOL_SPACE_MARGIN, just relative to a moving boardArea target
// here instead of a fixed constant (see below).
const POOL_SPACE_MARGIN = 3;
// Stop buying more Lootbox once poolSize is within this many slots of
// boardArea -- "when the inventory size is greater than the board size
// don't open too many gifts" per the player.
const LOOTBOX_POOL_MARGIN = 0;
// Keep buying Rows while boardArea is at least this far below poolSize --
// "make it close to inventory size [but] shouldn't go overboard".
const ROWS_MARGIN = 2;

const REFRESH_TIGHT_RATIO = 0.5;

// Cap Santa purchases to a share of the pool -- "be more conservative...
// the rest should be kept for helpful symbols we haven't made passive yet
// and ultimately multipliers" per the player. Scales with the pool (not a
// fixed count), so the cap grows as the game does.
const SANTA_POOL_SHARE = 0.33;

// In the final stretch, refreshing gets throttled hard (at most
// LATE_GAME_MAX_REFRESHES total across this window, none at all once
// turnsRemaining <= 3) but what refreshing IS still done should be spent
// hunting for Pin specifically -- "aggressively looking for pins towards
// the end" per the player: with the game almost over, a Multiplier or
// Santa that never gets locked in never pays off, so the scarce late
// refreshes are worth spending on finding Pin over anything else.
const LATE_GAME_WINDOW = 10;
const LATE_GAME_MAX_REFRESHES = 5;

// Ordered removal priority for gift-generated mess, per the player: Volcano
// is #1 without question (see header comment); Gambler and Dice follow.
// Volcano additionally gets its own unconditional Tier-0 check below (not
// just this list) since even one turn's delay risks losing something
// valuable to its per-turn destroy chance.
const GIFT_MESS_PRIORITY = [VOLCANO, GAMBLER, DICE];

// Everything worth keeping in the pool -- anything else drawn onto the
// board is Axe bait (see findJunkTarget). Rows is deliberately NOT in here
// -- see the header comment on why it needs pruning once its job is done.
const KEEP_SET = new Set([
  LOOTBOX,
  SANTA,
  MULT,
  CRYSTAL,
  POSTBOX,
  BAG,
  REFRESH,
]);

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

// Board area as of the *next* roll -- Board.roll() resizes to
// inventory.rowCount before drawing (see board.js), so that's the number
// that actually governs draw odds, not board.currentRows (which lags by
// one roll right after a Rows purchase).
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

// CreditCard pays 💵1000 the first turn it scores, then -💵1100 on the
// game's very last turn -- Axing it any time after that first payout keeps
// the 1000 and never pays the penalty. `.turn` is CreditCard's own
// paid-once counter (symbols/money.js), not the game's turn number.
function findPaidCreditCardTarget(game) {
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    if (cell.emoji() === CREDIT_CARD && cell.turn >= 1) found = [x, y];
  });
  return found;
}

// First unlocked Multiplier sitting next to ANY already-pinned Santa --
// called repeatedly across turns, so with no cap this eventually locks
// every such opportunity as it arises (see header comment: no limit here).
function findMultiplierNeighborOfPinnedSanta(game) {
  for (const [addr, lc] of Object.entries(game.board.lockedCells)) {
    if (lc.symbol.emoji() !== SANTA) continue;
    const [sx, sy] = addr.split(',').map(Number);
    for (const [x, y] of game.board.nextToCoords(sx, sy)) {
      if (game.board.lockedAt(x, y)) continue;
      if (game.board.getSymbol(x, y).emoji() === MULT) return [x, y];
    }
  }
  return null;
}

// Ordered gift-mess cleanup target: Volcano/Gambler/Dice first (see
// GIFT_MESS_PRIORITY), then generic low-priority pruning of anything else
// outside KEEP_SET (Rock/Hole/Coin/MoneyBag/etc., and Rows once boardArea
// has caught up to poolSize -- see the header comment).
function findGiftMessTarget(game) {
  for (const want of GIFT_MESS_PRIORITY) {
    const hit = findEmojiTarget(game, want);
    if (hit) return hit;
  }
  let found = null;
  game.board.forAllCells((cell, x, y) => {
    if (found) return;
    if (game.board.lockedAt(x, y)) return;
    const emoji = cell.emoji();
    if (emoji === '⬜' || emoji === CREDIT_CARD) return;
    if (!KEEP_SET.has(emoji)) found = [x, y];
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

// Adaptive "gift engine" policy -- see the file header for the full
// rationale behind each tier.
async function giftSantaPolicy(game, diag) {
  const turnsRemaining = game.inventory.getResource(Const.TURNS);
  let offersRef = null;
  let boughtIds = new Set();
  let guard = 0;
  while (game.shop.buyCount > 0 && guard++ < 80) {
    if (game.shop.currentOffers !== offersRef) {
      offersRef = game.shop.currentOffers;
      boughtIds = new Set();
    }
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
            game.board.getSymbol(toolTarget[0], toolTarget[1]).emoji() === SANTA
          ) {
            diag.santaPins = (diag.santaPins || 0) + 1;
          } else {
            diag.multiplierLocksOnSanta =
              (diag.multiplierLocksOnSanta || 0) + 1;
          }
        }
        if (boughtEmoji === AXE) {
          const targetEmoji = game.board
            .getSymbol(toolTarget[0], toolTarget[1])
            .emoji();
          diag.axeCount = (diag.axeCount || 0) + 1;
          if (targetEmoji === VOLCANO)
            diag.volcanoAxed = (diag.volcanoAxed || 0) + 1;
        }
      }
      if (boughtEmoji === LOOTBOX)
        diag.lootboxBought = (diag.lootboxBought || 0) + 1;
      if (boughtEmoji === SANTA) diag.santaBought = (diag.santaBought || 0) + 1;
      if (boughtEmoji === ROWS) diag.rowsBought = (diag.rowsBought || 0) + 1;
      await game.shop.attemptPurchase(game, chosenId);
    };

    // ===== Tier 0: unconditional =====

    // Volcano: remove on sight, no exceptions -- see header comment.
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

    // Santa: capped at SANTA_POOL_SHARE of the pool -- see its comment.
    if (
      chosenId === -1 &&
      countOwned(game, SANTA) < poolSize(game) * SANTA_POOL_SHARE
    ) {
      const hit = available.find((o) => o.symbol.emoji() === SANTA);
      if (hit) chosenId = hit.id;
    }

    // Lootbox: take it unless the pool is already outgrowing the board
    // (see LOOTBOX_POOL_MARGIN and the header comment).
    if (
      chosenId === -1 &&
      poolSize(game) <= boardArea(game) + LOOTBOX_POOL_MARGIN
    ) {
      const hit = available.find((o) => o.symbol.emoji() === LOOTBOX);
      if (hit) chosenId = hit.id;
    }

    // Convert the starting Refresh copy to passive as soon as possible --
    // same reasoning as the cocktail strategy: keeps unlimited refreshing
    // per turn from depending on that one copy happening to be drawn.
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

    // Pin any unlocked Santa on sight -- no patience for an ideal neighbor
    // count, unlike the cocktail strategy's Cocktail placement (see header:
    // "lighter").
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        const target = findEmojiTarget(game, SANTA);
        if (target) {
          chosenId = hit.id;
          toolTarget = target;
        }
      }
    }

    // Pin any unlocked Multiplier adjacent to an already-pinned Santa -- NO
    // CAP (see header comment).
    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === PIN);
      if (hit) {
        const target = findMultiplierNeighborOfPinnedSanta(game);
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

    // ===== Tier 1: build the (lighter) ramp -- worth refreshing for =====

    if (
      chosenId === -1 &&
      !nearPoolLimit &&
      countOwned(game, BAG) < SHOPPING_BAG_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === BAG);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !nearPoolLimit &&
      countOwned(game, CRYSTAL) < CRYSTAL_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === CRYSTAL);
      if (hit) chosenId = hit.id;
    }
    if (
      chosenId === -1 &&
      !nearPoolLimit &&
      countOwned(game, POSTBOX) < POSTBOX_CAP
    ) {
      const hit = available.find((o) => o.symbol.emoji() === POSTBOX);
      if (hit) chosenId = hit.id;
    }
    // Multiplier: uncapped supply, to match the uncapped pinning above --
    // no point pinning without limit if purchases are capped.
    if (chosenId === -1 && !nearPoolLimit) {
      const hit = available.find((o) => o.symbol.emoji() === MULT);
      if (hit) chosenId = hit.id;
    }
    // Rows: grow the board toward the pool size, not past it (see header
    // comment and ROWS_MARGIN).
    if (chosenId === -1 && boardArea(game) < poolSize(game) - ROWS_MARGIN) {
      const hit = available.find((o) => o.symbol.emoji() === ROWS);
      if (hit) chosenId = hit.id;
    }

    if (chosenId !== -1) {
      await commitBuy();
      continue;
    }

    // Decision point: refresh looking for a Tier-0/1 want, or settle for
    // Tier-2 cleanup, same refresh-budget-tight logic as the cocktail
    // strategy -- except in the final LATE_GAME_WINDOW turns, where total
    // refreshing is capped (LATE_GAME_MAX_REFRESHES) and, within that
    // shrunken budget, biased toward hunting for Pin (see the const's
    // comment). turnsRemaining > 3 (no refreshing at all in the last 3
    // turns) is unchanged from before.
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
        ? findEmojiTarget(game, SANTA) ||
          findMultiplierNeighborOfPinnedSanta(game)
        : null;
    const huntingLatePin =
      pinHuntTarget && !available.some((o) => o.symbol.emoji() === PIN);

    if (!budgetTight || huntingLatePin) {
      diag.refreshCount = (diag.refreshCount || 0) + 1;
      if (inLateGame) diag.lateRefreshCount = (diag.lateRefreshCount || 0) + 1;
      await game.shop.attemptRefresh(game);
      continue;
    }

    // ===== Tier 2: settle for gift-mess cleanup =====

    if (chosenId === -1) {
      const hit = available.find((o) => o.symbol.emoji() === AXE);
      if (hit) {
        const target = findGiftMessTarget(game);
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
    santaPins: 0,
    multiplierLocksOnSanta: 0,
    axeCount: 0,
    volcanoAxed: 0,
    lootboxBought: 0,
    santaBought: 0,
    rowsBought: 0,
    refreshCount: 0,
    lateRefreshCount: 0,
  };
  let turn = 0;
  while (!game.isOver && turn < 60) {
    turn++;
    await playTurn(game, policy, diag, turn);
  }
  const score = game.inventory.getResource(Const.MONEY);
  diag.giftsOpened = game.inventory.giftsOpened;
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

describe('scratch: gift-santa strategy playtest', () => {
  it('plays N full games with the adaptive gift-santa policy', async () => {
    const N = 60;
    const results = [];
    for (let i = 0; i < N; i++) {
      const r = await playOneGame(`gift-santa-playtest-${i}`, giftSantaPolicy);
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
    console.log('\n=== Gift-Santa strategy results ===');
    results.forEach((r, i) => {
      console.log(
        `game ${i}\tscore ${r.score}\tgifts=${r.diag.giftsOpened}\tsantaBought=${r.diag.santaBought}\tsantaPins=${r.diag.santaPins}\tmultLocks=${r.diag.multiplierLocksOnSanta}\tlootboxBought=${r.diag.lootboxBought}\trowsBought=${r.diag.rowsBought}\tvolcanoAxed=${r.diag.volcanoAxed}\taxe=${r.diag.axeCount}\tboard=${r.diag.finalBoardArea}\tpool=${r.diag.finalPoolSize}\ttrophy=${getTrophy(settings, r.score)}`
      );
    });
    console.log(
      `min=${scores[0]} max=${scores[scores.length - 1]} avg=${avg} median=${median}`
    );

    const avgRefresh =
      results.reduce((s, r) => s + r.diag.refreshCount, 0) / results.length;
    const avgGifts =
      results.reduce((s, r) => s + r.diag.giftsOpened, 0) / results.length;
    const avgSantaBought =
      results.reduce((s, r) => s + r.diag.santaBought, 0) / results.length;
    const avgSantaPins =
      results.reduce((s, r) => s + r.diag.santaPins, 0) / results.length;
    const avgMultLocks =
      results.reduce((s, r) => s + r.diag.multiplierLocksOnSanta, 0) /
      results.length;
    const avgVolcanoAxed =
      results.reduce((s, r) => s + r.diag.volcanoAxed, 0) / results.length;
    const avgRows =
      results.reduce((s, r) => s + r.diag.rowsBought, 0) / results.length;
    const avgLateRefresh =
      results.reduce((s, r) => s + r.diag.lateRefreshCount, 0) / results.length;
    console.log(
      `avg refreshes/game: ${avgRefresh.toFixed(1)} (of which late-game: ${avgLateRefresh.toFixed(1)}, cap ${LATE_GAME_MAX_REFRESHES})`
    );
    console.log(`avg gifts opened/game: ${avgGifts.toFixed(1)}`);
    console.log(
      `avg santa bought/game: ${avgSantaBought.toFixed(1)}, avg santa pinned/game: ${avgSantaPins.toFixed(1)}, avg multiplier locks on santa/game: ${avgMultLocks.toFixed(1)}`
    );
    console.log(
      `avg volcano axed/game: ${avgVolcanoAxed.toFixed(2)}, avg rows bought/game: ${avgRows.toFixed(1)}`
    );

    const byLocks = new Map();
    for (const r of results) {
      const k = r.diag.multiplierLocksOnSanta;
      if (!byLocks.has(k)) byLocks.set(k, []);
      byLocks.get(k).push(r.score);
    }
    console.log('\navg score by multiplier locks on santa:');
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
      const r = await playOneGame(`gift-santa-naive-${i}`, naivePolicy);
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
