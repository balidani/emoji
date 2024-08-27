import * as Util from './util.js'

const luckyChance = (game, chance, x, y) => {
  const check = (name, percent) => {
    let total = 0;
    game.board.forAllCells((cell, x, y) => {
      if (cell.name === name) {
        total += percent;
      }
    });
    if (Util.nextToSymbol(
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
const chance = (game, percent, x, y) => 
  Math.random() < luckyChance(game, percent, x, y);

export class Symbol {
  constructor(name) {
    this.name = name;
    this.multiplier = 1;
    this.rarity = 0;
  }
  copy() {
    throw new Error('Trying to get copy of base class.');
  }
  toString() {
    return this.name;
  }
  async evaluate() {}
  async score(game, x, y) {}
  description() {
    throw new Error('Trying to get description of base class.');
  }
  async addMoney(game, score) {
    await game.inventory.addMoney(score * this.multiplier);
    this.multiplier = 1;
  }
}

export class Empty extends Symbol {
  static empty = null;
  constructor() {
    super('⬜');
  }
  copy() {
    throw new Error('Trying to get copy of Empty.');
  }
  static instance() {
    if (!Empty.empty) {
      Empty.empty = new Empty();
    }
    return Empty.empty;
  }
}

export class Dollar {
  static name = '💵';
}

/* Gameplay symbols. */

export class Bank extends Symbol {
  constructor() {
    super('🏦');
    this.turn = 0;
    this.rarity = 0.5;
  }
  copy() { return new Bank(); }
  async score(game, x, y) {
    this.turn += 1;
    if (this.turn % 3 === 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, 30)]);
    } else {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, -10)]);
    }
  }
  description() {
    return '-💵10<br>every third turn: 💵30 instead';
  }
}

export class Bell extends Symbol {
  constructor() {
    super('🔔');
    this.rarity = 0.4;
  }
  copy() { return new Bell(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      game.board.cells[newY][newX] = note;
      game.inventory.add(note);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '💵1<br>20%: make 🎵';
  }
}

export class Bomb extends Symbol {
  constructor() {
    super('💣');
    this.rarity = 0.2;
  }
  copy() { return new Bomb(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToCoords(game.board.cells, x, y);
    const empty = Empty.instance();
    const filteredCoords = coords.filter((coord) => {
      const [x, y] = coord;
      return game.board.cells[y][x].name !== empty.name;
    });
    if (filteredCoords.length === 0) {
      return;
    }
    const coord = Util.randomChoose(filteredCoords);
    const [deleteX, deleteY] = coord;
    game.inventory.remove(game.board.cells[deleteY][deleteX]);
    game.board.cells[deleteY][deleteX] = empty;
    await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
    await game.board.spinDivOnce(deleteX, deleteY);
  }
  description() {
    return 'destroy random neighboring symbol';
  }
}

export class BullsEye extends Symbol {
  constructor() {
    super('🎯');
    this.rarity = 0.05;
  }
  copy() { return new BullsEye(); }
  description() {
    return 'neighboring roll always succeeds';
  }
}

export class Cherry extends Symbol {
  constructor() {
    super('🍒');
    this.rarity = 1;
  }
  copy() { return new Cherry(); }
  async score(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        this.addMoney(game, 2)]);
    }
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
}

export class Chick extends Symbol {
  constructor(timeToGrow = 3) {
    super('🐣');
    this.rarity = 0.3;
    this.timeToGrow = timeToGrow;
  }
  copy() { return new Chick(this.timeToGrow); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  async evaluate(game, x, y) {
    this.timeToGrow--;
    if (this.timeToGrow <= 0) {
      game.inventory.remove(this);
      const chicken = new Chicken();
      game.inventory.add(chicken);
      game.board.cells[y][x] = chicken;
      await game.board.spinDivOnce(x, y);
    }
  }
  description() {
    return '💵1<br>after 3 turns: become 🐔'
  }
}

export class Chicken extends Symbol {
  constructor() {
    super('🐔');
    this.rarity = 0.15;
  }
  copy() { return new Chicken(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 3)]);
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const eggCount = 1 + Util.random(3);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = Util.randomRemove(coords);
        const egg = new Egg();
        game.board.cells[newY][newX] = egg;
        game.inventory.add(egg);
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
        await game.board.spinDivOnce(newX, newY);
      }
    }
  }
  description() {
    return '💵3<br>10%: lay up to 3 🥚'
  }
}

export class Clover extends Symbol {
  constructor() {
    super('🍀');
    this.rarity = 0.3;
  }
  copy() { return new Clover(); }
  description() {
    return '+1% luck';
  }
}

