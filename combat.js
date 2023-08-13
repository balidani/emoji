import { CombatView } from './view.js';

export class CombatSim {
  constructor(hero, enemy) {
    this.model = {
      hero: hero.copy(),
      enemy: enemy.copy(),
    };

    this.view = new CombatView(this.model);
  }
  step() {
    this.model.hero.step(this.model.enemy);
    this.model.enemy.step(this.model.hero);

    if (this.model.hero.hp <= 0 && this.model.enemy.hp <= 0) {
      return 'draw';
    } else if (this.model.hero.hp <= 0) {
      return 'loss';
    } else if (this.model.enemy.hp <= 0) {
      return 'win';
    }
    return 'continue';
  }
  done() {
    return false;
  }
}
