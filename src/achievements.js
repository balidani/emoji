// Achievement definitions + unlock engine (see ACHIEVEMENTS_DESIGN.md,
// section 6). Definitions are plain data; the frugal-medal def reads the
// medal class from symbols/ui.js so score thresholds live in exactly one
// place.

import * as Const from './consts.js';
import { BronzeMedal } from './symbols/ui.js';
import { loadUnlocked, saveUnlocked } from './achievements-store.js';

const FRUGAL_MAX_BUYS = 10;
const DRAGON_TARGET = 20;
const UNIQUE_SYMBOL_TARGET = 40;

// ctx = { event: 'roll' | 'buy' | 'gameover', stats, inventory, finalScore? }
export const ACHIEVEMENTS = [
  {
    id: 'pack_rat',
    name: 'Pack Rat',
    icon: '🎒',
    unlocked: 'Held 100 symbols at once.',
    locked: 'Have an inventory of 100 symbols at the same time.',
    scope: 'run',
    test: (c) => c.inventory.symbols.length >= 100,
  },
  {
    id: 'all_in',
    name: 'All In',
    icon: '💫',
    unlocked: 'Reached 100% luck.',
    locked: 'Reach 100% luck (💫 100).',
    scope: 'run',
    test: (c) => c.inventory.getResource(Const.LUCK) >= 100,
  },
  {
    id: 'dragon_rancher',
    name: 'Dragon Rancher',
    icon: '🐉',
    unlocked: `Hatched ${DRAGON_TARGET} dragons from eggs in a single run.`,
    locked: `Hatch ${DRAGON_TARGET} 🐉 from 🥚 in a single run.`,
    scope: 'run',
    test: (c) => c.stats.runTransforms('🥚', '🐉') >= DRAGON_TARGET,
  },
  {
    id: 'collector',
    name: 'Collector',
    icon: '🗂️',
    unlocked: `Held ${UNIQUE_SYMBOL_TARGET} different symbols in your inventory at once.`,
    locked: `Have ${UNIQUE_SYMBOL_TARGET} different symbols in your inventory at the same time.`,
    scope: 'run',
    test: (c) =>
      new Set(c.inventory.symbols.map((s) => s.emoji())).size >=
      UNIQUE_SYMBOL_TARGET,
  },
  {
    id: 'frugal_bronze',
    name: 'Frugal',
    icon: BronzeMedal.emoji,
    unlocked: `Earned a ${BronzeMedal.emoji} buying ${FRUGAL_MAX_BUYS} or fewer symbols.`,
    locked: `Earn a ${BronzeMedal.emoji} (💵 ${BronzeMedal.threshold}) while buying no more than ${FRUGAL_MAX_BUYS} symbols.`,
    scope: 'run',
    test: (c) =>
      c.event === 'gameover' &&
      c.finalScore >= BronzeMedal.threshold &&
      c.stats.run.totalBought <= FRUGAL_MAX_BUYS,
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
    }));
  }
  renderPanel() {
    this.view.renderAchievements?.(this.panelModel());
  }
}