export class Coin extends Symbol {
  constructor() {
    super('🪙');
    this.rarity = 1;
  }
  copy() { return new Coin(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  description() {
    return '💵1';
  }
}

export class Corn extends Symbol {
  constructor() {
    super('🌽');
    this.rarity = 0.2;
  }
  copy() { return new Corn(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      for (let i = 0; i < coords.length; ++i) {
        const [newX, newY] = coords[i];
        const popcorn = new Popcorn();
        game.board.cells[newY][newX] = popcorn;
        game.inventory.add(popcorn);
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
        await game.board.spinDivOnce(newX, newY);
      }
    }
  }
  description() {
    return '💵1<br>10%: pop 🍿'
  }
}

export class CreditCard extends Symbol {
  constructor(turn=0) {
    super('💳');
    this.turn = turn;
    this.rarity = 0.3;
  }
  copy() { return new CreditCard(this.turn); }
  async score(game, x, y) {
    this.turn += 1;
    if (this.turn === 1) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, 100)]);
    } else {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, -5)]);
    }
  }
  description() {
    return '💵100 on turn 1, -💵5 after'
  }
}

export class CrystalBall extends Symbol {
  constructor() {
    super('🔮');
    this.rarity = 0.1;
  }
  copy() { return new CrystalBall(); }
  description() {
    return '+5% luck';
  }
}

export class Dancer extends Symbol {
  constructor() {
    super('💃');
    this.rarity = 0.3;
    this.musicScore = 0;
  }
  copy() { return new Dancer(); }
  async score(game, x, y) {
    if (this.musicScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.musicScore)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, new MusicalNote().name);
    if (coords.length === 0) {
      return;
    }
    const empty = Empty.instance();
    for (const coord of coords) {
      this.musicScore += 10;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = empty;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'remove neighboring 🎵 for 💵10';
  }
}

export class Diamond extends Symbol {
  constructor() {
    super('💎');
    this.rarity = 0.3;
  }
  copy() { return new Diamond(); }
  async score(game, x, y) {
    await this.addMoney(game, 3);
    const coords = Util.nextToSymbol(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        this.addMoney(game, 5),
      ]);
    }
  }
  description() {
    return '💵3<br>💵5 for each neighboring 💎';
  }
}

export class Dragon extends Symbol {
  constructor() {
    super('🐉');
    this.rarity = 0.01;
  }
  copy() { return new Dragon(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 12)]);
  }
  description() {
    return '💵12';
  }
}

export class Drums extends Symbol {
  constructor() {
    super('🥁');
    this.rarity = 0.2;
  }
  copy() { return new Drums(); }
  async evaluate(game, x, y) {
    if (game.turns % 3  == 0) {
      const note = new MusicalNote();
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      game.board.cells[newY][newX] = note;
      game.inventory.add(note);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1, 3);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return 'every 3 turns: make 🎵';
  }
}

export class Egg extends Symbol {
  constructor(timeToHatch=3 + Util.random(3)) {
    super('🥚');
    this.rarity = 0.5;
    this.timeToHatch = timeToHatch;
  }
  copy() { return new Egg(this.timeToHatch); }
  async evaluate(game, x, y) {
    this.timeToHatch--;
    if (this.timeToHatch <= 0) {
      game.inventory.remove(this);
      let newSymbol = new Chick();
      if (chance(game, 0.01, x, y)) {
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

export class Fox extends Symbol {
  constructor() {
    super('🦊');
    this.rarity = 0.2;
    this.eatenScore = 3;
  }
  copy() { return new Fox(); }
  async evaluate(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = Util.nextToSymbol(game.board.cells, x, y, new neighborClass().name);
      if (coords.length === 0) {
        return;
      }
      const empty = Empty.instance();
      for (const coord of coords) {
        this.eatenScore += 10;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.cells[deleteY][deleteX] = empty;
        await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
        await game.board.spinDivOnce(deleteX, deleteY);
      }
    };
    await eatNeighbor(Chick, 5);
    await eatNeighbor(Chicken, 10);
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, this.eatenScore)]);      
    this.eatenScore = 3;
  }
  description() {
    return '💵3<br>eats neighboring 🐔 for 💵10<br>eats neighboring 🐣 for 💵5'
  }
}

export class MagicWand extends Symbol {
  constructor() {
    super('🪄');
  }
  copy() { return new MagicWand(); }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const emptyCoords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (emptyCoords.length === 0) {
        return;
      }
      const nonEmptyCoords = Util.nextToExpr(game.board.cells, x, y, (name) => name !== Empty.instance().name);
      if (nonEmptyCoords.length === 0) {
        return;
      }
      const [copyX, copyY] = Util.randomChoose(nonEmptyCoords);
      const [newX, newY] = Util.randomChoose(emptyCoords);
      const newSymbol = game.board.cells[copyY][copyX].copy();
      game.board.cells[newY][newX] = newSymbol;
      game.inventory.add(newSymbol);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }  
  description() {
    return '10%: duplicate neighboring symbol';
  }
}

export class MoneyBag extends Symbol {
  constructor(coins=0) {
    super('💰');
    this.coins = coins;
    this.rarity = 0.4;
  }
  copy() { return new MoneyBag(this.coins); }
  async score(game, x, y) {
    if (this.coins > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.coins)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, new Coin().name);
    if (coords.length === 0) {
      return;
    }
    const empty = Empty.instance();
    for (const coord of coords) {
      this.coins += 1;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = empty;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return '💵1 for each 🪙 bagged<br>bag neighboring 🪙'
  }
}

