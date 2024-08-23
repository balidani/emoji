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
const animate = (element, animation, duration, repeat=1) => {
  return new Promise((resolve) => {
    element.style.animation = 'none';
    element.offsetWidth;  // lmao
    element.style.animation = `${animation} ${duration}s linear ${repeat}`;
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
const nextToCoords = (cells, x, y, name) => {
  const coords = [];
  if (onLeft(cells, x, y, name)) {
    coords.push([x - 1, y]);
  }
  if (onRight(cells, x, y, name)) {
    coords.push([x + 1, y]);
  }
  if (onTop(cells, x, y, name)) {
    coords.push([x, y - 1]);
  }
  if (onBottom(cells, x, y, name)) {
    coords.push([x, y + 1]);
  }
  return coords;
};
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
    return [];
  }
  score() {
    return 0;
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
  score() {
    return 1;
  }
}

class Cherry extends Symbol {
  constructor() {
    super('🍒');
  }
  score(cells, x, y) {
    let total = 0;
    if (rowOf(cells, x, y, this.name, 5)) {
      total = 18;
    } else if (rowOf(cells, x, y, this.name, 4)) {
      total = 6;
    } else if (rowOf(cells, x, y, this.name, 3)) {
      total = 3;
    } else if (rowOf(cells, x, y, this.name, 2)) {
      total = 2;
    } else { 
      total = 1;
    }
    return total;
  }
}

class MusicalNote extends Symbol {
  constructor() {
    super('🎵');
    this.timeToLive = 3;
  }
  score() {
    return 3;
  }
  evaluate(cells, x, y) {
    this.timeToLive--;
    if (this.timeToLive === 0) {
      return [(async (game) => {
        game.inventory.remove(this);
        game.board.cells[y][x] = Empty.instance();
        await game.board.spinDivOnce(x, y);
      })];
    }
    return [];
  }
}

class Bell extends Symbol {
  constructor() {
    super('🔔');
  }
  score() {
    return 2;
  }
  evaluate(cells, x, y) {
    if (chance(0.5)) {
      return [async (game) => {
        console.log(game);
        const note = new MusicalNote();
        const coords = nextToCoords(cells, x, y, Empty.instance().name);
        if (coords.length === 0) {
          return;
        }
        const [newX, newY] = randomChoose(coords);
        cells[newY][newX] = note;
        game.inventory.add(note);
        await animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
        await game.board.spinDivOnce(newX, newY);
      }];
    }
    return [];
  }
}

class Diamond extends Symbol {
  constructor() {
    super('💎');
  }
  score() {
    return 3;
  }
}

class Rock extends Symbol {
  constructor() {
    super('🪨');
  }
  score() {
    return 3;
  }
}

class Volcano extends Symbol {
  constructor() {
    super('🌋');
  }
  evaluate(cells, x, y) {
    if (chance(0.1)) {
      return [async (game) => {
        const rock = new Rock();
        const newX = random(BOARD_SIZE);
        const newY = random(BOARD_SIZE);
        game.inventory.remove(cells[newY][newX]);
        cells[newY][newX] = rock;
        game.inventory.add(rock);
        await animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
        await game.board.spinDivOnce(newX, newY);
      }];
    }
    return [];
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
  remove(symbol) {
    const index = this.symbols.indexOf(symbol);
    if (index >= 0) {
      this.symbols.splice(index, 1);
    }
  }
  add(symbol) {
    this.symbols.push(symbol);
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
  }
  async spinDivOnce(x, y) {
    const div = this.getSymbolDiv(x, y);
    await animate(div, 'startSpin', 0.1);
    div.innerText = this.cells[y][x].name;
    await animate(div, 'endSpin', 0.3);
    await animate(div, 'endSpinBounce', 0.2);
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
    const sideEffects = [];
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        sideEffects.push(...cell.evaluate(this.cells, x, y));
      });
    });
    return sideEffects;
  }
  score() {
    let total = 0;
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        const cellScore = cell.score(this.cells, x, y);
        total += cellScore;
      });
    });
    return total;
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
      await this.board.evaluate().forEach(
        async (effect) => await effect(game));
      this.money += this.board.score();
      this.inventory.update(this);
    }
  }
}

const game = new Game();

document.getElementById('roll')
  .addEventListener('click', () => game.roll());

