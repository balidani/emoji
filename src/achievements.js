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

import { BronzeMedal, GoatMedal } from './symbols/ui.js';
import { loadUnlocked, saveUnlocked } from './achievements-store.js';
import { formatBigNumber } from './core/util.js';

const FRUGAL_MAX_BUYS = 10;
const DRAGON_TARGET = 20;
const UNIQUE_SYMBOL_TARGET = 40;

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
    id: 'goat',
    name: 'GOAT',
    icon: GoatMedal.emoji,
    requiredMedal: GoatMedal,
    unlocked: "You're the GOAT. Disgustingly, emoji-slot-machine rich.",
    locked: `Reach 🐐 (💵${formatBigNumber(GoatMedal.threshold)}) and prove you're the Greatest Of All Time.`,
    test: () => true,
  },
];

export class Achievements {
  constructor(renderer) {
    this.view = renderer;
    this.defs = ACHIEVEMENTS;
    this.unlocked = loadUnlocked(); // Set<string> from localStorage
    // Achievements is constructed fresh per `new Game()`, so this naturally
    // tracks everything unlocked during the current run -- some defs (e.g.
    // pack_rat, dragon_rancher) can unlock on an earlier 'roll'/'buy'
    // evaluate() call, not just the final 'gameover' one, so the game-over
    // popup needs the whole run's unlocks, not just that last call's return
    // value (see Game.over()).
    this.unlockedThisRun = [];
  }
  // Returns the list of defs newly unlocked by this call (empty if none).
  evaluate(ctx) {
    const newlyUnlocked = [];
    for (const def of this.defs) {
      if (this.unlocked.has(def.id)) continue;
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
      try {
        if (def.test(ctx)) {
          this.unlocked.add(def.id);
          newlyUnlocked.push(def);
          this.view.notifyAchievement?.(def); // optional toast
        }
      } catch {
        // A def reading missing state never breaks a turn.
      }
    }
    if (newlyUnlocked.length > 0) {
      this.unlockedThisRun.push(...newlyUnlocked);
      saveUnlocked(this.unlocked);
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
