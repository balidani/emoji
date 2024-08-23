/*
# ui reqs
- roll animation
- highlight triggered symbols
- show additions
- show removal
- chain animations
*/

const BOARD_SIZE = 5;
const random = (lim) => Math.random() * lim | 0;
const chance = (percent) => Math.random() < percent;
const randomChoose = (arr) => arr[random(arr.length)];
const randomRemove = (arr) => arr.splice(random(arr.length), 1)[0];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const animate = (element, animation, duration) => {
  return new Promise((resolve) => {
    element.style.animation = 'none';
    element.offsetWidth;  // lmao
    element.style.animation = `${animation} ${duration}s linear 1`;
    element.addEventListener('animationend', resolve, { once: true });
  });
};

// TODO: Move into Board
const inBounds = (coord) => coord >= 0 && coord < BOARD_SIZE;
const onLeft = (cells, x, y, name) => inBounds(x - 1) 
  && cells[y][x - 1].name === name;
const onRight = (cells, x, y, name) => inBounds(x + 1) 
  && cells[y][x + 1].name === name;
const onTop = (cells, x, y, name) => inBounds(y - 1) 
  && cells[y - 1][x].name === name;
const onBottom = (cells, x, y, name) => inBounds(y + 1) 
  && cells[y + 1][x].name === name;
const nextTo = (cells, x, y, name) => 
    onLeft(cells, x, y, name) ||
    onRight(cells, x, y, name) ||
    onTop(cells, x, y, name) ||
    onBottom(cells, x, y, name);
const rowOf = (cells, x, y, name, count) => {
  for (let i = 0; i < count - 1; ++i) {
    if (!onRight(cells, x + i, y, name)) {
      return false;
    }
  }
  return true;
};
const colOf = (cells, x, y, name, count) => {
  for (let i = 1; i < count; ++i) {
    if (!onBottom(cells, x, y + i, name)) {
      return false;
    }
  }
  return true;
};

class Symbol {
  constructor(name) {
    this.name = name;
  }
  toString() {
    return this.name;
  }
  evaluate() {
    return {score: 0};
  }
}

class Empty extends Symbol {
  static empty = null;
  constructor() {
    super('⬜');
  }
  static instance() {
    if (!Empty.empty) {
      Empty.empty = new Empty();
    }
    return Empty.empty;
  }
}

// Special symbol, only used to display the amount of money the
// player has.
class Dollar extends Symbol {
  static dollar = null;
  constructor() {
    super('💵') ;
  }
  static instance() {
    if (!Dollar.dollar) {
      Dollar.dollar = new Dollar();
    }
    return Dollar.dollar;
  }
}

class Coin extends Symbol {
  constructor() {
    super('🪙');
  }
  evaluate() {
    return {score: 1};
  }
}

class Cherry extends Symbol {
  constructor() {
    super('🍒');
  }
  evaluate(cells, x, y) {
    let score = 0;
    if (rowOf(cells, x, y, this.name, 5)) {
      score = 18;
    } else if (rowOf(cells, x, y, this.name, 4)) {
      score = 6;
    } else if (rowOf(cells, x, y, this.name, 3)) {
      score = 3;
    } else if (rowOf(cells, x, y, this.name, 2)) {
      score = 2;
    } else { 
      score = 1;
    }
    return {score: score};
  }
}

class Bell extends Symbol {
  constructor() {
    super('🔔');
  }
  evaluate() {
    return {score: 2};
  }
}

class Diamond extends Symbol {
  constructor() {
    super('💎');
  }
  evaluate() {
    return {score: 3};
  }
}

class Rock extends Symbol {
  constructor() {
    super('🪨');
  }
  evaluate() {
    return {score: 1};
  }
}

class Volcano extends Symbol {
  constructor() {
    super('🌋');
  }
  evaluate(cells, x, y) {
    if (chance(1.1)) {
      return {score: 0, sideEffects: [
        async (game) => {
          await game.board.spinDivOnce(
            random(BOARD_SIZE), random(BOARD_SIZE), new Rock());
        }]};
    }
    return {score: 0};
  }
}

