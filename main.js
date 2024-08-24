/*
# ui reqs
- roll animation
- highlight triggered symbols
- show additions
- show removal
- chain animations
*/

const BOARD_SIZE = 5;
const luckyChance = (chance, x, y) => {
  const check = (name, percent) => {
    let total = 0;
    game.board.forAllCells((cell, x, y) => {
      if (cell.name === name) {
        total += percent;
      }
    });
    if (nextToCoords(
      game.board.cells, x, y, new BullsEye().name).length > 0) {
        total += 1.0;
    }
    return total;
  };
  let total = 0;
  total += check(new Clover().name, 0.01);
  total += check(new CrystalBall().name, 0.05);
  return chance + total;
}
const random = (lim) => Math.random() * lim | 0;
const chance = (percent, x, y) => Math.random() < luckyChance(percent, x, y);
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

const inBounds = (coord) => coord >= 0 && coord < BOARD_SIZE;
const onLeft = (cells, x, y, name) => inBounds(x - 1) 
  && cells[y][x - 1].name === name;
const onRight = (cells, x, y, name) => inBounds(x + 1) 
  && cells[y][x + 1].name === name;
const onTop = (cells, x, y, name) => inBounds(y - 1) 
  && cells[y - 1][x].name === name;
const onBottom = (cells, x, y, name) => inBounds(y + 1) 
  && cells[y + 1][x].name === name;
const onTopLeft = (cells, x, y, name) => inBounds(x - 1) && inBounds(y - 1)
  && cells[y - 1][x - 1].name === name;
const onTopRight = (cells, x, y, name) => inBounds(x + 1) && inBounds(y - 1)
  && cells[y - 1][x + 1].name === name;
const onBottomLeft = (cells, x, y, name) => inBounds(x - 1) && inBounds(y + 1)
  && cells[y + 1][x - 1].name === name;
const onBottomRight = (cells, x, y, name) => inBounds(x + 1) && inBounds(y + 1)
  && cells[y + 1][x + 1].name === name;
const nextTo = (cells, x, y, name) => 
  [onLeft, onRight, onTop, onBottom, 
    onTopLeft, onTopRight, onBottomLeft, onBottomRight].some((f) => f(cells, x, y, name));
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
  if (onTopLeft(cells, x, y, name)) {
    coords.push([x - 1, y - 1]);
  }
  if (onTopRight(cells, x, y, name)) {
    coords.push([x + 1, y - 1]);
  }
  if (onBottomLeft(cells, x, y, name)) {
    coords.push([x - 1, y + 1]);
  }
  if (onBottomRight(cells, x, y, name)) {
    coords.push([x + 1, y + 1]);
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
  async evaluate() {}
  async score(x, y) {}
  description() {
    throw new Error('What the hell?');
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
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  description() {
    return '💵1';
  }
}

class Egg extends Symbol {
  constructor() {
    super('🥚');
    this.timeToHatch = 3 + random(3);
  }
  async evaluate(x, y) {
    this.timeToHatch--;
    if (this.timeToHatch === 0) {
      game.inventory.remove(this);
      let newSymbol = new Chick();
      if (chance(0.01, x, y)) {
        newSymbol = new Dragon();
      }
      game.inventory.add(newSymbol);
      game.board.cells[y][x] = newSymbol;
      await game.board.spinDivOnce(x, y);
    }
  }
  description() {
    return 'after 3-5 turns: hatch 🐣<br>1%: hatch 🐉'
  }
}

class Clover extends Symbol {
  constructor() {
    super('🍀');
  }
  description() {
    return '+1% luck';
  }
}

class CrystalBall extends Symbol {
  constructor() {
    super('🔮');
  }
  description() {
    return '+5% luck';
  }
}

class BullsEye extends Symbol {
  constructor() {
    super('🎯');
  }
  description() {
    return 'neighboring roll always succeeds';
  }
}

class Dragon extends Symbol {
  constructor() {
    super('🐉');
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(33)]);
  }
  description() {
    return '💵33';
  }
}

