import { CATEGORY_EMPTY_SPACE } from './symbol.js';
import * as Util from './util.js';

export class Board {
  constructor(gameSettings, catalog) {
    this.gameSettings = gameSettings;
    this.catalog = catalog;
    this.cells = [];
    this.gridDiv = document.querySelector('.game .grid');
    this.gridDiv.replaceChildren();
    this.empty = this.catalog.symbol('⬜');
    for (let i = 0; i < this.gameSettings.boardY; ++i) {
      const row = [];
      const rowDiv = document.createElement('div');
      rowDiv.classList.add('row');
      for (let j = 0; j < this.gameSettings.boardX; ++j) {
        row.push(this.empty.copy());
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        cellDiv.classList.add(`cell-${j}-${i}`);
        const symbolDiv = document.createElement('div');
        symbolDiv.classList.add('symbol');
        symbolDiv.innerText = '⬜';
        const counterDiv = document.createElement('div');
        counterDiv.classList.add('symbol-counter');
        counterDiv.innerText = '';
        cellDiv.appendChild(symbolDiv);
        cellDiv.appendChild(counterDiv);
        rowDiv.appendChild(cellDiv);
      }
      this.cells.push(row);
      this.gridDiv.appendChild(rowDiv);
    }
  }
  getSymbolDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x} .symbol`);
  }
  getCellDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x}`);
  }
  redrawCell(game, x, y) {
    this.getCellDiv(x, y).replaceChildren(this.cells[y][x].render(game));
  }
  getCounterDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[1];
  }
  async showMoneyEarned(x, y, value) {
    const moneyDiv = document.createElement('div');
    moneyDiv.classList.add('moneyEarned');
    moneyDiv.innerText = `💵${value}`;
    this.gridDiv.appendChild(moneyDiv);

    await Util.animate(moneyDiv, 'fadeOutMoveDown', 0.3);
    this.gridDiv.removeChild(moneyDiv);
  }
  clearCell(x, y) {
    const counterDiv = this.getCounterDiv(x, y);
    if (counterDiv) {
      this.getCounterDiv(x, y).innerText = '';
    }
    this.cells[y][x] = this.empty.copy();
  }
  async spinDiv(game, x, y, symbol) {
    await Util.delay(Util.random(600));
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
    const symbolDiv = symbol.render(game);
    cellDiv.replaceChildren(symbolDiv);

    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async spinDivOnce(game, x, y) {
    const cellDiv = this.getCellDiv(x, y);
    await Util.animate(cellDiv, 'startSpin', 0.1);
    const symbolDiv = this.cells[y][x].render(game);
    cellDiv.replaceChildren(symbolDiv);
    await Util.animate(symbolDiv, 'endSpin', 0.3);
    await Util.animate(symbolDiv, 'bounce', 0.1);
  }
  async roll(game) {
    const symbols = [...game.inventory.symbols];
    const empties = [];
    for (let i = 0; i < game.gameSettings.boardY; ++i) {
      for (let j = 0; j < game.gameSettings.boardX; ++j) {
        empties.push([j, i]);
        this.cells[i][j] = this.empty.copy();
      }
    }
    for (
      let i = 0;
      i < game.gameSettings.boardY * game.gameSettings.boardX;
      ++i
    ) {
      if (symbols.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(symbols);
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }
    const tasks = [];
    for (let i = 0; i < game.gameSettings.boardY; ++i) {
      for (let j = 0; j < game.gameSettings.boardX; ++j) {
        tasks.push(this.spinDiv(game, j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  async evaluate(game) {
    this.forAllCells((cell, _, __) => {
      cell.turns++;
    });
    this.forAllCells((cell, x, y) => {
      this.redrawCell(game, x, y);
    });
    const evaluateRound = async (f) => {
      const tasks = [];
      this.forAllCells((cell, x, y) =>
        tasks.push(async () => {
          // If the symbol has since been removed from the board, do not evaluate.
          if (this.cells[y][x] !== cell) {
            return;
          }
          await f(cell, game, x, y);
        })
      );
      for (const task of tasks) {
        await task();
      }
      this.forAllCells((cell, x, y) => {
        this.redrawCell(game, x, y);
      });
    };
    await evaluateRound((c, g, x, y) => c.evaluateConsume(g, x, y));
    await evaluateRound((c, g, x, y) => c.evaluateProduce(g, x, y));
    await evaluateRound((c, g, x, y) => c.evaluateConsume(g, x, y));
  }
  async finalScore(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        await cell.finalScore(game, x, y);
      });
    });
    for (const task of tasks) {
      await task();
    }
  }
  async score(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        await cell.score(game, x, y);
      });
    });
    for (const task of tasks) {
      await task();
    }
  }
  forAllCells(f) {
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        f(cell, x, y);
      });
    });
  }
  async addSymbol(game, sym, x, y) {
    game.inventory.add(sym);
    if (this.cells[y][x].emoji() === '🕳️') {
      const hole = this.cells[y][x];
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
      this.cells[y][x] = hole;
      await this.spinDivOnce(game, x, y);
    } else {
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
    }
    this.redrawCell(game, x, y);
  }
  async removeSymbol(game, x, y) {
    game.inventory.remove(this.cells[y][x]);
    this.clearCell(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'flip', 0.15);
    await this.spinDivOnce(game, x, y);
  }

  nextToCoords(x, y) {
    const coords = [];
    const add = (x, y) => {
      if (
        x >= 0 &&
        x < this.gameSettings.boardX &&
        y >= 0 &&
        y < this.gameSettings.boardY
      ) {
        coords.push([x, y]);
      }
    };
    add(x - 1, y);
    add(x + 1, y);
    add(x, y - 1);
    add(x, y + 1);
    add(x - 1, y - 1);
    add(x + 1, y - 1);
    add(x - 1, y + 1);
    add(x + 1, y + 1);
    return coords;
  }

  nextToSymbol(x, y, emoji) {
    const coords = [];
    this.nextToCoords(x, y).forEach((coord) => {
      const [neighborX, neighborY] = coord;
      if (this.cells[neighborY][neighborX].emoji() === emoji) {
        coords.push([neighborX, neighborY]);
      }
    });
    return coords;
  }

  nextToExpr(x, y, expr) {
    const coords = [];
    this.nextToCoords(x, y).forEach((coord) => {
      const [neighborX, neighborY] = coord;
      if (expr(this.cells[neighborY][neighborX])) {
        coords.push([neighborX, neighborY]);
      }
    });
    return coords;
  }

  nextToCategory(x, y, category_name) {
    const category_symbols = this.catalog.categories.get(category_name);
    if (!category_symbols || category_symbols.length === 0) {
      return [];
    }
    return this.nextToExpr(x, y, (sym) =>
      category_symbols.includes(sym.emoji())
    );
  }

  nextToEmpty(x, y) {
    return this.nextToCategory(x, y, CATEGORY_EMPTY_SPACE);
  }
}
