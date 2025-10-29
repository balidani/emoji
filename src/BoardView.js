import * as Const from './consts.js';
import * as Util from './util.js';

export class BoardView {
  constructor(game, board) {
    this.game = game;
    this.board = board;
    this.gridDiv = document.querySelector('.game .grid');
    this.gridDiv.replaceChildren();
    this.initCellDivs();
    this.initLockedCells();
  }
  initCellDivs() {
    for (let y = 0; y < this.board.currentRows; ++y) {
      const rowDiv = Util.createDiv('', 'row');
      for (let x = 0; x < this.board.settings.boardX; ++x) {
        const cellContainer = this.createCellDiv(x, y);
        rowDiv.appendChild(cellContainer);
      }
      this.gridDiv.appendChild(rowDiv);
    }
    // Play button.
    this.spinIntoView(this.game, 2, 2);
  }
  initLockedCells() {
    for (const addr of Object.keys(this.board.lockedCells)) {
      const [x, y] = addr.split(',').map(Number);
      this.spinIntoView(this.game, x, y);
    }
  }
  async handleViewEvent(effect) {
    const [_component, action] = effect.type.split('.');
    switch (action) {
      case 'spin':
        await this.spinCellDiv(this.game, effect.coords.x, effect.coords.y, effect.symbol);
        break;
      case 'animate':
        await Util.animate(
          this.getSymbolDiv(effect.coords.x, effect.coords.y),
          effect.animation,
          effect.duration,
          effect.repeat || 1,
          effect.cssVars || {}
        );
        break;
      case 'animateOverlay':
        await Util.animateOverlay(
          this.getSymbolDiv(effect.coords.x, effect.coords.y),
          effect.animation,
          effect.duration,
          effect.repeat || 1,
          effect.cssVars || {}
        );
        break;
      case 'addSymbol':
        await this.addSymbol(this.game, effect.coords.x, effect.coords.y, effect.symbol);
        break;
      case 'removeSymbol':
        await this.removeSymbol(this.game, effect.coords.x, effect.coords.y);
        break;
      case 'showMoneyEarnedOverlay':
        await this.showMoneyEarnedOverlay(
          effect.coords.x,
          effect.coords.y,
          effect.value
        );
        break;
    }
  }

  async resetBoardSize(rows) {
    // If rows are not created yet:
    if (this.board.currentRows < rows) {
      // Showing hidden rows again
      for (let y = this.board.currentRows; y < rows; ++y) {
        const rowDiv = this.gridDiv.childNodes[y];
        if (!rowDiv) {
          break;
        }
        rowDiv.classList.remove('hidden');
        await Util.animate(rowDiv, 'rowMoveIn', 0.25);
      }
      // Growing
      for (let y = this.board.currentRows; y < rows; ++y) {
        const rowDiv = Util.createDiv('', 'row');
        for (let x = 0; x < this.board.settings.boardX; ++x) {
          const cellContainer = this.createCellDiv(x, y);
          rowDiv.appendChild(cellContainer);
        }
        this.gridDiv.appendChild(rowDiv);
        await Util.animate(rowDiv, 'rowMoveIn', 0.25);
      }
    } else if (this.board.currentRows > rows) {
      // If there are too many rows, hide the extra ones.
      for (let y = this.board.currentRows - 1; y >= rows; --y) {
        const rowDiv = this.gridDiv.childNodes[y];
        await Util.animate(rowDiv, 'rowMoveOut', 0.25);
        rowDiv.classList.add('hidden');
      }
    }
  }
  async clear() {
    for (let x = 0; x < this.board.settings.boardX; ++x) {
      for (let y = 0; y < this.board.cells.length; ++y) {
        if (this.gridDiv.childNodes[y].classList.contains('hidden')) {
          continue;
        }
        await Util.delay(16);
        Util.animate(this.getSymbolDiv(x, y), 'fadeOutHalf', 0.3).then(() => {
          this.getSymbolDiv(x, y).style.opacity = '0.5';
        });
      }
    }
  }

