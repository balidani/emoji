import { Renderer } from './Renderer.js';

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

// No-op renderer for headless simulation and testing (see REFACTOR_PLAN.md,
// Phase 3 / Part C.1). Every method resolves immediately and touches nothing --
// no `document`, no timers. Once game logic is fully routed through the
// Renderer port (Phase 6+), this is what lets the whole game run in Node
// without a browser.
export class NullRenderer extends Renderer {
  // IMPORTANT: unlike every other method here, this is *not* a pure no-op.
  // The original spinDiv's reel loop calls its RNG-backed emoji picker 6
  // times regardless of whether animation is on (Util.animate short-circuits
  // when animation is off, but the loop calling it does not) -- that's real
  // draws from the shared seeded RNG that everything downstream depends on.
  // Dropping them here would desync the whole game from master's RNG stream.
  async spinCell(_x, _y, _renderSpec, pickReelEmoji) {
    for (let i = 0; i < 6; ++i) {
      pickReelEmoji();
    }
  }
  async spinCellOnce(_x, _y, _renderSpec) {}
  async spinIntoHole(_x, _y, _newSpec, _holeSpec) {}
  async redrawCell(_x, _y, _renderSpec) {}
  async clearCellDecorations(_x, _y) {}
  async animateCell(_x, _y, _name, _duration, _repeat, _cssVars) {}
  async animateCellOverlay(_x, _y, _name, _duration, _repeat, _cssVars) {}
  async moneyEarned(_x, _y, _value) {}
  async shakeAndRemove(_x, _y, _renderSpec) {}
  async resizeBoard(_oldRows, _newRows, _cols) {}
  async clearBoard(_rows, _cols) {}
  async pinCell(_x, _y, _renderSpec) {}
  async awaitCellClick(_predicate) {
    return null;
  }
  async setGridEnabled(_enabled) {}
  addRollListener(_callback) {}
  removeRollListener() {}

  async renderInventory(_entries) {}
  async renderResources(_entries) {}
  async moneyEarnedPassive(_value) {}

  async renderShop(_offers, _refreshOffer) {}
  async markOfferBought(_offerId) {}
  async showShop() {}
  async hideShop() {}
  async closeShop() {}

  async showInfo(_descriptionHtml) {}
  async hideInfo() {}
  async logResourceChange(_key, _value, _source, _direction) {}
  setAnimationEnabled(_enabled) {}

  async pickCellForTool(_prompt, _predicate) {
    // Matches master's own AutoGame harness: it can't script a cell click for
    // tools either, so simulated games never buy Pin/Axe/Eye (see Part F.3).
    return null;
  }
}
