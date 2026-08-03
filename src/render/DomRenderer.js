import { Renderer } from './Renderer.js';
import { EventLogView } from './EventLogView.js';
import { InventoryView } from './InventoryView.js';
import { BoardView } from './BoardView.js';
import { ShopView } from './ShopView.js';
import { AchievementsView } from './AchievementsView.js';
import { SaveStateView } from './SaveStateView.js';
import { ReplayView } from './ReplayView.js';
import { drawText, createButton } from './animations.js';

// The real renderer -- backs the interactive game in a browser. Every
// Renderer method has a concrete override here: event log, inventory/
// resources, board, shop, and symbol hooks (Symb.addResource/addMoney,
// pickCellForTool).
export class DomRenderer extends Renderer {
  constructor() {
    super();
    this.eventLogView = new EventLogView();
    this.inventoryView = new InventoryView((html) => this.showInfo(html));
    this.boardView = new BoardView();
    this.shopView = new ShopView((html) => this.showInfo(html));
    this.achievementsView = new AchievementsView();
    this.saveStateView = new SaveStateView();
    this.replayView = new ReplayView();
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

  async clearBoard(rows, cols) {
    return this.boardView.clearBoard(rows, cols);
  }
  async resizeBoard(oldRows, newRows, cols) {
    return this.boardView.resizeBoard(oldRows, newRows, cols);
  }
  async redrawCell(x, y, spec) {
    return this.boardView.redrawCell(x, y, spec);
  }
  async clearCellDecorations(x, y) {
    return this.boardView.clearCellDecorations(x, y);
  }
  async animateCell(x, y, name, duration, repeat, cssVars) {
    return this.boardView.animateCell(x, y, name, duration, repeat, cssVars);
  }
  async animateCellOverlay(x, y, name, duration, repeat, cssVars) {
    return this.boardView.animateCellOverlay(
      x,
      y,
      name,
      duration,
      repeat,
      cssVars
    );
  }
  async moneyEarned(x, y, value) {
    return this.boardView.moneyEarned(x, y, value);
  }
  async spinCell(x, y, spec, pickReelEmoji) {
    return this.boardView.spinCell(x, y, spec, pickReelEmoji);
  }
  async spinCellOnce(x, y, spec) {
    return this.boardView.spinCellOnce(x, y, spec);
  }
  async spinIntoHole(x, y, newSpec, holeSpec) {
    return this.boardView.spinIntoHole(x, y, newSpec, holeSpec);
  }
  async shakeAndRemove(x, y, spec) {
    return this.boardView.shakeAndRemove(x, y, spec);
  }
  async pinCell(x, y, spec) {
    return this.boardView.pinCell(x, y, spec);
  }
  async awaitCellClick(predicate) {
    return this.boardView.awaitCellClick(predicate);
  }
  async setGridEnabled(enabled) {
    return this.boardView.setGridEnabled(enabled);
  }
  addRollListener(callback) {
    return this.boardView.addRollListener(callback);
  }
  removeRollListener() {
    return this.boardView.removeRollListener();
  }

  async renderShop(offers, refreshOffer) {
    return this.shopView.renderShop(offers, refreshOffer);
  }
  async markOfferBought(offerId) {
    return this.shopView.markOfferBought(offerId);
  }
  async disableOffer(offerId) {
    return this.shopView.disableOffer(offerId);
  }
  async showShop() {
    return this.shopView.showShop();
  }
  async hideShop() {
    return this.shopView.hideShop();
  }
  async closeShop() {
    return this.shopView.closeShop();
  }

  // Interactive tools (Pin/Axe/Eye). Shop visibility around a tool purchase
  // stays the caller's job (tools.js), not this method's -- Shop.show() has
  // a buyCount>0 guard this renderer has no business re-implementing.
  async pickCellForTool(prompt, predicate) {
    this.boardView.removeRollListener();
    const infoDiv = document.querySelector('.game .info');
    // Not awaited: matches the original's fire-and-forget prompt, which
    // doesn't block the click-through setup below on the typing animation.
    drawText(infoDiv, prompt, false);
    infoDiv.style.pointerEvents = 'none';

    // A cancel escape hatch: predicate may be unsatisfiable by any cell on
    // the current board (e.g. an all-empty roll), which would otherwise
    // strand the player mid-pick with the roll listener suspended and no
    // way to continue.
    const controller = new AbortController();
    const cancelButton = createButton('cancel', () => controller.abort());
    cancelButton.classList.add('tool-cancel-button');
    infoDiv.parentElement.appendChild(cancelButton);

    const coord = await this.boardView.awaitCellClick(
      predicate,
      controller.signal
    );

    cancelButton.remove();
    infoDiv.style.pointerEvents = 'auto';
    infoDiv.classList.add('hidden');
    // Restore the roll listener regardless of outcome -- a cancelled pick
    // must not leave the board unclickable (see the comment above).
    this.boardView.addRollListener(() => {});
    return coord;
  }

  async renderAchievements(model) {
    return this.achievementsView.renderAchievements(model);
  }
  async renderSaveState(props) {
    return this.saveStateView.renderSaveState(props);
  }
  async renderReplay(props) {
    return this.replayView.renderReplay(props);
  }
  notifyAchievement(def) {
    return this.achievementsView.notifyAchievement(def);
  }
}
