// The Renderer port (see REFACTOR_PLAN.md, Part C.2 and Phase 3).
//
// This is the seam between game logic and presentation: every UI operation the
// logic layer needs is expressed here as an abstract method, grouped by
// subsystem. `DomRenderer` implements it for real; `NullRenderer` implements it
// as no-ops for headless simulation/testing. Logic code should only ever depend
// on this interface (never on `document`, `Util.animate`, or a concrete DOM
// node) -- that's what makes it possible to run the game without a browser.
//
// This class itself is never instantiated directly: every method throws,
// documenting the contract a concrete renderer must fulfill. Every method that
// today's imperative code `await`s stays `await`able here (returns a Promise).
//
// A `renderSpec` (referenced in several signatures below) is the plain-data
// description of a symbol's on-screen appearance, e.g.
// `{ emoji, counter, pinned, ownedEmoji }` (see Part C.3) -- never a DOM node.
//
// NOTE: as of Phase 3 this interface is defined and threaded through as
// `game.view` / `NullRenderer` in `AutoGame`, but nothing calls it yet; Board,
// Inventory, Shop, EventLog, and the symbols still manipulate the DOM directly.
// Later phases move that code behind the matching method here one subsystem at
// a time.

/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_.*$", "varsIgnorePattern": "^_.*$" }] */

const notImplemented = (method) => {
  throw new Error(`Renderer.${method} is not implemented`);
};

export class Renderer {
  // --- Board rendering ---

  /** Full roll spin-in animation for a cell. `pickReelEmoji` is a zero-arg
   * callback invoked repeatedly to get the next emoji shown mid-spin (backed
   * by the model's owned-symbol RNG draw -- called here, not precomputed, so
   * the draw stays exactly where it was in the original code). */
  async spinCell(_x, _y, _renderSpec, _pickReelEmoji) {
    notImplemented('spinCell');
  }
  /** Instant (no rolling animation) spin-in for a cell. */
  async spinCellOnce(_x, _y, _renderSpec) {
    notImplemented('spinCellOnce');
  }
  /** The 🕳️ two-stage animation: spin `newSpec` in, then restore `holeSpec`. */
  async spinIntoHole(_x, _y, _newSpec, _holeSpec) {
    notImplemented('spinIntoHole');
  }
  /** Re-render a cell's contents from its current renderSpec, no animation. */
  async redrawCell(_x, _y, _renderSpec) {
    notImplemented('redrawCell');
  }
  /** Reset a cell's counter/pin decorations without touching its symbol. */
  async clearCellDecorations(_x, _y) {
    notImplemented('clearCellDecorations');
  }
  /** Play a named CSS animation on a cell's symbol element. */
  async animateCell(_x, _y, _name, _duration, _repeat, _cssVars) {
    notImplemented('animateCell');
  }
  /** Play a named CSS animation on a floating overlay clone of a cell. */
  async animateCellOverlay(_x, _y, _name, _duration, _repeat, _cssVars) {
    notImplemented('animateCellOverlay');
  }
  /** The floating "+value" money pop-up over a cell. */
  async moneyEarned(_x, _y, _value) {
    notImplemented('moneyEarned');
  }
  /** Shake-then-respin a cell back to empty. */
  async shakeAndRemove(_x, _y, _renderSpec) {
    notImplemented('shakeAndRemove');
  }
  /** Grow/shrink the visible board between row counts. */
  async resizeBoard(_oldRows, _newRows, _cols) {
    notImplemented('resizeBoard');
  }
  /** Reset every cell to empty (used when starting a new game). */
  async clearBoard(_rows, _cols) {
    notImplemented('clearBoard');
  }
  /** Mark a cell as pinned (shows the pin decoration). */
  async pinCell(_x, _y, _renderSpec) {
    notImplemented('pinCell');
  }
  /** Resolves with the [x, y] of the next cell click matching `predicate`, or
   * null if cancelled. `predicate` is called with (renderSpec, x, y). */
  async awaitCellClick(_predicate) {
    notImplemented('awaitCellClick');
  }
  /** Enable/disable click interaction with the board. */
  async setGridEnabled(_enabled) {
    notImplemented('setGridEnabled');
  }
  /** Register the callback that fires when the player clicks the board to roll. */
  addRollListener(_callback) {
    notImplemented('addRollListener');
  }
  removeRollListener() {
    notImplemented('removeRollListener');
  }

  // --- Inventory / resources ---

  /** `entries` is plain data: [{emoji, count, descriptionLong}]. */
  async renderInventory(_entries) {
    notImplemented('renderInventory');
  }
  /** `entries` is plain data: [{emoji, value, descriptionLong}]. */
  async renderResources(_entries) {
    notImplemented('renderResources');
  }
  /** Money earned by a passive symbol (no board cell to float the pop-up over). */
  async moneyEarnedPassive(_value) {
    notImplemented('moneyEarnedPassive');
  }

  // --- Shop ---

  /** `offers` is [{id, emoji, description, descriptionLong, cost, canBuy,
   * buttonText, onBuy}]; `refreshOffer` is the same shape minus id/emoji/
   * description (or null if refresh isn't offered this round). Each `onBuy`
   * is a zero-arg callback Shop already bound to that specific offer -- the
   * renderer never needs to report a click back by id. */
  async renderShop(_offers, _refreshOffer) {
    notImplemented('renderShop');
  }
  /** Animate an offer out after a successful purchase. */
  async markOfferBought(_offerId) {
    notImplemented('markOfferBought');
  }
  /** Disable an offer's buy button (insufficient funds at click time). */
  async disableOffer(_offerId) {
    notImplemented('disableOffer');
  }
  async showShop() {
    notImplemented('showShop');
  }
  async hideShop() {
    notImplemented('hideShop');
  }
  async closeShop() {
    notImplemented('closeShop');
  }

  // --- Info / event log / global ---

  async showInfo(_descriptionHtml) {
    notImplemented('showInfo');
  }
  async hideInfo() {
    notImplemented('hideInfo');
  }
  /** `direction` is 'earned' or 'lost'. */
  async logResourceChange(_key, _value, _source, _direction) {
    notImplemented('logResourceChange');
  }
  setAnimationEnabled(_enabled) {
    notImplemented('setAnimationEnabled');
  }

  // --- Interactive tools (Pin/Axe/Eye; see Part C.8) ---

  /** Prompts the player with `prompt`, suspends board-click-to-roll, waits
   * for a matching cell click, then restores it. Resolves with [x, y] or
   * null if cancelled. `predicate` is called with (renderSpec, x, y). Does
   * NOT touch shop visibility -- that's the caller's job (Shop.show() has
   * model state, buyCount, this port has no business re-implementing). */
  async pickCellForTool(_prompt, _predicate) {
    notImplemented('pickCellForTool');
  }
}
