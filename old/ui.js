import { Emoji } from './emoji.js';

export class IntRef {
  constructor(value) {
    this.value = value;
    // TODO(): Support multiple spans.
    // OR: force ui to only display one logical value once :)

    // The span displaying the text value held within the `IntRef`.
    this.span = null;
    // The div that can be hidden/shown.
    this.hider = null;
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
    if (this.hider === null) {
      return;
    }
    this.hider.classList.add('hidden');
  }
  show() {
    if (this.hider === null) {
      return;
    }
    this.hider.classList.remove('hidden');
  }
  bindTo(span, hider=null) {
    this.span = span;
    this.hider = hider;
    this.update();
  }
}