export class Multiplier extends Symbol {
  constructor() {
    super('❎');
    this.rarity = 0.05;
  }
  copy() { return new Multiplier(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToCoords(game.board.cells, x, y);
    const empty = Empty.instance();
    const filteredCoords = coords.filter((coord) => {
      const [neighborX, neighborY] = coord;
      return game.board.cells[neighborY][neighborX].name !== empty.name;
    });
    if (filteredCoords.length === 0) {
      return;
    }
    for (const coord of filteredCoords) {
      const [neighborX, neighborY] = coord;
      await Util.animate(game.board.getSymbolDiv(neighborX, neighborY), 'shake', 0.1, 2);
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  description() {
    return 'x2 to all neighbors';
  }
}

export class MusicalNote extends Symbol {
  constructor(timeToLive=3) {
    super('🎵');
    this.timeToLive = timeToLive;
  }
  copy() { return new MusicalNote(this.timeToLive); }
  async evaluate(game, x, y) {
    if (this.timeToLive === 0) {
      game.inventory.remove(this);
      game.board.cells[y][x] = Empty.instance();
      await game.board.spinDivOnce(x, y);
    }
    this.timeToLive--;
  }
  description() {
    return 'disappear after 3 turns';
  }
}

export class Popcorn extends Symbol {
  constructor(timeToLive=1 + Util.random(3)) {
    super('🍿');
    this.rarity = 0.1;
    this.timeToLive = timeToLive;
  }
  copy() { return new Popcorn(this.timeToLive); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 3)]);
  }
  async evaluate(game, x, y) {
    if (this.timeToLive === 0) {
      game.inventory.remove(this);
      game.board.cells[y][x] = Empty.instance();
      await game.board.spinDivOnce(x, y);
    }
    this.timeToLive--;
  }
  description() {
    return '💵3<br>disappear after 1-3 turns'
  }
}

export class Record extends Symbol {
  constructor(notes=0) {
    super('📀');
    this.rarity = 0.1;
    this.notes = notes;
  }
  copy() { return new Record(this.notes); }
  async score(game, x, y) {
    if (this.notes > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.notes)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, new MusicalNote().name);
    if (coords.length === 0) {
      return;
    }
    const empty = Empty.instance();
    for (const coord of coords) {
      this.notes += 3;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = empty;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'record neighboring 🎵<br>💵3 for each 🎵 recorded';
  }
}

export class Refresh extends Symbol {
  constructor() {
    super('🔀');
    this.rarity = 0.05;
  }
  copy() { return new Refresh(); }
  async evaluate(game, x, y) {
    await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.1, 2);
    game.shop.refreshable = true;
    game.shop.refreshCost = 1 + (game.inventory.money * 0.01) | 0;
  }
  description() {
    return 'allows refreshing in the shop';
  }
}

export class Rock extends Symbol {
  constructor() {
    super('🪨');
    this.rarity = 0.7;
  }
  copy() { return new Rock(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  description() {
    return '💵1';
  }
}

export class Tree extends Symbol {
  constructor() {
    super('🌳');
    this.rarity = 0.4;
    this.turns = 0;
  }
  copy() { return new Tree(); }
  async evaluate(game, x, y) {
    this.turns++;
    if (this.turns % 3 === 0) {
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomRemove(coords);
      const cherry = new Cherry();
      game.board.cells[newY][newX] = cherry;
      game.inventory.add(cherry);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return 'every 3 turns: grow 🍒';
  }
}

export class Volcano extends Symbol {
  constructor() {
    super('🌋');
    this.rarity = 0.5;
  }
  copy() { return new Volcano(); }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const rock = new Rock();
      const newX = Util.random(Util.BOARD_SIZE);
      const newY = Util.random(Util.BOARD_SIZE);
      game.inventory.remove(game.board.cells[newY][newX]);
      game.board.cells[newY][newX] = rock;
      game.inventory.add(rock);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '10%: replace random tile with 🪨'
  }
}

export class Wine extends Symbol {
  constructor() {
    super('🍷');
    this.rarity = 0.2;
    this.cherryScore = 0;
  }
  copy() { return new Wine(); }
  async score(game, x, y) {
    if (this.cherryScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.cherryScore)]);
    }
    this.cherryScore = 0;
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, new Cherry().name);
    if (coords.length === 0) {
      return;
    }
    const empty = Empty.instance();
    for (const coord of coords) {
      this.cherryScore += 5;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = empty;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'remove neighboring 🍒 for 💵5'
  }
}

export class Worker extends Symbol {
  constructor() {
    super('👷');
    this.rarity = 0.5;
  }
  copy() { return new Worker(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, new Rock().name);
    if (coords.length === 0) {
      return;
    }
    const empty = Empty.instance();
    for (const coord of coords) {
      await game.inventory.addMoney(3);
      let newSymbol = empty;
      if (chance(game, 0.1, x, y)) {
        newSymbol = new Diamond();
      }
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      if (newSymbol.name !== Empty.instance().name) {
        game.inventory.add(newSymbol);
      }
      game.board.cells[deleteY][deleteX] = newSymbol;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'destroy neighboring 🪨 for 💵3, 10%: 💎'
  }
}
