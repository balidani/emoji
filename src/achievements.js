// Achievement definitions + unlock engine (see ACHIEVEMENTS_DESIGN.md,
// section 6). Definitions are plain data; the medal-gated ones read their
// medal class from symbols/ui.js so score thresholds live in exactly one
// place.
//
// Every achievement now requires reaching at least a `requiredMedal` medal
// by the end of the run (configurable per achievement -- currently all set
// to BronzeMedal, except `goat` which is *about* reaching GoatMedal). The
// engine enforces this centrally (see Achievements.evaluate below), so a
// def's own `test` only needs to describe the underlying condition -- it
// doesn't need to check the score itself. All achievements are single-run,
// evaluated against state built up over that run.

import { BronzeMedal, GoldMedal, GoatMedal } from './symbols/ui.js';
import { loadUnlocked, saveUnlocked } from './achievements-store.js';
import { formatBigNumber } from './core/util.js';

const FRUGAL_MAX_BUYS = 10;
const DRAGON_TARGET = 20;
const UNIQUE_SYMBOL_TARGET = 40;
const ROW_TARGET = 50;
const PRESENTS_TARGET = 50;
const BANKRUPT_THRESHOLD = -20000;

// ctx = { event: 'roll' | 'buy' | 'gameover', stats, inventory, finalScore? }
export const ACHIEVEMENTS = [
  {
    id: 'pack_rat',
    name: 'Pack Rat',
    icon: '🎒',
    requiredMedal: BronzeMedal,
    unlocked: 'Held 100 symbols at once.',
    locked: 'Have an inventory of 100 symbols at the same time.',
    test: (c) => c.stats.run.maxInventorySize >= 100,
  },
  {
    id: 'all_in',
    name: 'All In',
    icon: '💫',
    requiredMedal: BronzeMedal,
    unlocked: 'Reached 100% luck.',
    locked: 'Reach 100% luck (💫 100).',
    test: (c) => c.stats.run.maxLuck >= 100,
  },
  {
    id: 'dragon_rancher',
    name: 'Dragon Rancher',
    icon: '🐉',
    requiredMedal: BronzeMedal,
    unlocked: `Hatched ${DRAGON_TARGET} dragons from eggs.`,
    locked: `Hatch ${DRAGON_TARGET} 🐉 from 🥚.`,
    test: (c) => c.stats.runTransforms('🥚', '🐉') >= DRAGON_TARGET,
  },
  {
    id: 'collector',
    name: 'Collector',
    icon: '🗂️',
    requiredMedal: BronzeMedal,
    unlocked: `Held ${UNIQUE_SYMBOL_TARGET} different symbols in your inventory at once.`,
    locked: `Have ${UNIQUE_SYMBOL_TARGET} different symbols in your inventory at the same time.`,
    test: (c) => c.stats.run.maxUniqueSymbols >= UNIQUE_SYMBOL_TARGET,
  },
  {
    id: 'frugal_bronze',
    name: 'Frugal',
    icon: BronzeMedal.emoji,
    requiredMedal: BronzeMedal,
    unlocked: `Earned a medal buying ${FRUGAL_MAX_BUYS} or fewer symbols.`,
    locked: `Earn a medal while buying no more than ${FRUGAL_MAX_BUYS} symbols.`,
    test: (c) => c.stats.run.totalBought <= FRUGAL_MAX_BUYS,
  },
  {
    id: 'big_board',
    name: 'Big Board',
    icon: '🧱',
    requiredMedal: BronzeMedal,
    unlocked: `Grew the board to ${ROW_TARGET} rows.`,
    locked: `Grow the board to ${ROW_TARGET} rows.`,
    test: (c) => c.stats.run.maxRows >= ROW_TARGET,
  },
  {
    id: 'gift_guru',
    name: 'Gift Guru',
    icon: '🎁',
    requiredMedal: BronzeMedal,
    unlocked: `Opened ${PRESENTS_TARGET} presents.`,
    locked: `Open ${PRESENTS_TARGET} 🎁 presents.`,
    test: (c) => c.inventory.giftsOpened >= PRESENTS_TARGET,
  },
  {
    id: 'committed',
    name: 'Committed',
    icon: GoldMedal.emoji,
    requiredMedal: GoldMedal,
    unlocked: `Earned a ${GoldMedal.emoji} without refreshing the shop once.`,
    locked: `Earn a ${GoldMedal.emoji} without ever refreshing the shop.`,
    test: (c) => c.stats.run.refreshesUsed === 0,
  },
  {
    id: 'bankrupt',
    name: 'Bankrupt',
    icon: '💸',
    requiredMedal: null,
    unlocked: `Ended a run at 💵${formatBigNumber(BANKRUPT_THRESHOLD)} or worse. Impressive, in a way.`,
    locked: `End a run at 💵${formatBigNumber(BANKRUPT_THRESHOLD)} or lower. No trophy required, just commitment.`,
    test: (c) => c.event === 'gameover' && c.finalScore <= BANKRUPT_THRESHOLD,
  },
  {
    id: 'goat',
    name: 'GOAT',
    icon: GoatMedal.emoji,
    requiredMedal: GoatMedal,
    unlocked:
      "You're the GOAT. Disgustingly, emoji-slot-machine rich -- and you didn't even need a 🎟️ Free Turn to get there.",
    locked: `Reach 🐐 (💵${formatBigNumber(GoatMedal.threshold)}) without a single 🎟️ Free Turn, and prove you're the Greatest Of All Time.`,
    test: (c) => c.stats.run.freeTurnsGranted === 0,
  },
];

