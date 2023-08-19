import { Constants } from './constants.js';
import { IntRef } from './ui.js';

export class Character {
  static statusOrder = ['fear', 'weak', 'slow', 'dizzy', 'sleep', 'poison', 'bleed'];

  constructor(name, level, attribs) {
    this.name = name;
    this.level = new IntRef(level);
    this.skillPoints = new IntRef(3);

    this.attribs = {};
    for (const [key, value] of Object.entries(attribs)) {
      this.attribs[key] = new IntRef(value);
    }
    this.attribs.hp = new IntRef(0);
    this.updateHp();

    this.statuses = {};
    for (const status of Object.values(Character.statusOrder)) {
      this.statuses[status] = new IntRef(0);
    }

    this.equips = {};
    this.inventory = [];
  }
  combatCopy() {
    const flatAttribs = {};
    for (const [attrib, ref] of Object.entries(this.attribs)) {
      flatAttribs[attrib] = ref.value;
    }
    const newCharacter = new Character(this.name, this.level.value, flatAttribs);
    for (const [slot, equip] of Object.entries(this.equips)) {
      newCharacter.equips[slot] = equip.combatCopy();
    }
    return newCharacter;
  }
  levelUp() {
    this.level.add(1);
    this.updateHp();
    this.skillPoints.add(1);
  }
  assignPoint(attrib) {
    this.skillPoints.add(-1);
    this.attribs[attrib].add(1);
    this.updateHp();
  }
  updateHp() {
    const newHp = Math.pow(this.level.value, 2) * 0.75 - 9 
      + Math.pow(this.attribs.fencing.value, 2) * 0.25
      + Math.pow(this.attribs.strength.value, 2) * 0.45;
    this.attribs.hp.set(newHp | 0);
  }
  equip(item) {
    for (let i = 0; i < this.inventory.length; ++i) {
      if (item != this.inventory[i]) {
        continue;
      }
      if (item.slot in this.equips) {
        const oldEquip = this.equips[item.slot];
        delete this.equips[item.slot];
        this.inventory.push(oldEquip);
      }
      this.equips[item.slot] = item;
      this.inventory.splice(i, 1);
      return;
    }
    throw new Error('trying to equip item not owned');
  }
  addEquip(item) {
    this.inventory.push(item);
    this.equip(item);
  }
  unequip(slot) {
    const item = this.equips[slot];
    delete this.equips[slot];
    this.inventory.push(item);
  }
  applyStatus(status, value) {
    if (this.statuses[status].value > 0) {
      this.statuses[status].add(value); 
    } else {
      this.statuses[status].set(value);
      this.statuses[status].show();
    }
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