class Fox extends Symbol {
  constructor() {
    super('🦊');
  }
  async evaluate(x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = nextToCoords(game.board.cells, x, y, new neighborClass().name);
      if (coords.length === 0) {
        return;
      }
      const empty = Empty.instance();
      for (const coord of coords) {
        this.eatenScore += 10;
        const [deleteX, deleteY] = coord;
        game.board.cells[deleteY][deleteX] = empty;
        await animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 3);
        await game.board.spinDivOnce(deleteX, deleteY);
      }
    };
    await eatNeighbor(Chick, 5);
    await eatNeighbor(Chicken, 10);
  }
  async score() {
    if (this.eatenScore > 0) {
      this.eatenScore = 0;
      await Promise.all([
        animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        game.inventory.addMoney(this.eatenScore)]);
    }
  }
  description() {
    return 'eats neighboring 🐔 for 💵10<br>eats neighboring 🐣 for 💵5'
  }
}

class Chick extends Symbol {
  constructor() {
    super('🐣');
    this.timeToGrow = 3;
  }
  async evaluate(x, y) {
    this.timeToGrow--;
    if (this.timeToGrow === 0) {
      game.inventory.remove(this);
      const chicken = new Chicken();
      game.inventory.add(chicken);
      game.board.cells[y][x] = chicken;
      await game.board.spinDivOnce(x, y);
    }
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  description() {
    return '💵1<br>after 3 turns: become 🐔'
  }
}

class Chicken extends Symbol {
  constructor() {
    super('🐔');
  }
  async evaluate(x, y) {
    if (chance(0.1, x, y)) {
      const coords = nextToCoords(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const eggCount = 1 + random(3);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = randomRemove(coords);
        const egg = new Egg();
        game.board.cells[newY][newX] = egg;
        game.inventory.add(egg);
        await animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
        await game.board.spinDivOnce(newX, newY);
      }
    }
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(3)]);
  }
  description() {
    return '💵3<br>10%: lay up to 3 🥚'
  }
}

class Cherry extends Symbol {
  constructor() {
    super('🍒');
  }
  async score(x, y) {
    const coords = nextToCoords(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        game.inventory.addMoney(2),
      ]);
    }
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
}

class MusicalNote extends Symbol {
  constructor() {
    super('🎵');
    this.timeToLive = 3;
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  async evaluate(x, y) {
    this.timeToLive--;
    if (this.timeToLive === 0) {
      game.inventory.remove(this);
      game.board.cells[y][x] = Empty.instance();
      await game.board.spinDivOnce(x, y);
    }
  }
  description() {
    return '💵1<br>disappear after 3 turns';
  }
}

class Bell extends Symbol {
  constructor() {
    super('🔔');
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(2)]);
  }
  async evaluate(x, y) {
    if (chance(0.2, x, y)) {
      const note = new MusicalNote();
      const coords = nextToCoords(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = randomChoose(coords);
      game.board.cells[newY][newX] = note;
      game.inventory.add(note);
      await animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
      await game.board.spinDivOnce(newX, newY);
    }
    return [];
  }
  description() {
    return '💵2<br>20%: replace neighboring empty tile with 🎵';
  }
}

class Diamond extends Symbol {
  constructor() {
    super('💎');
  }
  async score(x, y) {
    await game.inventory.addMoney(3);
    const coords = nextToCoords(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        game.inventory.addMoney(5),
      ]);
    }
  }
  description() {
    return '💵3<br>💵5 for each neighboring 💎';
  }
}

class Rock extends Symbol {
  constructor() {
    super('🪨');
  }
  async score(x, y) {
    await Promise.all([
      animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(3)]);
  }
  description() {
    return '💵3';
  }
}

class Volcano extends Symbol {
  constructor() {
    super('🌋');
  }
  async evaluate(x, y) {
    if (chance(0.1, x, y)) {
      const rock = new Rock();
      const newX = random(BOARD_SIZE);
      const newY = random(BOARD_SIZE);
      game.inventory.remove(game.board.cells[newY][newX]);
      game.board.cells[newY][newX] = rock;
      game.inventory.add(rock);
      await animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
      await game.board.spinDivOnce(newX, newY);
    }
    return [];
  }
  description() {
    return '10%: replace random tile with 🪨'
  }
}