export class Achievements {
  constructor(renderer, isReplay = false) {
    this.view = renderer;
    this.defs = ACHIEVEMENTS;
    this.unlocked = loadUnlocked(); // Set<string> from localStorage
    // A replay's unlocks are evaluated (so its own game-over popup can show
    // what it earned) but never persisted -- see game.js's isReplay guard.
    this.isReplay = isReplay;
    // Achievements is constructed fresh per `new Game()`, so these two
    // naturally track this run only. `completedThisRun` is every def whose
    // conditions were satisfied this run -- including ones already unlocked
    // from a previous run, so the game-over popup can show "you did it
    // again" achievements too, not just brand-new ones (see Game.over()).
    // `unlockedThisRun` is the subset that's newly unlocked (i.e. it wasn't
    // already in `this.unlocked` when it was satisfied).
    this.completedThisRun = [];
    this.unlockedThisRun = [];
  }
  // Returns the list of defs newly unlocked by this call (empty if none).
  // Defs already unlocked from a previous run are still re-tested (not
  // skipped) so `completedThisRun` reflects this run's outcome, but their
  // `unlocked` state and localStorage entry are left untouched.
  evaluate(ctx) {
    const newlyUnlocked = [];
    const completedIds = new Set(this.completedThisRun.map((d) => d.id));
    for (const def of this.defs) {
      // Central medal gate: a def with `requiredMedal` only counts once the
      // run is actually over and its final score reached that medal -- so
      // it's only ever checked on the 'gameover' evaluate() call. Individual
      // `test` functions don't need to encode this themselves.
      if (def.requiredMedal) {
        if (ctx.event !== 'gameover') continue;
        if (
          ctx.finalScore === undefined ||
          ctx.finalScore < def.requiredMedal.threshold
        ) {
          continue;
        }
      }
      let satisfied;
      try {
        satisfied = def.test(ctx);
      } catch {
        // A def reading missing state never breaks a turn.
        satisfied = false;
      }
      if (!satisfied) continue;
      if (!completedIds.has(def.id)) {
        completedIds.add(def.id);
        this.completedThisRun.push(def);
      }
      if (!this.unlocked.has(def.id)) {
        this.unlocked.add(def.id);
        newlyUnlocked.push(def);
        // A replay doesn't actually unlock anything (see the persistence
        // guard below) -- a live "unlocked!" toast mid-replay would be
        // misleading. The game-over popup still shows what the run earned.
        if (!this.isReplay) {
          this.view.notifyAchievement?.(def); // optional toast
        }
      }
    }
    if (newlyUnlocked.length > 0) {
      this.unlockedThisRun.push(...newlyUnlocked);
      if (!this.isReplay) {
        saveUnlocked(this.unlocked);
      }
    }
    return newlyUnlocked;
  }
  panelModel() {
    return this.defs.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      unlocked: this.unlocked.has(d.id),
      description: this.unlocked.has(d.id) ? d.unlocked : d.locked,
      requiredMedalEmoji: d.requiredMedal?.emoji ?? null,
    }));
  }
  renderPanel() {
    this.view.renderAchievements?.(this.panelModel());
  }
}
