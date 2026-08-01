// A Renderer-shaped fake whose every method is a no-op that records its call.
// Lets Tier-1 tests assert *intent* (e.g. "requested a flip animation")
// without a DOM. See UNIT_TEST_PLAN.md section 4.2.

export function makeSpyRenderer() {
  const calls = [];
  const push = (method, args) => calls.push({ method, args });

  const renderer = {
    calls,
    // Cell that a scripted pickCellForTool() resolves to; null = cancelled,
    // matching NullRenderer's real headless behavior. Tests override this.
    pickCellForToolResult: null,

    async spinCell(x, y, renderSpec, pickReelEmoji) {
      push('spinCell', [x, y, renderSpec]);
      // Mirrors NullRenderer: preserve the RNG draw count/order even headless.
      for (let i = 0; i < 6; ++i) {
        pickReelEmoji();
      }
    },
    async spinCellOnce(x, y, renderSpec) {
      push('spinCellOnce', [x, y, renderSpec]);
    },
    async spinIntoHole(x, y, newSpec, holeSpec) {
      push('spinIntoHole', [x, y, newSpec, holeSpec]);
    },
    async redrawCell(x, y, renderSpec) {
      push('redrawCell', [x, y, renderSpec]);
    },
    async clearCellDecorations(x, y) {
      push('clearCellDecorations', [x, y]);
    },
    async animateCell(x, y, name, duration, repeat, cssVars) {
      push('animateCell', [x, y, name, duration, repeat, cssVars]);
    },
    async animateCellOverlay(x, y, name, duration, repeat, cssVars) {
      push('animateCellOverlay', [x, y, name, duration, repeat, cssVars]);
    },
    async moneyEarned(x, y, value) {
      push('moneyEarned', [x, y, value]);
    },
    async shakeAndRemove(x, y, renderSpec) {
      push('shakeAndRemove', [x, y, renderSpec]);
    },
    async resizeBoard(oldRows, newRows, cols) {
      push('resizeBoard', [oldRows, newRows, cols]);
    },
    async clearBoard(rows, cols) {
      push('clearBoard', [rows, cols]);
    },
    async pinCell(x, y, renderSpec) {
      push('pinCell', [x, y, renderSpec]);
    },
    async awaitCellClick(_) {
      return null;
    },
    async setGridEnabled(enabled) {
      push('setGridEnabled', [enabled]);
    },
    addRollListener(_) {},
    removeRollListener() {},

    async renderInventory(_) {},
    async renderResources(_) {},
    async moneyEarnedPassive(value) {
      push('moneyEarnedPassive', [value]);
    },

    async renderShop(_, __) {},
    async markOfferBought(offerId) {
      push('markOfferBought', [offerId]);
    },
    async disableOffer(offerId) {
      push('disableOffer', [offerId]);
    },
    async showShop() {
      push('showShop', []);
    },
    async hideShop() {
      push('hideShop', []);
    },
    async closeShop() {
      push('closeShop', []);
    },

    async showInfo(_) {},
    async hideInfo() {},
    async logResourceChange(key, value, source, direction) {
      push('logResourceChange', [key, value, source, direction]);
    },
    setAnimationEnabled(_) {},

    async pickCellForTool(prompt, _) {
      push('pickCellForTool', [prompt]);
      return renderer.pickCellForToolResult;
    },
  };
  return renderer;
}