  async addSymbol(game, x, y, sym) {
    if (this.board.cells[y][x].emoji() === Const.HOLE) {
      await this.spinIntoHole(game, x, y, sym);
    } else {
      await this.spinIntoView(game, x, y);
    }
    // Render counter if needed.
    this.redrawCellDiv(game, x, y);
  }
  async removeSymbol(game, x, y) {
    this.clearCellDiv(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'shake', 0.125, 2);
    await this.spinIntoView(game, x, y);
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
  redrawCellDiv(game, x, y) {
    if (x === -1) {
      return;
    }
    // TODO #REFACTOR
    this.getCellDiv(x, y).replaceChildren(this.board.cells[y][x].render(game, x, y));
  }
  clearCellDiv(x, y) {
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
    if (x === -1) {
      // Passive symbol, look for the div among inventoryEntry.
      const emoji = this.board.passiveCells[y].emoji();
      const entries = document.getElementsByClassName('inventoryEntry');
      for (const entry of entries) {
        if (entry.innerText.includes(emoji)) {
          return entry;
        }
      }
      return null;
    }
    return document.querySelector(`.cell-${y}-${x} .symbol`);
  }
  
  getCounterDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[1];
  }
  getPinDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[2];
  }

  async roll(lockedAtStart) {
    const tasks = [];
    for (let y = 0; y < this.board.currentRows; ++y) {
      for (let x = 0; x < this.board.settings.boardX; ++x) {
        if (lockedAtStart[`${x},${y}`]) {
          continue;
        }
        tasks.push(this.spinCellDiv(game, x, y, this.board.cells[y][x]));
      }
    }
    await Promise.all(tasks);
  }
  async showMoneyEarnedOverlay(x, y, value) {
    // Create a temporary money span to show on the overlay
    const moneySpan = Util.createSpan(`💵${Util.formatBigNumber(value)}`, 'money-earned-line');
    const cellDiv = this.getCellDiv(x, y);
    if (!cellDiv) {
      console.warn('No cellDiv found for showMoneyEarnedOverlay at', x, y);
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
  async pinCell(game, x, y) {
    this.redrawCellDiv(game, x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'bounce', 0.15);
  }
  async spinIntoView(game, x, y) {
    const cellDiv = this.getCellDiv(x, y);
    await Util.animate(cellDiv, 'startSpin', 0.1);
    // TODO #REFACTOR
    const symbolDiv = this.board.cells[y][x].render(game, x, y);
    cellDiv.replaceChildren(symbolDiv);
    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async spinIntoHole(game, x, y, sym) {
    const cellDiv = this.getCellDiv(x, y);
    const fakeSymbolDiv = sym.render(game, x, y);
    await Util.animate(cellDiv, 'startSpin', 0.1);
    cellDiv.replaceChildren(fakeSymbolDiv);
    await Util.animate(fakeSymbolDiv, 'endSpin', 0.3);
    await Util.animate(fakeSymbolDiv, 'bounce', 0.1);
    const symbolDiv = this.board.cells[y][x].render(game, x, y);
    cellDiv.replaceChildren(symbolDiv);
    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async spinCellDiv(game, x, y, symbol) {
    await Util.delay(Math.random() * 600 | 0);
    const cellDiv = this.getCellDiv(x, y);

    // Rolling animation portion
    await Util.animate(cellDiv, 'startSpin', 0.1);
    const fakeDiv = Util.createDiv(null, 'symbol');
    cellDiv.replaceChildren(fakeDiv);
    for (let i = 0; i < 6; ++i) {
      fakeDiv.innerText = game.inventory.getRandomOwnedEmoji();
      await Util.animate(fakeDiv, 'spin', 0.12 + i * 0.02);
    }

    // Set the actual symbol
    const symbolDiv = symbol.render(game, x, y);
    cellDiv.replaceChildren(symbolDiv);

    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
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
