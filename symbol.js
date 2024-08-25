import * as Util from './util.js'

const luckyChance = (game, chance, x, y) => {
  const check = (name, percent) => {
    let total = 0;
    game.board.forAllCells((cell, x, y) => {
      if (cell.name === name) {
        total += percent;
      }
    });
    if (Util.nextToCoords(
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
  }
  toString() {
    return this.name;
  }
  async evaluate() {}
  async score(game, x, y) {}
  description() {
    throw new Error('What the hell?');
  }
}

export class Empty extends Symbol {
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
export class Dollar extends Symbol {
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

export class Coin extends Symbol {
  constructor() {
    super('🪙');
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  description() {
    return '💵1';
  }
}

export class Clover extends Symbol {
  constructor() {
    super('🍀');
  }
  description() {
    return '+1% luck';
  }
}

export class CrystalBall extends Symbol {
  constructor() {
    super('🔮');
  }
  description() {
    return '+5% luck';
  }
}

export class BullsEye extends Symbol {
  constructor() {
    super('🎯');
  }
  description() {
    return 'neighboring roll always succeeds';
  }
}

export class Egg extends Symbol {
  constructor() {
    super('🥚');
    this.timeToHatch = 3 + Util.random(3);
  }
  async evaluate(game, x, y) {
    this.timeToHatch--;
    if (this.timeToHatch === 0) {
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

export class Chick extends Symbol {
  constructor() {
    super('🐣');
    this.timeToGrow = 3;
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  async evaluate(game, x, y) {
    this.timeToGrow--;
    if (this.timeToGrow === 0) {
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
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(3)]);
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = Util.nextToCoords(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const eggCount = 1 + Util.random(3);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = Util.randomRemove(coords);
        const egg = new Egg();
        game.board.cells[newY][newX] = egg;
        game.inventory.add(egg);
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
        await game.board.spinDivOnce(newX, newY);
      }
    }
  }
  description() {
    return '💵3<br>10%: lay up to 3 🥚'
  }
}

export class Dragon extends Symbol {
  constructor() {
    super('🐉');
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(33)]);
  }
  description() {
    return '💵33';
  }
}

export class Fox extends Symbol {
  constructor() {
    super('🦊');
  }
  async evaluate(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = Util.nextToCoords(game.board.cells, x, y, new neighborClass().name);
      if (coords.length === 0) {
        return;
      }
      const empty = Empty.instance();
      for (const coord of coords) {
        this.eatenScore += 10;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.cells[deleteY][deleteX] = empty;
        await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 3);
        await game.board.spinDivOnce(deleteX, deleteY);
      }
    };
    await eatNeighbor(Chick, 5);
    await eatNeighbor(Chicken, 10);
  }
  async score(game, x, y) {
    if (this.eatenScore > 0) {
      this.eatenScore = 0;
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        game.inventory.addMoney(this.eatenScore)]);
    }
  }
  description() {
    return 'eats neighboring 🐔 for 💵10<br>eats neighboring 🐣 for 💵5'
  }
}

export class Cherry extends Symbol {
  constructor() {
    super('🍒');
  }
  async score(game, x, y) {
    const coords = Util.nextToCoords(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        game.inventory.addMoney(2),
      ]);
    }
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
}

export class Diamond extends Symbol {
  constructor() {
    super('💎');
  }
  async score(game, x, y) {
    await game.inventory.addMoney(3);
    const coords = Util.nextToCoords(game.board.cells, x, y, this.name);
    const animSpeed = Math.max(0.02, 0.15 - 0.01 * coords.length);
    for (const coord of coords) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', animSpeed),
        game.inventory.addMoney(5),
      ]);
    }
  }
  description() {
    return '💵3<br>💵5 for each neighboring 💎';
  }
}

export class Bell extends Symbol {
  constructor() {
    super('🔔');
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(2)]);
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const coords = Util.nextToCoords(game.board.cells, x, y, Empty.instance().name);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      game.board.cells[newY][newX] = note;
      game.inventory.add(note);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '💵2<br>20%: replace neighboring empty tile with 🎵';
  }
}

export class MusicalNote extends Symbol {
  constructor() {
    super('🎵');
    this.timeToLive = 3;
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(1)]);
  }
  async evaluate(game, x, y) {
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

export class Volcano extends Symbol {
  constructor() {
    super('🌋');
  }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const rock = new Rock();
      const newX = Util.random(Util.BOARD_SIZE);
      const newY = Util.random(Util.BOARD_SIZE);
      game.inventory.remove(game.board.cells[newY][newX]);
      game.board.cells[newY][newX] = rock;
      game.inventory.add(rock);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 3);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '10%: replace random tile with 🪨'
  }
}

export class Rock extends Symbol {
  constructor() {
    super('🪨');
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(3)]);
  }
  description() {
    return '💵3';
  }
}

export class Worker extends Symbol {
  constructor() {
    super('👷');
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      game.inventory.addMoney(3)]);
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToCoords(game.board.cells, x, y, new Rock().name);
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
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 3);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return '💵3<br>destroy neighboring 🪨 for 💵3, 10%: 💎'
  }
}
