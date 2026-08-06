import { NullRenderer } from './NullRenderer.js';

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

// Headless renderer for the simulator, extending NullRenderer with the same
// tool-target queue ReplayRenderer uses to script a "cell click" without a
// browser. The harness (src/sim/harness.js) owns all targeting policy --
// this class only dequeues whatever it was given.
export class SimRenderer extends NullRenderer {
  constructor() {
    super();
    // Each entry is [x, y] (a chosen board cell) or null (buy with no
    // target -- resolves as a no-op, same as a cancelled real purchase).
    this.toolTargetQueue = [];
  }
  // Called by the harness right before it triggers a tool buy.
  primeToolTarget(target) {
    this.toolTargetQueue.push(target);
  }
  async pickCellForTool(_prompt, predicate) {
    if (this.toolTargetQueue.length === 0) {
      // Identical to NullRenderer -- keeps every trace fixture (which primes
      // nothing) byte-identical.
      return null;
    }
    const target = this.toolTargetQueue.shift();
    if (target === null) {
      return null;
    }
    const [x, y] = target;
    return predicate(null, x, y) ? [x, y] : null;
  }
}
