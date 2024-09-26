import * as Util from './util.js'

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
        const symbolDiv = document.createElement('div');
        symbolDiv.classList.add('symbol');
        symbolDiv.innerText = '⬜';
        const counterDiv = document.createElement('div');
        counterDiv.classList.add('symbolCounter');
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
    return this.gridDiv.children[y].children[x].children[0];
  }
  updateCounter(game, x, y) {
    const counterDiv = this.gridDiv.children[y].children[x].children[1];
    const counter = this.cells[y][x].counter(game);
    if (counter !== null) {
      counterDiv.innerText = counter;
    }
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
    this.getCounterDiv(x, y).innerText = '';
    this.cells[y][x] = this.empty.copy();
  }
  async spinDiv(game, x, y, symbol) {
    await Util.delay(Util.random(600));
    const div = this.getSymbolDiv(x, y);
    const counterDiv = this.getCounterDiv(x, y);
    counterDiv.innerText = '';
    const randomSymbol = () => {
      const set = new Set();
      for (const symbol of Object.values(game.inventory.symbols)) {
        set.add(symbol.name());
      }
      div.innerText = Util.randomChoose([...set]);
    }
    await Util.animate(div, 'startSpin', 0.1);
    for (let i = 0; i < 6; ++i) {
      randomSymbol();
      await Util.animate(div, 'spin', 0.12 + i * 0.02);
    }
    div.innerText = symbol.name();
    div.removeEventListener('click', div.clickEvent);
    div.clickEvent = () => {
      Util.drawText(game.info, symbol.descriptionLong());
    };
    div.addEventListener('click', div.clickEvent);
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
    if (symbol.counter(game) != null) {
      counterDiv.innerText = symbol.counter(game);
    }
  }
  async spinDivOnce(game, x, y) {
    const div = this.getSymbolDiv(x, y);
    const counterDiv = this.getCounterDiv(x, y);
    counterDiv.innerText = '';
    await Util.animate(div, 'startSpin', 0.1);
    const symbol = this.cells[y][x];
    div.innerText = symbol.name();
    div.removeEventListener('click', div.clickEvent);
    div.clickEvent = () => {
      Util.drawText(game.info, symbol.descriptionLong());
    };
    div.addEventListener('click', div.clickEvent);
    await Util.animate(div, 'endSpin', 0.3);
    await Util.animate(div, 'bounce', 0.1);
    if (symbol.counter(game) != null) {
      counterDiv.innerText = symbol.counter(game);
    }
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
    for (let i = 0; i < game.gameSettings.boardY * game.gameSettings.boardX; ++i) {
      if (symbols.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(symbols)
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }
    const tasks = [];
    for (let i = 0; i < game.gameSettings.boardY; ++i) {
      for (let j = 0; j < game.gameSettings.boardX; ++j) {
        tasks.push(
          this.spinDiv(game, j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  async evaluate(game) {
    this.forAllCells((cell, x, y) => {
      cell.turns++;
    });
    this.forAllCells((cell, x, y) => {
      this.updateCounter(game, x, y);
    });
    const evaluateRound = async (f) => {
      const tasks = [];
      this.forAllCells((cell, x, y) => tasks.push(
        async () => {
          // If the symbol has since been removed from the board, do not evaluate.
          if (this.cells[y][x] !== cell) {
            return;
          }
          await f(cell, game, x, y);
        }));
      for (const task of tasks) {
        await task();
      }
      this.forAllCells((cell, x, y) => {
        this.updateCounter(game, x, y);
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
    })
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
    })
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
    if (this.cells[y][x].name() === '🕳️') {
      const hole = this.cells[y][x];
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
      this.cells[y][x] = hole;
      await this.spinDivOnce(game, x, y);
    } else {
      this.cells[y][x] = sym;
      await this.spinDivOnce(game, x, y);
    }
    this.updateCounter(game, x, y);
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
      if (x >= 0 && x < this.gameSettings.boardX && y >= 0 && y < this.gameSettings.boardY) {
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
  };

  nextToSymbol(x, y, name) {
    const coords = [];
    this.nextToCoords(x, y).forEach((coord) => {
      const [neighborX, neighborY] = coord;
      if (this.cells[neighborY][neighborX].name() === name) {
        coords.push([neighborX, neighborY]);
      }
    });
    return coords;
  };

  nextToExpr(x, y, expr) {
    const coords = [];
    this.nextToCoords(x, y).forEach((coord) => {
      const [neighborX, neighborY] = coord;
      if (expr(this.cells[neighborY][neighborX])) {
        coords.push([neighborX, neighborY]);
      }
    });
    return coords;
  };

  nextToEmpty(x, y) {
    return this.nextToExpr(x, y, (sym) => ["⬜", "🕳️"].includes(sym.name()));
  };

  nextToCategory(x, y, category_name) {
    const category_symbols = this.catalog.categories.get(category_name)
    if (!category_symbols || category_symbols.length === 0) {
      return [];
    }
    return this.nextToExpr(x, y, (sym) => category_symbols.includes(sym.name()));
  }
}
