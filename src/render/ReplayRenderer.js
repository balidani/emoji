import { DomRenderer } from './DomRenderer.js';
import { ReplayDivergenceError } from '../replay-errors.js';

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

// Decorator over DomRenderer (see REPLAY_PLAN.md section 7.1): the human
// watches the replay animate normally under the real renderer -- only the
// two methods below are overridden.
export class ReplayRenderer extends DomRenderer {
  constructor() {
    super();
    // Queue of tool cell-pick targets, primed by the driver (replay.js's
    // runReplay) right before it calls shop.attemptPurchase for a recorded
    // tool buy. Each entry is [x, y], or null for a buy that recorded no
    // target (the player cancelled during recording, or no cell could ever
    // satisfy the tool's predicate -- see symbols/tools.js).
    this.toolTargetQueue = [];
  }
  primeToolTarget(target) {
    this.toolTargetQueue.push(target);
  }
  // Dequeues the next recorded target instead of waiting on a real click --
  // replay drives every action itself, synchronously.
  async pickCellForTool(_prompt, predicate) {
    if (this.toolTargetQueue.length === 0) {
      throw new ReplayDivergenceError(
        'A tool purchase prompted for a cell pick with no recorded target.'
      );
    }
    const target = this.toolTargetQueue.shift();
    if (target === null) {
      return null;
    }
    const [x, y] = target;
    if (!predicate(null, x, y)) {
      throw new ReplayDivergenceError(
        `Recorded tool target (${x}, ${y}) is no longer a valid pick.`
      );
    }
    return [x, y];
  }
  // The driver owns rolling -- suppress the grid-click-to-roll listener so
  // a stray click can't inject an extra game.roll() mid-replay.
  addRollListener(_callback) {}
}
