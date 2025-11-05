import * as Const from './consts.js';
import * as Util from './util.js';

export class BoardView {
  constructor(game, board) {
    this.game = game;
    this.gridDiv = document.querySelector('.game .grid');
    this.gridDiv.replaceChildren();
    this._initCellDivs(board);
    this._initLockedCells(board.lockedCells);
  }
  _initCellDivs(board) {
    for (let y = 0; y < board.currentRows; ++y) {
      const rowDiv = Util.createDiv('', 'row');
      for (let x = 0; x < board.settings.boardX; ++x) {
        const cellContainer = this.createCellDiv(x, y);
        rowDiv.appendChild(cellContainer);
      }
      this.gridDiv.appendChild(rowDiv);
    }
    // Play button.
    this.spinIntoView(2, 2, { emoji: '▶️' });
  }
  _initLockedCells(lockedCells) {
    for (const addr of Object.keys(lockedCells)) {
      const [x, y] = addr.split(',').map(Number);
      this.spinIntoView(x, y, {emoji: lockedCells[addr].symbol.emoji()});
    }
  }

  async resetBoardSize({ oldRows, newRows, cols }) {
    // If rows are not created yet:
    if (oldRows < newRows) {
      // Showing hidden rows again
      for (let y = oldRows; y < newRows; ++y) {
        const rowDiv = this.gridDiv.childNodes[y];
        if (!rowDiv) {
          break;
        }
        rowDiv.classList.remove('hidden');
        await Util.animate(rowDiv, 'rowMoveIn', 0.25);
      }
      // Growing
      for (let y = oldRows; y < newRows; ++y) {
        const rowDiv = Util.createDiv('', 'row');
        for (let x = 0; x < cols; ++x) {
          const cellContainer = this.createCellDiv(x, y);
          rowDiv.appendChild(cellContainer);
        }
        this.gridDiv.appendChild(rowDiv);
        await Util.animate(rowDiv, 'rowMoveIn', 0.25);
      }
    } else if (oldRows > newRows) {
      // If there are too many rows, hide the extra ones.
      for (let y = oldRows - 1; y >= newRows; --y) {
        const rowDiv = this.gridDiv.childNodes[y];
        await Util.animate(rowDiv, 'rowMoveOut', 0.25);
        rowDiv.classList.add('hidden');
      }
    }
  }
  async clear({ rows, cols}) {
    for (let y = 0; y < rows; ++y) {
      if (this.gridDiv.childNodes[y].classList.contains('hidden')) {
        continue;
      }
      for (let x = 0; x < cols; ++x) {
        await Util.delay(16);
        Util.animate(this.getSymbolDiv(x, y), 'fadeOutHalf', 0.3).then(() => {
          this.getSymbolDiv(x, y).style.opacity = '0.5';
        });
      }
    }
  }

  async addSymbol({ coords, prevRenderSpec, renderSpec }) {
    const { x, y } = coords;
    if (prevRenderSpec.emoji === Const.HOLE) {
      await this.spinIntoHole(x, y, prevRenderSpec, renderSpec);
      this._redrawCellDiv(x, y, prevRenderSpec);
    } else {
      await this.spinIntoView(x, y, renderSpec);
      this._redrawCellDiv(x, y, renderSpec);
    }
  }
  async removeSymbol({ coords, renderSpec }) {
    const { x, y } = coords;
    this._clearCellDiv(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'shake', 0.125, 2);
    await this.spinIntoView(x, y, renderSpec);
  }

