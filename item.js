import { IntRef } from './ui.js';

export class Item {
  constructor(name, attribs) {
    this.name = name;
    this.baseAttribs = attribs;
    this.attribs = {};
    for (const [key, value] of Object.entries(this.baseAttribs)) {
      this.attribs[key] = new IntRef(value);
    }
  }
  copy() {
    return new Item(this.name, {...this.baseAttribs});
  }
}
