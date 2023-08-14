import { CombatView } from './view.js';

export class CombatSim {
  constructor(hero, enemy) {
    this.model = {
      hero: hero.copy(),
      enemy: enemy.copy(),
    };
    this.view = new CombatView(this.model);
    this.checkFirst();
    this.done = false;
  }
  checkFirst() {
    const heroValues = this.model.hero.computeValues();
    const enemyValues = this.model.enemy.computeValues();
    if (heroValues.speed > enemyValues.speed) {
      this.heroFirst = true;
    } else if (heroValues.speed === enemyValues.speed) {
      this.heroFirst = Math.random() > 0.5;
    } else {
      this.heroFirst = false;
    }
  }
  step() {
    const stepCharacter = (characterName, opponent) => {
      const log = this.stepOne(this.model[characterName], this.model[opponent]);
      this.view.addLog(log, characterName, opponent);
    };
    const stepHero = () => stepCharacter('hero', 'enemy');
    const stepEnemy = () => stepCharacter('enemy', 'hero');

    if (this.heroFirst) {
      stepHero();
      if (this.model.enemy.attribs.hp.value <= 0) {
        this.done = true;
        return 'win';
      }
      stepEnemy();
      if (this.model.hero.attribs.hp.value <= 0) {
        this.done = true;
        return 'loss';
      }
    } else {
      stepEnemy();
      if (this.model.hero.attribs.hp.value <= 0) {
        this.done = true;
        return 'loss';
      }
      stepHero();
      if (this.model.enemy.attribs.hp.value <= 0) {
        this.done = true;
        return 'win';
      }
    }
    return 'continue';
  }
  stepOne(hero, enemy) {
    const values = hero.computeValues();
    const enemyValues = enemy.computeValues();

    const log = [];

    if (hero.statuses['sleep'].value === 0) {
      // Does the hit land?
      let hitPercent = 0.55 + Math.sqrt(values.accuracy) * 0.092;
      if (Math.random() < hitPercent) {
        // Does the enemy manage to dodge?
        let dodgePercent = Math.max(0, enemyValues.fencing - values.fencing) * 0.035;
        if (Math.random() < dodgePercent) {
          log.push({type: 'dodge'});
        } else {
          const damageReduction = 16 / Math.pow(4 + enemyValues.armor * 0.1, 2);
          const baseDamage = (values.fencing + values.strength) * values.damage * 0.3;
          const strDiff = Math.max(0, values.strength - enemyValues.strength);
          const pierceDamage = Math.floor(Math.pow(1 + strDiff * 0.3, 2) * 0.22);
          const extraHits = Math.floor(Math.pow(2 + values.speed * 0.26, 2) * 0.06);
          const critMult = 0.92 + Math.sqrt(3 + values.strength * 0.41) * 0.23;
          const critPercent = Math.pow(3 + values.fencing * 0.35, 2) * 0.005;
          const isCrit = Math.random() < critPercent;

          const flatDamage = pierceDamage + (baseDamage - pierceDamage) * damageReduction;

          let totalDmg = 0;
          totalDmg = flatDamage;
          if (isCrit) {
            totalDmg *= critMult;
          }
          totalDmg = Math.ceil(totalDmg);

          enemy.attribs.hp.add(-totalDmg);
          log.push({type: 'hit', value: totalDmg, crit: isCrit});

          totalDmg = Math.ceil(flatDamage);
          let multiCount = 0;
          for (let i = 0; i < extraHits; ++i) {
            hitPercent *= 0.8;
            if (Math.random() > hitPercent) {
              continue;
            }
            multiCount++;
          }
          if (multiCount > 0) {
            enemy.attribs.hp.add(-totalDmg * multiCount);
            log.push({type: 'hit', value: totalDmg, multi: true, count: multiCount});
          }

        }
      } else {
        log.push({type: 'miss'});
      }
    }

    // Apply any bleed, poison.
    if (hero.statuses['bleed'].value > 0) {
      hero.attribs.hp.add(-hero.statuses['bleed'].value);
      log.push({type: 'status', status: 'bleed', value: hero.statuses['bleed'].value});
    }
    if (hero.statuses['poison'].value > 0) {
      hero.attribs.hp.add(-1);
      log.push({type: 'status', status: 'poison', value: 1});
    }

    // Decrease all statuses.
    for (const [key, status] of Object.entries(hero.statuses)) {
      if (status.value > 0) {
        status.add(-1);
      }
      if (status.value === 0) {
        status.hide();
      }
    }

    return log;
  }
  
  isDone() {
    return this.done;
  }
}
