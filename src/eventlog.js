import * as Const from './consts.js';

// Thin wrapper over the renderer port. The actual ticker DOM lives in
// render/EventLogView.js, driven through DomRenderer.logResourceChange;
// NullRenderer no-ops it for headless runs.
export class EventLog {
  constructor(renderer) {
    this.renderer = renderer;
  }
  async logResourceChange(
    key,
    value,
    source = Const.UNKNOWN,
    direction = 'earned'
  ) {
    return this.renderer.logResourceChange(key, value, source, direction);
  }
}
