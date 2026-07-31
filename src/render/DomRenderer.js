import { Renderer } from './Renderer.js';
import { EventLogView } from './EventLogView.js';
import { InventoryView } from './InventoryView.js';
import { BoardView } from './BoardView.js';
import { drawText } from './animations.js';

// The real renderer -- backs the interactive game in a browser.
//
// Phase 3 introduced the shell: constructed and threaded through as
// `game.view`, but with its methods still inheriting Renderer's "not
// implemented" stubs. Shop still manipulates the DOM directly rather than
// through this class; Phase 7 moves it. Phases 4 (event log), 5 (inventory/
// resources), and 6 (board, this commit) already have -- see
// REFACTOR_PLAN.md.
export class DomRenderer extends Renderer {
  constructor() {
    super();
    this.eventLogView = new EventLogView();
    this.inventoryView = new InventoryView((html) => this.showInfo(html));
    this.boardView = new BoardView();
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
}
