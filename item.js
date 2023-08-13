export class Item {
  constructor(name, attribs) {
    this.name = name;
    this.attribs = attribs;
  }
  copy() {
    return new Item(this.name, {...this.attribs});
  }
}
