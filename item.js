import { IntRef } from './ui.js';

export class Item {
  constructor(slot, name, attribs) {
    this.slot = slot;
    this.name = name;
    this.attribs = {};
    for (const [key, value] of Object.entries(attribs)) {
      this.attribs[key] = new IntRef(value);
    }
  }
  combatCopy() {
    const flatAttribs = {};
    for (const [key, ref] of Object.entries(this.attribs)) {
      flatAttribs[key] = ref.value;
    }
    return new Item(this.slot, this.name, flatAttribs);
  }
}
