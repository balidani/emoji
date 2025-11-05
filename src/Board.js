import * as Const from './consts.js';
import * as Util from './util.js';

import { CATEGORY_EMPTY_SPACE } from './symbol.js';
import { BoardView } from './BoardView.js';
import { Effect } from './Effect.js';
import { PlayButton } from './symbols/ui.js';

export class Board {
  constructor(settings, catalog, inventory) {
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = inventory;
    this.currentRows = this.settings.boardY;
    this.empty = this.catalog.symbol(Const.EMPTY);
  
    this._initLockedCells();
    this._initCells();
  }
  _initLockedCells() {
    this.lockedCells = [];
    const usedSymbols = new Set();
    for (const [addr, { emoji, duration }] of Object.entries(
      this.settings.initiallyLockedCells
    )) {
      let lockedSymbol = null;
      for (const inventorySymbol of this.inventory.symbols) {
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
  }
  _initCells() {
    this.cells = [];
    for (let y = 0; y < this.currentRows; ++y) {
      const row = [];
      for (let x = 0; x < this.settings.boardX; ++x) {
        const ilc = this.lockedCells[`${x},${y}`];
        const symbol = !ilc ? this.empty.copy() : ilc.symbol;
        row.push(symbol);
      }
      this.cells.push(row);
    }
  }

  buildContext() {
    return {
      nextToCoords: this.nextToCoords.bind(this),
      nextToSymbol: this.nextToSymbol.bind(this),
      getSymbol: this.getSymbol.bind(this),
      getEmoji: this.getEmoji.bind(this),
      nextToExpr: this.nextToExpr.bind(this),
      nextToCategory: this.nextToCategory.bind(this),
      nextToEmpty: this.nextToEmpty.bind(this),
      forAllCells: this.forAllCells.bind(this),
      forAllExpr: this.forAllExpr.bind(this),
      forAllCategory: this.forAllCategory.bind(this),
      allSameInRow: this.allSameInRow.bind(this),
      allSameInColumn: this.allSameInColumn.bind(this),
      lockedAt: this.lockedAt.bind(this),
    }
  }

  _resetBoardSize(rows) {
    if (this.currentRows < rows) {
      for (let y = this.cells.length; y < rows; ++y) {
        const row = [];
        for (let x = 0; x < this.settings.boardX; ++x) {
          row.push(this.empty.copy());
        }
        this.cells.push(row);
      }
    }
    const effect = Effect.viewOf('board.resetBoardSize')
      .params({oldRows: this.currentRows, newRows: rows, cols: this.settings.boardX});
    this.currentRows = rows;
    return effect;
  }
  roll(ctx) {
    const effects = [];
    if (this.currentRows !== this.inventory.rowCount) {
      effects.push(this._resetBoardSize(this.inventory.rowCount));
    }
    this.inventory.resetRows();
    const symbols = [...this.inventory.symbols];
    const empties = [];

    const lockedSet = new Set();
    const lockedAtStart = { ...this.lockedCells };
    for (let y = 0; y < this.currentRows; ++y) {
      for (let x = 0; x < this.settings.boardX; ++x) {
        const addr = `${x},${y}`;
        const lockedSymbol = this.lockedCells[addr];
        if (lockedSymbol) {
          this.cells[y][x] = lockedSymbol.symbol;
          lockedSet.add(lockedSymbol.symbol);
        } else {
          empties.push([x, y]);
          this.cells[y][x] = this.empty.copy();
        }
        if (lockedSymbol) {
          lockedSymbol.duration--;
          // Only remove on exactly 0 so that negative numbers indicate permanently locked slots.
          if (lockedSymbol.duration === 0) {
            delete this.lockedCells[addr];
          }
        }
      }
    }

    const pool = [...this.inventory.symbols].filter(s => !lockedSet.has(s));
    const numCellsToBeFilled = empties.length;
    for (let i = 0; i < numCellsToBeFilled; ++i) {
      if (pool.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(pool);
      const [x, y] = Util.randomRemove(empties);
      this.cells[y][x] = symbol;
    }

    const spinEffects = [];
    this.forAllCells((symbol, x, y) => {
      if (!lockedAtStart[`${x},${y}`]) {
        const renderSpec = symbol.renderSpec(ctx, x, y);
        spinEffects.push(Effect.viewOf('board.spinCell')
          .params({coords: {x, y}, renderSpec}));
      }
    });
    effects.push(Effect.parallel(...spinEffects));
    return Effect.serial(...effects);
  }
  clear() {
    this.lockedCells = [];
    for (let y = 0; y < this.cells.length; ++y) {
      if (y >= this.currentRows) {
        continue;
      }
      for (let x = 0; x < this.settings.boardX; ++x) {
        this.cells[y][x] = this.empty.copy();
      }
    }
    return Effect.viewOf('board.clear')
      .params({rows: this.currentRows, cols: this.settings.boardX});
  }
  _evaluatePhase(ctx, phase) {
    const effects = [];
    this.forAllCells((cell, x, y) => {
      // If the symbol has since been removed from the board, do not evaluate.
      if (this.cells[y][x] !== cell) {
        return [];
      }
      effects.push(cell[phase](ctx, x, y));
    });
    return Effect.serial(...effects);
  }
  evaluateConsume(ctx) {
    return this._evaluatePhase(ctx, 'evaluateConsume');
  }
  evaluateProduce(ctx) {
    return this._evaluatePhase(ctx, 'evaluateProduce');
  }
  increaseTurns(ctx) {
    this.forAllCells((cell, _, __) => {
      cell.turns++;
    });
    return Effect.none();
  }
  finalScore(ctx) {
    const effects = [];
    this.forAllCells((cell, x, y) => {
      effects.push(cell.finalScore(ctx, x, y));
    });
    return Effect.serial(...effects);
  }
  score(ctx) {
    const effects = [];
    this.forAllCells((cell, x, y) => {
      effects.push(cell.score(ctx, x, y));
    });
    return Effect.serial(...effects);
  }
  addSymbol({ ctx, symbol, x, y }) {
    const effects = [];
    // TODO #REFACTOR: remove references to inventory?
    effects.push(this.inventory.add(symbol));
    const prevRenderSpec = this.cells[y][x].renderSpec(ctx, x, y);
    const renderSpec = symbol.renderSpec(ctx, x, y);
    if (prevRenderSpec.emoji !== Const.HOLE) {
      this.cells[y][x] = symbol;
    }
    effects.push(Effect.viewOf('board.addSymbol')
      .params({coords: {x, y}, prevRenderSpec, renderSpec}));
    return Effect.serial(...effects);
  }
  removeSymbol({ ctx, coords, symbol }) {
    const { x, y } = coords;
    if (this.cells[y][x] !== symbol) {
      return Effect.none();
    }
    if (this.lockedCells[`${x},${y}`] !== undefined) {
      delete this.lockedCells[`${x},${y}`];
    }
    // TODO #REFACTOR:
    // effects.push(
    //   ...game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji())
    // );
    const effects = [];
    effects.push(Effect.modelOf('inventory.removeSymbol')
      .params({symbol: this.cells[y][x]}));
    this.cells[y][x] = this.empty.copy();
    const renderSpec = this.cells[y][x].renderSpec(ctx, x, y);
    effects.push(Effect.viewOf('board.removeSymbol')
      .params({coords: {x, y}, renderSpec}));
    return Effect.serial(...effects);
  }

  _lockCell(x, y, symbol, duration) {
    this.lockedCells[`${x},${y}`] = {
      symbol: symbol,
      duration: duration,
    };
  }
  _unlockCell(x, y) {
    delete this.lockedCells[`${x},${y}`];
  }
  pinCell({ctx, x, y}) {
    this._lockCell(x, y, this.cells[y][x], -1);
    const renderSpec = this.cells[y][x].renderSpec(ctx, x, y);
    return Effect.viewOf('board.pinCell')
      .params({coords: {x, y}, renderSpec});
  }
  makePassive({ _ctx, x, y }) {
    const passiveCopy = this.cells[y][x].copy();
    const effects = [];
    effects.push(this.removeSymbol(x, y));
    effects.push(this.inventory.makePassive(passiveCopy));
    return Effect.serial(...effects);
  }

  nextToCoords(x, y) {
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
    const coords = [];
    this.nextToCoords(x, y).forEach((coord) => {
      const [neighborX, neighborY] = coord;
      if (this.cells[neighborY][neighborX].emoji() === emoji) {
        coords.push([neighborX, neighborY]);
      }
    });
    return coords;
  }
  getSymbol(x, y) {
    return this.cells[y][x];
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
    this.forAllCells((_coord, x, y) => {
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
  lockedAt(x, y) {
    return this.lockedCells[`${x},${y}`] !== undefined;
  }
}
