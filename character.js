import { IntRef } from './ui.js';

export class Character {
  static statusOrder = ['fear', 'weak', 'slow', 'dizzy', 'sleep', 'poison', 'bleed'];
  // static xp = (lvl) => lvl + Math.pow(lvl * 1.8, 2) * 1.2 +  Math.exp(lvl * 0.18);

  constructor(name, attribs, baseStatuses) {
    this.name = name;
    this.baseAttribs = attribs;
    this.attribs = {};
    for (const [key, value] of Object.entries(this.baseAttribs)) {
      this.attribs[key] = new IntRef(value);
    }

    this.statuses = {};
    for (const status of Object.values(Character.statusOrder)) {
      this.statuses[status] = new IntRef(0);
    }

    this.equips = {};
  }
  copy() {
    const newCharacter = new Character(this.name, {...this.baseAttribs});
    for (const [slot, equip] of Object.entries(this.equips)) {
      newCharacter.equips[slot] = equip.copy();
    }
    return newCharacter;
  }
  applyStatus(status, value) {
    if (this.statuses[status].value > 0) {
      this.statuses[status].add(value); 
    } else {
      this.statuses[status].set(value);
      this.statuses[status].show();
    }
  }
  equip(slot, item) {
    this.equips[slot] = item;
  }
  computeValues() {
    const values = {
      'armor': 0,
      'damage': 0,
    };
    for (const [key, ref] of Object.entries(this.attribs)) {
      values[key] = ref.value;
    }
    // Apply items.
    for (const [slot, equip] of Object.entries(this.equips)) {
      for (const [key, ref] of Object.entries(equip.attribs)) {
        values[key] += ref.value;
      }
    }

    // Check statuses.
    if (this.statuses['fear'].value > 0) {
      values['fencing'] = Math.ceil(values['fencing'] * 0.5);
    }
    if (this.statuses['weak'].value > 0) {
      values['strength'] = Math.ceil(values['strength'] * 0.5);
    }
    if (this.statuses['slow'].value > 0) {
      values['speed'] = Math.ceil(values['speed'] * 0.5);
    }
    if (this.statuses['dizzy'].value > 0) {
      values['accuracy'] = Math.ceil(values['accuracy'] * 0.5);
    }

    return values;
  }
}

