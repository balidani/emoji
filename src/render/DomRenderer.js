import { Renderer } from './Renderer.js';
import { EventLogView } from './EventLogView.js';

// The real renderer -- backs the interactive game in a browser.
//
// Phase 3 introduced the shell: constructed and threaded through as
// `game.view`, but with its methods still inheriting Renderer's "not
// implemented" stubs. Board, Inventory, and Shop still manipulate the DOM
// directly rather than through this class. Each later phase (5: Inventory,
// 6: Board, 7: Shop, 8: symbols/tools) moves the matching DOM code from its
// current inline location into an override here, one subsystem at a time --
// see REFACTOR_PLAN.md. Phase 4 (this commit) is the first to do so, for the
// event log.
export class DomRenderer extends Renderer {
  constructor() {
    super();
    this.eventLogView = new EventLogView();
  }

  async logResourceChange(key, value, source, direction) {
    return this.eventLogView.logResourceChange(key, value, source, direction);
  }
}
