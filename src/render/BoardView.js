import * as Const from '../consts.js';
import { formatBigNumber } from '../core/util.js';
import {
  createDiv,
  createSpan,
  animate,
  animateOverlay,
  delay,
} from './animations.js';

// The board grid DOM + all cell animations, extracted from board.js (see
// REFACTOR_PLAN.md, Phase 6). Board keeps the model (cells, locked cells, row
// count) and calls into this class by coordinate + renderSpec; it never
// builds or reads a cell's DOM node itself here (though board.js still keeps
// getSymbolDiv/getCellDiv as compatibility shims for the ~55 call sites in
// symbol files that reach for them directly -- those move in Phase 8).
export class BoardView {
  constructor() {
    this.gridDiv = document.querySelector('.game .grid');
  }

  createCellDiv(x, y) {
    const cellContainer = createDiv('', 'cell-container');
    const cellDiv = createDiv('', 'cell', `cell-${y}-${x}`);
    const symbolDiv = createDiv(Const.EMPTY, 'symbol');
    const counterDiv = createDiv('', 'symbol-counter');
    counterDiv.innerText = '';
    const pinDiv = createDiv('', 'symbol-pin');
    pinDiv.innerText = '';
    cellDiv.appendChild(symbolDiv);
    cellDiv.appendChild(counterDiv);
    cellDiv.appendChild(pinDiv);
    cellContainer.appendChild(cellDiv);
    return cellContainer;
  }

  getCellDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x}`);
  }
  getSymbolDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x} .symbol`);
  }

  buildSymbolDiv(spec) {
    const symbolDiv = createDiv(spec.emoji, 'symbol');
    const counterDiv = createDiv(
      formatBigNumber(spec.counter || ''),
      'symbol-counter'
    );
    const pinDiv = createDiv(spec.pinned ? Const.PIN : '', 'symbol-pin');
    symbolDiv.appendChild(counterDiv);
    symbolDiv.appendChild(pinDiv);
    return symbolDiv;
  }

  async clearBoard(rows, cols) {
    this.gridDiv.replaceChildren();
    for (let y = 0; y < rows; ++y) {
      const rowDiv = createDiv('', 'row');
      for (let x = 0; x < cols; ++x) {
        rowDiv.appendChild(this.createCellDiv(x, y));
      }
      this.gridDiv.appendChild(rowDiv);
    }
  }

  async resizeBoard(oldRows, newRows, cols) {
    if (oldRows < newRows) {
      // Showing hidden rows again
      for (let y = oldRows; y < newRows; ++y) {
        if (y >= this.gridDiv.children.length) {
          break;
        }
        const rowDiv = this.gridDiv.childNodes[y];
        rowDiv.classList.remove('hidden');
        await animate(rowDiv, 'rowMoveIn', 0.25);
      }
      // Growing
      for (let y = this.gridDiv.children.length; y < newRows; ++y) {
        const rowDiv = createDiv('', 'row');
        for (let x = 0; x < cols; ++x) {
          rowDiv.appendChild(this.createCellDiv(x, y));
        }
        this.gridDiv.appendChild(rowDiv);
        await animate(rowDiv, 'rowMoveIn', 0.25);
      }
    } else if (oldRows > newRows) {
      // If there are too many rows, hide the extra ones.
      for (let y = oldRows - 1; y >= newRows; --y) {
        const rowDiv = this.gridDiv.childNodes[y];
        await animate(rowDiv, 'rowMoveOut', 0.25);
        rowDiv.classList.add('hidden');
      }
    }
  }

  async redrawCell(x, y, spec) {
    this.getCellDiv(x, y).replaceChildren(this.buildSymbolDiv(spec));
  }

  async clearCellDecorations(x, y) {
    const counterDiv = this.gridDiv.children[y].children[x].children[1];
    if (counterDiv) {
      counterDiv.innerText = '';
    }
    const pinDiv = this.gridDiv.children[y].children[x].children[2];
    if (pinDiv) {
      pinDiv.innerText = '';
    }
  }

  async animateCell(x, y, name, duration, repeat = 1, cssVars = {}) {
    return animate(this.getSymbolDiv(x, y), name, duration, repeat, cssVars);
  }

  async animateCellOverlay(x, y, name, duration, repeat = 1, cssVars = {}) {
    return animateOverlay(
      this.getSymbolDiv(x, y),
      name,
      duration,
      repeat,
      cssVars
    );
  }

  async moneyEarned(x, y, value) {
    const cellDiv = this.getCellDiv(x, y);
    if (!cellDiv) {
      // TODO: show money earned on passive row.
      return;
    }
    const moneySpan = createSpan(
      `💵${formatBigNumber(value)}`,
      'money-earned-line'
    );
    cellDiv.appendChild(moneySpan);
    animateOverlay(moneySpan, 'moneyEarnedRise', 2).then(() => {
      if (moneySpan.parentElement !== cellDiv) {
        return;
      }
      cellDiv.removeChild(moneySpan);
    });
  }

  async spinCell(x, y, spec, pickReelEmoji) {
    await delay((Math.random() * 600) | 0);
    const cellDiv = this.getCellDiv(x, y);

    // Rolling animation portion
    await animate(cellDiv, 'startSpin', 0.1);
    const fakeDiv = createDiv(null, 'symbol');
    cellDiv.replaceChildren(fakeDiv);
    for (let i = 0; i < 6; ++i) {
      fakeDiv.innerText = pickReelEmoji();
      await animate(fakeDiv, 'spin', 0.12 + i * 0.02);
    }

    // Set the actual symbol
    const symbolDiv = this.buildSymbolDiv(spec);
    cellDiv.replaceChildren(symbolDiv);

    await animate(symbolDiv, 'endSpin', 0.3);
    await animate(symbolDiv, 'bounce', 0.1);
  }

  async spinCellOnce(x, y, spec) {
    const cellDiv = this.getCellDiv(x, y);
    await animate(cellDiv, 'startSpin', 0.1);
    const symbolDiv = this.buildSymbolDiv(spec);
    cellDiv.replaceChildren(symbolDiv);
    await animate(symbolDiv, 'endSpin', 0.3);
    await animate(symbolDiv, 'bounce', 0.1);
  }

  async spinIntoHole(x, y, newSpec, holeSpec) {
    await this.spinCellOnce(x, y, newSpec);
    await this.spinCellOnce(x, y, holeSpec);
  }

  async shakeAndRemove(x, y, spec) {
    await animate(this.getSymbolDiv(x, y), 'shake', 0.125, 2);
    await this.spinCellOnce(x, y, spec);
  }

  async pinCell(x, y, spec) {
    await this.redrawCell(x, y, spec);
    await animate(this.getSymbolDiv(x, y), 'bounce', 0.15);
  }

  async awaitCellClick(predicate) {
    return new Promise((resolve) => {
      const onclick = (e) => {
        e.stopPropagation();
        const classes = e.target.parentElement.classList;
        if (!classes.contains('cell')) {
          return;
        }
        const [, y, x] = classes
          .toString()
          .split(' ')
          .find((c) => c.startsWith('cell-'))
          .split('-')
          .map(Number);
        // NOTE: predicate is documented (Renderer.js) to receive a
        // renderSpec, but nothing builds one here yet -- the only caller
        // (tools.js's onToolBuy, via DomRenderer.pickCellForTool) ignores
        // this argument and checks live model state itself
        // (game.board.getSymbol(x, y)) instead.
        if (!predicate(null, x, y)) {
          return;
        }
        document
          .querySelectorAll('.cell')
          .forEach((div) => div.removeEventListener('click', onclick));
        resolve([x, y]);
      };
      document.querySelectorAll('.cell').forEach((div) => {
        div.addEventListener('click', onclick);
      });
    });
  }

  async setGridEnabled(enabled) {
    this.gridDiv.disabled = !enabled;
  }

  addRollListener(callback) {
    if (!this.rollListener) {
      this.rollListener = callback;
    }
    this.gridDiv.addEventListener('click', this.rollListener);
  }

  removeRollListener() {
    this.gridDiv.removeEventListener('click', this.rollListener);
  }
}
