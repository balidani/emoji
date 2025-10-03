import * as Util from './util.js';

import { CATEGORY_EMPTY_SPACE } from './symbol.js';
import { PlayButton } from './symbols/ui.js';

export class Board {
  constructor(game) {
    this.settings = game.settings;
    this.catalog = game.catalog;
    this.cells = [];
    this.logLines = 0;

    // Create lockedCells from the settings and the inventory.
    this.lockedCells = [];
    const usedSymbols = new Set();
    for (const [addr, { emoji, duration }] of Object.entries(
      this.settings.initiallyLockedCells
    )) {
      let lockedSymbol = null;
      for (const inventorySymbol of game.inventory.symbols) {
        if (inventorySymbol.emoji() === emoji) {
          if (usedSymbols.has(inventorySymbol)) {
            continue;
          }
          lockedSymbol = inventorySymbol;
          usedSymbols.add(inventorySymbol);
          break;
        }
      }
      if (lockedSymbol === null) {
        console.error('Could not find symbol for locked cell:', emoji);
        break;
      }
      this.lockedCells[addr] = {
        symbol: lockedSymbol,
        duration: duration,
      };
    }

    this.gridDiv = document.querySelector('.game .grid');
    this.gridDiv.replaceChildren();
    this.empty = this.catalog.symbol('⬜');
    for (let y = 0; y < this.settings.boardY; ++y) {
      const row = [];
      const rowDiv = Util.createDiv('', 'row');
      for (let x = 0; x < this.settings.boardX; ++x) {
        const ilc = this.lockedCells[`${x},${y}`];
        const symbol = !ilc ? this.empty.copy() : ilc.symbol;
        row.push(symbol);
        const cellContainer = this.createCellDiv(x, y);
        rowDiv.appendChild(cellContainer);
      }
      this.cells.push(row);
      this.gridDiv.appendChild(rowDiv);
    }

    // Show play button in the center in the beginning.
    this.cells[2][2] = new PlayButton();
    this.spinDivOnce(game, 2, 2);

    for (const addr of Object.keys(this.lockedCells)) {
      const [x, y] = addr.split(',').map(Number);
      this.spinDivOnce(game, x, y);
    }
  }
  createCellDiv(x, y) {
    const cellContainer = Util.createDiv('', 'cell-container');
    const cellDiv = Util.createDiv('', 'cell', `cell-${x}-${y}`);
    const symbolDiv = Util.createDiv('⬜', 'symbol');
    const counterDiv = Util.createDiv('', 'symbol-counter');
    counterDiv.innerText = '';
    cellDiv.appendChild(symbolDiv);
    cellDiv.appendChild(counterDiv);
    cellContainer.appendChild(cellDiv);
    return cellContainer;
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
  async showResourceEarned(key, value, source='❓') {
    const text = `${source}→${key}${value}`;
    const logLines = document.getElementsByClassName('event-log')[0];
    logLines.innerHTML = `${text}<br>${logLines.innerHTML}`;
    this.logLines++;
    if (this.logLines > 20) {
      logLines.innerHTML = logLines.innerHTML
        .split('<br>')
        .slice(0, 20)
        .join('<br>');
      this.logLines = 20;
    }
    // const moneyDiv = Util.createDiv('', 'moneyEarned');
    // moneyDiv.innerText = text;
    // this.gridDiv.appendChild(moneyDiv);
    // await Util.animate(moneyDiv, 'fadeOutMoveDown', 0.3);
    // this.gridDiv.removeChild(moneyDiv);
  }
  clearCell(x, y) {
    const counterDiv = this.getCounterDiv(x, y);
    if (counterDiv) {
      this.getCounterDiv(x, y).innerText = '';
    }
    this.cells[y][x] = this.empty.copy();
  }
  async spinDiv(game, x, y, symbol) {
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

    const lockedSet = new Set();
    const lockedAtStart = { ...this.lockedCells };
    for (let y = 0; y < game.settings.boardY; ++y) {
      for (let x = 0; x < game.settings.boardX; ++x) {
        const addr = `${x},${y}`;
        const lockedSymbol = this.lockedCells[addr];
        if (lockedSymbol) {
          // If there is a locked symbol,
          this.cells[y][x] = lockedSymbol.symbol;
          lockedSet.add(lockedSymbol.symbol);
        } else {
          empties.push([x, y]);
          this.cells[y][x] = this.empty.copy();
        }

        if (lockedSymbol) {
          lockedSymbol.duration--;
          // Only remove on exactly 0 so that negative numbers indicate permanently locked slots.
          // Unlikely to have people roll two billion plus times per game.
          // Fun easter egg if anyone finds it.
          if (lockedSymbol.duration === 0) {
            delete this.lockedCells[addr];
          }
        }
      }
    }

    const numCellsToBeFilled =
      game.settings.boardY * game.settings.boardX -
      Object.keys(this.lockedCells).length;
    for (let i = 0; i < numCellsToBeFilled; ++i) {
      if (symbols.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(symbols);
      if (lockedSet.has(symbol)) {
        continue;
      }
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }

    const tasks = [];
    for (let y = 0; y < game.settings.boardY; ++y) {
      for (let x = 0; x < game.settings.boardX; ++x) {
        const addr = `${x},${y}`;
        if (lockedAtStart[addr]) {
          continue;
        }
        tasks.push(this.spinDiv(game, x, y, this.cells[y][x]));
      }
    }
    await Promise.all(tasks);
  }
  async clear(game) {
    for (let y = 0; y < game.settings.boardY; ++y) {
      for (let x = 0; x < game.settings.boardX; ++x) {
        this.cells[y][x] = this.empty.copy();
        await Util.delay(100);
        this.spinDivOnce(game, x, y);
      }
    }
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
    if (this.lockedCells[`${x},${y}`] !== undefined) {
      delete this.lockedCells[`${x},${y}`];
    }
    game.inventory.remove(this.cells[y][x]);
    this.clearCell(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'flip', 0.15);
    await this.spinDivOnce(game, x, y);
  }

  async lockCell(x, y, symbol, duration) {
    this.lockedCells[`${x},${y}`] = {
      symbol: symbol,
      duration: duration,
    };
    await Util.animate(this.getSymbolDiv(x, y), 'bounce', 0.05);
  }

  async unlockCell(x, y) {
    delete this.lockedCells[`${x},${y}`];
    this.clearCell(x, y);
    await Util.animate(this.getSymbolDiv(x, y), 'bounce', 0.05);
  }

  nextToCoords(x, y) {
    const coords = [];
    const add = (x, y) => {
      if (
        x >= 0 &&
        x < this.settings.boardX &&
        y >= 0 &&
        y < this.settings.boardY
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

  getEmoji(x, y) {
    return this.cells[y][x].emoji();
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

  forAllCells(f) {
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        f(cell, x, y);
      });
    });
  }

  forAllExpr(expr) {
    const coords = [];
    this.forAllCells((coord, x, y) => {
      if (expr(this.cells[y][x], x, y)) {
        coords.push([x, y]);
      }
    });
    return coords;
  }

  forAllCategory(category_name) {
    const category_symbols = this.catalog.categories.get(category_name);
    if (!category_symbols || category_symbols.length === 0) {
      return [];
    }
    return this.findExpr((sym, _, __) =>
      category_symbols.includes(sym.emoji())
    );
  }
}
