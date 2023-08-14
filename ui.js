import { Emoji } from './emoji.js';

export class IntRef {
  constructor(value) {
    this.value = value;
    // The span displaying the text value held within the `IntRef`.
    this.span = null;
    // The detail div that can be hidden/shown.
    this.detail = null;
  }
  update() {
    if (this.span === null) {
      return;
    }
    this.span.innerText = Emoji.convertInt(this.value);
  }
  set(newValue) {
    this.value = newValue;
    this.update();
  }
  add(delta) {
    this.value += delta;
    this.update();
  }
  hide() {
    if (this.detail === null) {
      return;
    }
    this.detail.classList.add('hidden');
  }
  show() {
    if (this.detail === null) {
      return;
    }
    this.detail.classList.remove('hidden');
  }
}
