import { Renderer } from './Renderer.js';
import { EventLogView } from './EventLogView.js';
import { InventoryView } from './InventoryView.js';
import { drawText } from './animations.js';

// The real renderer -- backs the interactive game in a browser.
//
// Phase 3 introduced the shell: constructed and threaded through as
// `game.view`, but with its methods still inheriting Renderer's "not
// implemented" stubs. Board and Shop still manipulate the DOM directly rather
// than through this class. Each later phase (6: Board, 7: Shop, 8:
// symbols/tools) moves the matching DOM code from its current inline location
// into an override here, one subsystem at a time -- see REFACTOR_PLAN.md.
// Phases 4 (event log) and 5 (inventory/resources, this commit) already have.
export class DomRenderer extends Renderer {
  constructor() {
    super();
    this.eventLogView = new EventLogView();
    this.inventoryView = new InventoryView((html) => this.showInfo(html));
  }

  async logResourceChange(key, value, source, direction) {
    return this.eventLogView.logResourceChange(key, value, source, direction);
  }

  async renderInventory(entries) {
    return this.inventoryView.renderInventory(entries);
  }
  async renderResources(entries) {
    return this.inventoryView.renderResources(entries);
  }

  async showInfo(descriptionHtml) {
    return drawText(
      document.querySelector('.game .info'),
      descriptionHtml,
      true
    );
  }
}