class Inventory {
  constructor(symbols) {
    this.symbols = symbols;
    this.symbolsDiv = document.querySelector('.inventory');
    this.money = 10;
  }
  update(game) {
    this.symbolsDiv.replaceChildren();
    const map = new Map();
    map.set(Dollar.instance().name, game.inventory.money);
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
  async addMoney(value) {
    this.money += value;
    this.update(game);
  }
}

class Shop {
  constructor() {
    this.shopDiv = document.querySelector('.shop');
    this.catalog = [
      new Coin(),
      new Cherry(), new Bell(), new Diamond(), 
      new Volcano(),
      new Egg(), new Chicken(), 
      new MusicalNote(), 
      new Clover(), new CrystalBall(), new BullsEye()
    ];
    this.isOpen = false;
  }
  async open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.shopDiv.replaceChildren();
    const newCatalog = [...this.catalog];
    for (let i = 0; i < 3; ++i) {
      const symbol = randomRemove(newCatalog);
      const shopItemDiv = document.createElement('div');
      shopItemDiv.classList.add('shopItem');
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('cell');
      symbolDiv.innerText = symbol.name;
      shopItemDiv.appendChild(symbolDiv);
      const descriptionDiv = document.createElement('div');
      descriptionDiv.classList.add('description');
      descriptionDiv.innerHTML = symbol.description();
      shopItemDiv.appendChild(descriptionDiv);
      const buyDiv = document.createElement('div');
      buyDiv.classList.add('buy');
      const buyButton = document.createElement('button');
      buyButton.classList.add('buyButton');
      buyButton.innerText = '✅';
      buyButton.addEventListener('click', async () => {
        game.inventory.add(symbol);
        game.inventory.update(game);
        await game.shop.close();
      });
      buyDiv.appendChild(buyButton);
      shopItemDiv.appendChild(buyDiv);
      this.shopDiv.appendChild(shopItemDiv);
    }
    await animate(this.shopDiv, 'openShop', 0.4);
  }
  async close() {
    if (!this.isOpen) {
      return;
    }
    await animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv
    this.shopDiv.replaceChildren();
    this.isOpen = false;
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
      // set.add(Empty.instance().name);
      for (const symbol of Object.values(game.inventory.symbols)) {
        set.add(symbol.name);
      }
      div.innerText = randomChoose([...set]);
    }
    await animate(div, 'startSpin', 0.1);
    for (let i = 0; i < 6; ++i) {
      randomSymbol();
      await animate(div, 'spin', 0.12 + i * 0.02);
    }
    div.innerText = symbol.name;
    await animate(div, 'endSpin', 0.3);
    await animate(div, 'bounce', 0.1);
  }
  async spinDivOnce(x, y) {
    const div = this.getSymbolDiv(x, y);
    await animate(div, 'startSpin', 0.1);
    div.innerText = this.cells[y][x].name;
    await animate(div, 'endSpin', 0.3);
    await animate(div, 'bounce', 0.1);
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
  async evaluate() {
    const sideEffects = [];
    const tasks = [];
    this.forAllCells((cell, x, y) => tasks.push(cell.evaluate(x, y)));
    for (const task of tasks) {
      await task;
    }
  }
  async score() {
    let total = 0;
    const tasks = [];
    this.forAllCells((cell, x, y) => {
      tasks.push(async () => {
        const cellScore = await cell.score(x, y);
        total += cellScore;
      });
    })
    for (const task of tasks) {
      await task();
    }
    return total;
  }
  forAllCells(f) {
    this.cells.forEach((row, y) => {
      row.forEach((cell, x) => {
        f(cell, x, y);
      });
    });
  }
}

class Game {
  constructor() {
    this.inventory = new Inventory([
      new Coin(), new Cherry(), new Cherry(), new Cherry(),
    ]);
    this.inventory.update(this);
    this.board = new Board();
    this.shop = new Shop();
    this.rolling = false;
  }
  async roll() {
    if (this.rolling) {
      return;
    }
    this.rolling = true;
    if (this.inventory.money > 0) {
      this.inventory.addMoney(-1);
      await this.shop.close();
      await this.board.roll(this.inventory);
      this.board.evaluate();
      await this.board.score();
      await this.shop.open(this);
    }
    this.rolling = false;
  }
}

const game = new Game();

document.getElementById('roll')
  .addEventListener('click', () => game.roll());

