import { DomRenderer } from './DomRenderer.js';
import { ReplayDivergenceError } from '../replay-errors.js';

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

// Decorator over DomRenderer: the human watches the replay animate normally
// under the real renderer -- only the methods below are overridden, and
// only for as long as `driving` is true.
export class ReplayRenderer extends DomRenderer {
  constructor() {
    super();
    // Queue of tool cell-pick targets, primed by the driver (replay.js's
    // runReplay) right before it calls shop.attemptPurchase for a recorded
    // tool buy. Each entry is [x, y], or null for a buy that recorded no
    // target (the player cancelled during recording, or no cell could ever
    // satisfy the tool's predicate -- see symbols/tools.js).
    this.toolTargetQueue = [];
    // True while the scripted event list is being replayed. The driver owns
    // rolling and tool targets during this window, so both are faked below
    // instead of waiting on real clicks. Once runReplay() has played back
    // every recorded event and turns remain, it calls stopDriving() to hand
    // control back to the player -- otherwise the board is stuck forever
    // with no roll listener attached (nothing else ever re-enables it).
    this.driving = true;
    this.rollCallback = null;
  }
  primeToolTarget(target) {
    this.toolTargetQueue.push(target);
  }
  // Dequeues the next recorded target instead of waiting on a real click --
  // replay drives every action itself, synchronously. Once handed back to
  // the player (driving === false), this falls through to the real prompt.
  async pickCellForTool(prompt, predicate) {
    if (!this.driving) {
      return super.pickCellForTool(prompt, predicate);
    }
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
  // While driving, suppress the grid-click-to-roll listener so a stray
  // click can't inject an extra game.roll() mid-replay -- just remember the
  // callback (Game wires this up once, from its constructor) so it can be
  // attached for real once driving stops.
  addRollListener(callback) {
    this.rollCallback = callback;
    if (!this.driving) {
      super.addRollListener(callback);
    }
  }
  // Called by runReplay() once every recorded event has played and turns
  // remain, so the player can keep going instead of the board freezing.
  stopDriving() {
    if (!this.driving) {
      return;
    }
    this.driving = false;
    if (this.rollCallback) {
      super.addRollListener(this.rollCallback);
    }
  }
}