  createCellDiv(x, y) {
    const cellContainer = Util.createDiv('', 'cell-container');
    const cellDiv = Util.createDiv('', 'cell', `cell-${y}-${x}`);
    const symbolDiv = Util.createDiv(Const.EMPTY, 'symbol');
    const counterDiv = Util.createDiv('', 'symbol-counter');
    counterDiv.innerText = '';
    const pinDiv = Util.createDiv('', 'symbol-pin');
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
  _redrawCellDiv(x, y, renderSpec) {
    this.getCellDiv(x, y).replaceChildren(
      this.renderSymbol(x, y, renderSpec));
  }
  _clearCellDiv(x, y) {
    const counterDiv = this.getCounterDiv(x, y);
    if (counterDiv) {
      counterDiv.innerText = '';
    }
    const pinDiv = this.getPinDiv(x, y);
    if (pinDiv) {
      pinDiv.innerText = '';
    }
  }
  
  getSymbolDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x} .symbol`);
  }
  
  getCounterDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[1];
  }
  getPinDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[2];
  }

  async moneyEarnedOverlay({ _ctx, coords, value }) {
    const { x, y } = coords;
    // Create a temporary money span to show on the overlay
    const moneySpan = Util.createSpan(`💵${Util.formatBigNumber(value)}`, 'money-earned-line');
    const cellDiv = this.getCellDiv(x, y);
    if (!cellDiv) {
      console.warn('No cellDiv found for moneyEarnedOverlay at', x, y);
      return;
    }
    cellDiv.appendChild(moneySpan);
    Util.animateOverlay(
      moneySpan,
      'moneyEarnedRise',
      2,
    ).then(() => {
      if (moneySpan.parentElement !== cellDiv) {
        return;
      }
      cellDiv.removeChild(moneySpan);
    });
  }
  async pinCell({ coords, renderSpec }) {
    const { x, y } = coords;
    this._redrawCellDiv(x, y, renderSpec);
    await Util.animate(this.getSymbolDiv(x, y), 'bounce', 0.15);
  }

  async spinIntoView(x, y, renderSpec) {
    const cellDiv = this.getCellDiv(x, y);
    await Util.animate(cellDiv, 'startSpin', 0.1);
    const symbolDiv = this.renderSymbol(x, y, renderSpec);
    cellDiv.replaceChildren(symbolDiv);
    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async spinIntoHole(x, y, prevRenderSpec, renderSpec) {
    const cellDiv = this.getCellDiv(x, y);
    const fakeSymbolDiv = this.renderSymbol(x, y, renderSpec);
    await Util.animate(cellDiv, 'startSpin', 0.1);
    cellDiv.replaceChildren(fakeSymbolDiv);
    await Util.animate(fakeSymbolDiv, 'endSpin', 0.3);
    await Util.animate(fakeSymbolDiv, 'bounce', 0.1);
    const symbolDiv = this.renderSymbol(x, y, prevRenderSpec);
    cellDiv.replaceChildren(symbolDiv);
    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  renderSymbol(x, y, renderSpec) {
    const symbolDiv = Util.createDiv(renderSpec.emoji, 'symbol');
    const counterDiv = Util.createDiv(
      Util.formatBigNumber(renderSpec.counter || ''),
      'symbol-counter'
    );
    const pinDiv = Util.createDiv(
      renderSpec.pinned ? Const.PIN : '', 'symbol-pin');

    // TODO #REFACTOR, what to do with click handler?
    // The lambda is required, otherwise there is a bug with the info text.
    // This should probably be fixed in the future.
    // symbolDiv.addEventListener('click', () => this.clickHandler(game));

    symbolDiv.appendChild(counterDiv);
    symbolDiv.appendChild(pinDiv);
    return symbolDiv;
  }
  async spinCell({ coords, renderSpec }) {
    const { x, y } = coords;
    await Util.delay(Math.random() * 600 | 0);
    const cellDiv = this.getCellDiv(x, y);

    // Rolling animation portion
    await Util.animate(cellDiv, 'startSpin', 0.1);
    const fakeDiv = Util.createDiv(null, 'symbol');
    cellDiv.replaceChildren(fakeDiv);
    for (let i = 0; i < 6; ++i) {
      fakeDiv.innerText = Util.randomChoose(renderSpec.ownedEmoji);
      await Util.animate(fakeDiv, 'spin', 0.12 + i * 0.02);
    }

    // Set the actual symbol
    const symbolDiv = this.renderSymbol(x, y, renderSpec);
    cellDiv.replaceChildren(symbolDiv);

    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async animateCell({ coords, animation, duration, repeat, cssVars }) {
    await Util.animate(this.getSymbolDiv(coords.x, coords.y),
      animation,
      duration,
      repeat || 1,
      cssVars || {}
    );
  }
  async animateOverlay({ coords, animation, duration, repeat,  cssVars }) {
    await Util.animateOverlay(this.getSymbolDiv(coords.x, coords.y),
      animation,
      duration,
      repeat || 1,
      cssVars || {}
    );
  }
  async getClickCoord(expr) {
    return new Promise((resolve) => {
      const onclick = (e) => {
        e.stopPropagation();
        const classes = e.target.parentElement.classList;
        if (!classes.contains('cell')) {
          return;
        }
        const [_, y, x] = classes
          .toString()
          .split(' ')
          .find((c) => c.startsWith('cell-'))
          .split('-')
          .map(Number);
        if (!expr(this.board.cells[y][x], x, y)) {
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
  addClickListener(game) {
    if (!this.clickListener) {
      this.clickListener = () => game.roll();
    }
    this.gridDiv.addEventListener('click', this.clickListener);
  }
  removeClickListener() {
    this.gridDiv.removeEventListener('click', this.clickListener);
  }
}
