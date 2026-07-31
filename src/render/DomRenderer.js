import { Renderer } from './Renderer.js';

// The real renderer -- backs the interactive game in a browser.
//
// Phase 3 (this commit) only introduces the shell: it's constructed and
// threaded through as `game.view`, but nothing calls its methods yet, so they
// still inherit Renderer's "not implemented" stubs. Board, Inventory, Shop,
// and EventLog currently manipulate the DOM directly rather than through this
// class. Each later phase (4: EventLog, 5: Inventory, 6: Board, 7: Shop, 8:
// symbols/tools) moves the matching DOM code from its current inline location
// into an override here, one subsystem at a time -- see REFACTOR_PLAN.md.
export class DomRenderer extends Renderer {}
