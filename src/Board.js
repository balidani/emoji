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
  
    this.initLockedCells();
    this.initCells();
  }
  initCells() {
    this.cells = [];
    this.passiveCells = [];
    for (let y = 0; y < this.currentRows; ++y) {
      const row = [];
      for (let x = 0; x < this.settings.boardX; ++x) {
        const ilc = this.lockedCells[`${x},${y}`];
        const symbol = !ilc ? this.empty.copy() : ilc.symbol;
        row.push(symbol);
      }
      this.cells.push(row);
    }
    
    // Show play button in the center in the beginning.
    this.cells[2][2] = new PlayButton();
  }
  initLockedCells() {
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

  buildContext() {
    return {
      nextToCoords: this.nextToCoords.bind(this),
      nextToSymbol: this.nextToSymbol.bind(this),
      getEmoji: this.getEmoji.bind(this),
      nextToExpr: this.nextToExpr.bind(this),
      nextToCategory: this.nextToCategory.bind(this),
      nextToEmpty: this.nextToEmpty.bind(this),
      forAllCells: this.forAllCells.bind(this),
      forAllExpr: this.forAllExpr.bind(this),
      forAllCategory: this.forAllCategory.bind(this),
      allSameInRow: this.allSameInRow.bind(this),
      allSameInColumn: this.allSameInColumn.bind(this),
    }
  }
  handleModelEvent(effect) {
    const [_handler, action] = effect.component.split('.');
    switch (action) {
      case 'addSymbol':
        return this.addSymbol(effect.params.symbol, effect.params.coords.x, effect.params.coords.y);
      case 'removeSymbol':
        return this.removeSymbol(effect.params.coords.x, effect.params.coords.y);
      default:
        console.warn(`Unknown board model event action: ${action}`);
        return [];
    }
  }

  resetBoardSize(rows) {
    if (this.currentRows < rows) {
      for (let y = this.cells.length; y < rows; ++y) {
        const row = [];
        for (let x = 0; x < this.settings.boardX; ++x) {
          row.push(this.empty.copy());
        }
        this.cells.push(row);
      }
    }
    const effects = Effect.serial({type: 'view', component: 'board.resize', 
      params: {oldRows: this.currentRows, newRows: rows}});
    this.currentRows = rows;
    return effects;
  }
  roll() {
    const effects = [];
    if (this.currentRows !== this.inventory.rowCount) {
      effects.push(...this.resetBoardSize(this.inventory.rowCount));
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
        spinEffects.push({type: 'view', component: 'board.spin',
          params: {coords: {x, y}, symbol: symbol}});
      }
    });
    effects.push(Effect.parallel(...spinEffects));
    return effects;
  }
  clear() {
    this.lockedCells = [];
    for (let x = 0; x < this.settings.boardX; ++x) {
      for (let y = 0; y < this.cells.length; ++y) {
        if (y >= this.currentRows) {
          continue;
        }
        this.cells[y][x] = this.empty.copy();
      }
    }
  }
  evaluate(ctx) {
    this.forAllCells((cell, _, __) => {
      cell.turns++;
    });
    const effects = [];
    // Evaluate passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      effects.push(...passiveSymbol.evaluateProduce(ctx, -1, i));
    }
    // Evaluate board symbols
    const evaluateRound = (f) => {
      const effects = [];
      this.forAllCells((cell, x, y) => {
        // If the symbol has since been removed from the board, do not evaluate.
        if (this.cells[y][x] !== cell) {
          return [];
        }
        effects.push(...f(cell, ctx, x, y));
      });
      return effects;
    };
    effects.push(...evaluateRound((c, ctx, x, y) => c.evaluateConsume(ctx, x, y)));
    effects.push(...evaluateRound((c, ctx, x, y) => c.evaluateProduce(ctx, x, y)));
    effects.push(...evaluateRound((c, ctx, x, y) => c.evaluateConsume(ctx, x, y)));
    return effects;
  }
  finalScore(ctx) {
    const effects = [];
    // Final score passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      effects.push(...passiveSymbol.finalScore(ctx, -1, i));
    }
    // Final score board symbols
    this.forAllCells((cell, x, y) => {
      effects.push(...cell.finalScore(ctx, x, y));
    });
    return effects;
  }
  score(ctx) {
    const effects = [];
    // Score passives
    for (let i = 0; i < this.passiveCells.length; ++i) {
      const passiveSymbol = this.passiveCells[i];
      effects.push(...passiveSymbol.score(ctx, -1, i));
    }
    // Score board symbols
    this.forAllCells((cell, x, y) => {
      effects.push(...cell.score(ctx, x, y));
    });
    return effects;
  }
  addSymbol(sym, x, y) {
    const effects = [];
    effects.push(...this.inventory.add(sym));
    if (x === -1 || y === -1) {
      return [];
    }
    this.cells[y][x] = sym;
    effects.push(Effect.serial({type: 'view', component: 'board.addSymbol', 
      params: {coords: {x, y}, symbol: sym}}));
    return effects;
  }
  removeSymbol(x, y) {
    if (x === -1 || y === -1) {
      return [];
    }
    if (this.lockedCells[`${x},${y}`] !== undefined) {
      delete this.lockedCells[`${x},${y}`];
    }
    // TODO #REFACTOR:
    // effects.push(
    //   ...game.eventlog.showResourceLost(game.board.getEmoji(deleteX, deleteY), '', this.emoji())
    // );
    const effects = [];
    effects.push(...this.inventory.remove(this.cells[y][x]));
    this.cells[y][x] = this.empty.copy();
    effects.push(Effect.serial({type: 'view', component: 'board.removeSymbol',
      params: {coords: {x, y}}}));
    return effects;
  }

  lockCell(x, y, symbol, duration) {
    this.lockedCells[`${x},${y}`] = {
      symbol: symbol,
      duration: duration,
    };
  }
  unlockCell(x, y) {
    delete this.lockedCells[`${x},${y}`];
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

  pinCell(x, y) {
    this.lockCell(x, y, this.cells[y][x], -1);
    return Effect.serial({type: 'view', component: 'board.pinCell',
      params: {coords: {x, y}}});
  }

  makePassive(x, y) {
    const passiveCopy = this.cells[y][x].copy();
    const effects = [];
    effects.push(...this.removeSymbol(x, y));
    this.passiveCells.push(passiveCopy);
    effects.push(...this.inventory.addResource(passiveCopy.emoji(), 1));
    return effects;
  }
}
