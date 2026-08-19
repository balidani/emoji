import * as Util from './util.js';
import * as Const from './consts.js';

import { CATEGORY_EMPTY_SPACE } from './symbol.js';
import { PlayButton } from './symbols/ui.js';

export class Board {
  constructor(game) {
    // Game's constructor assigns `this.board = new Board(this)` only after
    // this constructor returns, but renderSpec() below needs game.board
    // (for lockedAt) while still constructing. Self-register immediately so
    // it's available throughout -- Game's later assignment just re-sets the
    // same reference.
    game.board = this;
    this.settings = game.settings;
    this.catalog = game.catalog;
    this.view = game.view;
    this.cells = [];
    this.logLines = 0;
    this.passiveCells = [];
    this.currentRows = this.settings.boardY;

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

    this.empty = this.catalog.symbol(Const.EMPTY);
    for (let y = 0; y < this.currentRows; ++y) {
      const row = [];
      for (let x = 0; x < this.settings.boardX; ++x) {
        const ilc = this.lockedCells[`${x},${y}`];
        const symbol = !ilc ? this.empty.copy() : ilc.symbol;
        row.push(symbol);
      }
      this.cells.push(row);
    }
    this.view.clearBoard(this.currentRows, this.settings.boardX);

    // Show play button in the center in the beginning.
    this.cells[2][2] = new PlayButton();
    this.view.spinCellOnce(2, 2, this.cells[2][2].renderSpec(game, 2, 2));

    for (const addr of Object.keys(this.lockedCells)) {
      const [x, y] = addr.split(',').map(Number);
      this.view.spinCellOnce(x, y, this.cells[y][x].renderSpec(game, x, y));
    }
  }
  async resetBoardSize(rows) {
    const oldRows = this.currentRows;
    if (this.currentRows < rows) {
      // Grow the model for any rows that don't exist yet.
      for (let y = this.cells.length; y < rows; ++y) {
        const row = [];
        for (let x = 0; x < this.settings.boardX; ++x) {
          row.push(this.empty.copy());
        }
        this.cells.push(row);
      }
    }
    await this.view.resizeBoard(oldRows, rows, this.settings.boardX);
    this.currentRows = rows;
  }
  getSymbolDiv(x, y) {
    if (x === -1) {
      // Passive symbol, look for the div among inventoryEntry.
      const emoji = this.passiveCells[y].emoji();
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
  getCellDiv(x, y) {
    return document.querySelector(`.cell-${y}-${x}`);
  }
  redrawCell(game, x, y) {
    if (x === -1) {
      return;
    }
    this.view.redrawCell(x, y, this.cells[y][x].renderSpec(game, x, y));
  }
  clearCell(x, y) {
    this.view.clearCellDecorations(x, y);
    this.cells[y][x] = this.empty.copy();
  }
  async roll(game) {
    if (this.currentRows !== game.inventory.rowCount) {
      await this.resetBoardSize(game.inventory.rowCount);
    }
    game.inventory.resetRows();
    const empties = [];

    const lockedSet = new Set();
    const lockedAtStart = { ...this.lockedCells };
    for (let y = 0; y < this.currentRows; ++y) {
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

    const pool = [...game.inventory.symbols].filter((s) => !lockedSet.has(s));
    const numCellsToBeFilled = empties.length;
    for (let i = 0; i < numCellsToBeFilled; ++i) {
      if (pool.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(pool);
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }

    const tasks = [];
    for (let y = 0; y < this.currentRows; ++y) {
      for (let x = 0; x < game.settings.boardX; ++x) {
        const addr = `${x},${y}`;
        if (lockedAtStart[addr]) {
          continue;
        }
        const spec = this.cells[y][x].renderSpec(game, x, y);
        tasks.push(
          this.view.spinCell(x, y, spec, () =>
            game.inventory.getRandomOwnedEmoji()
          )
        );
      }
    }
    await Promise.all(tasks);
  }
  async transformWildcards(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      if (!cell.transformsOnRoll()) {
        return;
      }
      const joker = cell;
      const disguise = joker.rollDisguise(game);
      disguise.wildcardHome = joker;
      const fromSpec = joker.renderSpec(game, x, y);
      this.cells[y][x] = disguise;
      const toSpec = disguise.renderSpec(game, x, y);
      tasks.push(this.view.transformCell(x, y, fromSpec, toSpec));
      tasks.push(
        game.eventlog.logResourceChange(
          disguise.emoji(),
          '',
          joker.emoji(),
          'earned'
        )
      );
    });
    await Promise.all(tasks);
  }
  async revertWildcards(game) {
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      if (cell.wildcardHome === undefined) {
        return;
      }
      const joker = cell.wildcardHome;
      const fromSpec = cell.renderSpec(game, x, y);
      delete cell.wildcardHome;
      this.cells[y][x] = joker;
      const toSpec = joker.renderSpec(game, x, y);
      tasks.push(this.view.transformCell(x, y, fromSpec, toSpec));
    });
    await Promise.all(tasks);
  }
  async clear(game) {
    this.lockedCells = [];
    for (let x = 0; x < game.settings.boardX; ++x) {
      for (let y = 0; y < this.cells.length; ++y) {
        if (y >= this.currentRows) {
          continue;
        }
        this.cells[y][x] = this.empty.copy();
        await Util.delay(16);
        Util.animate(this.getSymbolDiv(x, y), 'fadeOutHalf', 0.3).then(() => {
          this.getSymbolDiv(x, y).style.opacity = '0.5';
        });
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
    // Evaluate passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      await passiveSymbol.evaluateProduce(game, -1, i);
    }
    // Evaluate board symbols
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
    // Final score passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      await passiveSymbol.finalScore(game, -1, i);
    }
    // Final score board symbols
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
    // Score passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      await passiveSymbol.score(game, -1, i);
    }
    // Score board symbols
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
    game.stats?.recordGenerated(sym.emoji());
    game.inventory.add(sym);
    if (x === -1 || y === -1) {
      return;
    }
    if (this.cells[y][x].emoji() === '🕳️') {
      const hole = this.cells[y][x];
      this.cells[y][x] = sym;
      const newSpec = sym.renderSpec(game, x, y);
      this.cells[y][x] = hole;
      const holeSpec = hole.renderSpec(game, x, y);
      await this.view.spinIntoHole(x, y, newSpec, holeSpec);
    } else {
      this.cells[y][x] = sym;
      await this.view.spinCellOnce(x, y, sym.renderSpec(game, x, y));
    }
    this.redrawCell(game, x, y);
  }
  async removeSymbol(game, x, y, { toGraveyard = true } = {}) {
    if (x === -1 || y === -1) {
      return;
    }
    if (this.lockedCells[`${x},${y}`] !== undefined) {
      delete this.lockedCells[`${x},${y}`];
    }
    game.inventory.remove(this.cells[y][x], { toGraveyard });
    this.clearCell(x, y);
    await this.view.shakeAndRemove(
      x,
      y,
      this.cells[y][x].renderSpec(game, x, y)
    );
  }

  async lockCell(x, y, symbol, duration) {
    this.lockedCells[`${x},${y}`] = {
      symbol: symbol,
      duration: duration,
    };
  }

  async unlockCell(x, y) {
    delete this.lockedCells[`${x},${y}`];
    this.clearCell(x, y);
  }

  nextToCoords(x, y) {
    if (x === -1 || y === -1) {
      return [];
    }
    const coords = [];
    const add = (x, y) => {
      if (
        x >= 0 &&
        x < this.settings.boardX &&
        y >= 0 &&
        y < this.currentRows
      ) {
        coords.push([x, y]);
      }
    };
    add(x - 1, y - 1);
    add(x - 1, y);
    add(x - 1, y + 1);
    add(x, y - 1);
    add(x, y + 1);
    add(x + 1, y - 1);
    add(x + 1, y);
    add(x + 1, y + 1);
    return coords;
  }

  nextToSymbol(x, y, emoji) {
    if (x === -1 || y === -1) {
      return [];
    }
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
    if (x === -1) {
      return this.passiveCells[y].emoji();
    }
    return this.cells[y][x].emoji();
  }

  getSymbol(x, y) {
    if (x === -1) {
      return this.passiveCells[y];
    }
    return this.cells[y][x];
  }

  lockedAt(x, y) {
    return !!this.lockedCells[`${x},${y}`];
  }

  nextToExpr(x, y, expr) {
    if (x === -1 || y === -1) {
      return [];
    }
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
      if (y >= this.currentRows) {
        return;
      }
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

  allSameInRow(x, y) {
    const emoji = this.cells[y][x].emoji();
    for (let i = 0; i < this.settings.boardX; ++i) {
      if (this.cells[y][i].emoji() !== emoji) {
        return false;
      }
    }
    return true;
  }
  allSameInColumn(x, y) {
    const emoji = this.cells[y][x].emoji();
    for (let i = 0; i < this.currentRows; ++i) {
      if (this.cells[i][x].emoji() !== emoji) {
        return false;
      }
    }
    return true;
  }

  async pinCell(game, x, y) {
    await this.lockCell(x, y, this.cells[y][x], -1);
    await this.view.pinCell(x, y, this.cells[y][x].renderSpec(game, x, y));
  }

  addClickListener(game) {
    this.view.addRollListener(() => game.roll());
  }

  async makePassive(game, x, y) {
    const passiveCopy = this.cells[y][x].copy();
    await this.removeSymbol(game, x, y, { toGraveyard: false });
    this.passiveCells.push(passiveCopy);
    game.inventory.addResource(passiveCopy.emoji(), 1);
  }
}
