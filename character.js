export class Character {
  constructor(name, attribs) {
    this.name = name;
    this.attribs = attribs;
    this.statuses = {};
    this.equips = {};
  }
  copy() {
    const newCharacter = new Character(this.name, {...this.attribs});
    newCharacter.statuses = {...this.statuses};
    for (const [slot, equip] of Object.entries(this.equips)) {
      newCharacter.equips[slot] = equip.copy();
    }
    return newCharacter;
  }
  step(enemy) {
    const values = computeValues();
    const enemyValues = enemy.computeValues();

    if (!('sleep' in this.statuses)) {
      // Special attack, etc.
      // Attack count.
      const attackCount = (0.9 + (this.attribs.speed) * 0.16) | 0;



    }

    // Apply any bleed, poison
    if ('bleed' in this.statuses) {

    }
    if ('poison' in this.statuses) {
      
    }

    for (const status of Object.keys(this.statuses)) {
      this.statuses[status] -= 1;
    }

  }
  applyStatus(status, value) {
    if (status in this.statuses) {
      this.statuses[status] += value;
    } else {
      this.statuses[status] = value;
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
    for (const [key, value] of Object.entries(this.attribs)) {
      values[key] = value;
    }
    // Apply items.
    for (const [slot, equip] of Object.entries(this.equips)) {
      for (const [key, value] of Object.entries(equip.attribs)) {
        values[key] += value;
      }
    }

    // Check statuses.
    if ('fear' in this.statuses) {
      values['fencing'] = Math.ceil(values['fencing'] * 0.5);
    }
    if ('weak' in this.statuses) {
      values['strength'] = Math.ceil(values['strength'] * 0.5);
    }
    if ('slow' in this.statuses) {
      values['speed'] = Math.ceil(values['speed'] * 0.5);
    }
    if ('dizzy' in this.statuses) {
      values['accuracy'] = Math.ceil(values['accuracy'] * 0.5);
    }

    return values;
  }
}