class Inventory {
  constructor(symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector('.inventory');
  }
  update(game) {
    this.symbolsDiv.replaceChildren();
    const map = new Map();
    map.set(Dollar.instance().name, game.money);
    this.symbols.forEach((symbol) => {
      if (!map.has(symbol.name)) {
        map.set(symbol.name, 0);
      }
      map.set(symbol.name, map.get(symbol.name) + 1);
    });
    map.forEach((count, symbol) => {
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('inventoryEntry');
      symbolDiv.innerText = symbol;
      const countSpan = document.createElement('span');
      countSpan.classList.add('inventoryEntryCount');
      countSpan.innerText = count;
      symbolDiv.appendChild(countSpan);
      this.symbolsDiv.appendChild(symbolDiv);
    });
  }
}

class Board {
  constructor() {
    this.cells = [];
    const empty = Empty.instance();
    for (let i = 0; i < BOARD_SIZE; ++i) {
      const row = [];
      for (let j = 0; j < BOARD_SIZE; ++j) {
        row.push(empty);
      }
      this.cells.push(row);
    }
    this.gridDiv = document.getElementById('grid');
  }
  getSymbolDiv(x, y) {
    return this.gridDiv.children[y].children[x].children[0];
  }
  async spinDiv(x, y, symbol) {
    return new Promise(async (resolve) => {
      await delay(random(600));
      const div = this.getSymbolDiv(x, y);
      const randomSymbol = () => {
        const set = new Set();
        set.add(Empty.instance().name);
        for (const symbol of Object.values(game.inventory.symbols)) {
          set.add(symbol.name);
        }
        div.innerText = randomChoose([...set]);
      }
      await animate(div, 'startSpin', 0.1);
      for (let i = 0; i < 8; ++i) {
        randomSymbol();
        await animate(div, 'spin', 0.12 + i * 0.02);
      }
      div.innerText = symbol.name;
      await animate(div, 'endSpin', 0.3);
      await animate(div, 'endSpinBounce', 0.2);
      resolve();
    });
  }
  async spinDivOnce(x, y, symbol) {
    return new Promise(async (resolve) => {
      const div = this.getSymbolDiv(x, y);
      await animate(div, 'startSpin', 0.1);
      div.innerText = symbol.name;
      await animate(div, 'endSpin', 0.3);
      await animate(div, 'endSpinBounce', 0.2);
      resolve();
    });
  }
  async roll(inventory) {
    const symbols = [...inventory.symbols];
    const empties = [];
    for (let i = 0; i < BOARD_SIZE; ++i) {
      for (let j = 0; j < BOARD_SIZE; ++j) {
        empties.push([j, i]);
        this.cells[i][j] = Empty.instance();
      }
    }
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; ++i) {
      if (symbols.length === 0) {
        break;
      }
      const symbol = randomRemove(symbols)
      const [x, y] = randomRemove(empties);
      this.cells[y][x] = symbol;
    }
    const tasks = [];
    for (let i = 0; i < BOARD_SIZE; ++i) {
      for (let j = 0; j < BOARD_SIZE; ++j) {
        tasks.push(
          this.spinDiv(j, i, this.cells[i][j]));
      }
    }
    await Promise.all(tasks);
  }
  evaluate() {
    let score = 0;
    const sideEffects = [];
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        const result = cell.evaluate(this.cells, x, y);
        score += result.score;
        if ('sideEffects' in result) {
          sideEffects.push(...result.sideEffects);
        }
      });
    });
    return {score: score, sideEffects: sideEffects};
  }
}

class Game {
  constructor() {
    this.money = 100;
    this.inventory = new Inventory([
      new Coin(), new Coin(), new Coin(),
      new Cherry(), new Cherry(), new Cherry(), new Cherry(), new Cherry(),
      new Bell(),
      new Diamond(),
      new Volcano(),
    ]);
    this.inventory.update(this);
    this.board = new Board();
  }
  async roll() {
    if (this.money > 0) {
      this.money -= 1;
      await this.board.roll(this.inventory);
      const result = this.board.evaluate();
      result.sideEffects.forEach(async (effect) => await effect(game));
      this.money += result.score;
      this.inventory.update(this);
    }
  }
}

const game = new Game();

document.getElementById('roll')
  .addEventListener('click', () => game.roll());

