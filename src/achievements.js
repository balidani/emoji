// Achievement definitions + unlock engine (see ACHIEVEMENTS_DESIGN.md,
// section 6). Definitions are plain data; the frugal-medal defs read the
// medal classes from symbols/ui.js so score thresholds live in exactly one
// place.

import * as Const from './consts.js';
import { BronzeMedal, SilverMedal, GoldMedal } from './symbols/ui.js';
import { loadUnlocked, saveUnlocked } from './achievements-store.js';

const FRUGAL_MAX_BUYS = 10;
const DRAGON_TARGET = 10;

const frugalMedal = (MedalClass, id, name) => ({
  id,
  name,
  icon: MedalClass.emoji,
  unlocked: `Earned a ${MedalClass.emoji} buying ${FRUGAL_MAX_BUYS} or fewer symbols.`,
  locked: `Earn a ${MedalClass.emoji} (💵 ${MedalClass.threshold}) while buying no more than ${FRUGAL_MAX_BUYS} symbols.`,
  scope: 'run',
  test: (c) =>
    c.event === 'gameover' &&
    c.finalScore >= MedalClass.threshold &&
    c.stats.run.totalBought <= FRUGAL_MAX_BUYS,
});

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
    unlocked: `Hatched ${DRAGON_TARGET} dragons from eggs.`,
    locked: `Hatch ${DRAGON_TARGET} 🐉 from 🥚 (across all runs).`,
    scope: 'lifetime',
    test: (c) => c.stats.lifetimeTransforms('🥚', '🐉') >= DRAGON_TARGET,
  },
  frugalMedal(BronzeMedal, 'frugal_bronze', 'Frugal Bronze'),
  frugalMedal(SilverMedal, 'frugal_silver', 'Frugal Silver'),
  frugalMedal(GoldMedal, 'frugal_gold', 'Frugal Gold'),
];

export class Achievements {
  constructor(renderer) {
    this.view = renderer;
    this.defs = ACHIEVEMENTS;
    this.unlocked = loadUnlocked(); // Set<string> from localStorage
  }
  evaluate(ctx) {
    let changed = false;
    for (const def of this.defs) {
      if (this.unlocked.has(def.id)) continue;
      try {
        if (def.test(ctx)) {
          this.unlocked.add(def.id);
          changed = true;
          this.view.notifyAchievement?.(def); // optional toast
        }
      } catch {
        // A def reading missing state never breaks a turn.
      }
    }
    if (changed) saveUnlocked(this.unlocked);
    return changed;
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
