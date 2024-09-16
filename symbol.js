import * as Util from './util.js'

const luckyChance = (game, chance, x, y) => {
  if (Util.nextToSymbol(
    game.board.cells, x, y, BullsEye.name).length > 0) {
    return 1.0;
  }
  const check = (name, percent) => {
    let total = 0;
    game.board.forAllCells((cell, x, y) => {
      if (cell.name() === name) {
        total += percent;
      }
    });
    return total;
  };
  let total = 0;
  total += check(Clover.name, 0.01);
  total += check(CrystalBall.name, 0.03);
  return chance + total;
}
const chance = (game, percent, x, y) => 
  Math.random() < luckyChance(game, percent, x, y);

const nextToEmpty = (cells, x, y) => {
  return Util.nextToExpr(cells, x, y, (sym) => [Empty.name, Hole.name].includes(sym.name()));
};
const addToBoard = async (game, sym, x, y) => {
  if (sym.name() === Hole.name 
    && game.board.cells[y][x].name() === Hole.name) {
    // Putting a hole in a hole
    // sym = new BlackHole();
  }
  game.inventory.add(sym);
  if (game.board.cells[y][x].name() === Hole.name) {
    const hole = game.board.cells[y][x];
    game.board.cells[y][x] = sym;
    await game.board.spinDivOnce(game, x, y);
    game.board.cells[y][x] = hole;
    await game.board.spinDivOnce(game, x, y);
  } else {
    game.board.cells[y][x] = sym;
    await game.board.spinDivOnce(game, x, y);
  }
  game.board.updateCounter(game, x, y);
}

export class Symbol {
  constructor() {
    this.multiplier = 1;
    this.rarity = 0;
    this.turns = 0;
  }
  copy() {
    throw new Error('Trying to get copy of base class.');
  }
  async evaluate() {}
  async finalScore(game, x, y) {}
  async score(game, x, y) {}
  description() {
    throw new Error('Trying to get description of base class.');
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    game.board.showMoneyEarned(x, y, value);
    await game.inventory.addMoney(score * this.multiplier);
  }
  name() { 
    return this.constructor.name;
  }
  reset() {
    this.multiplier = 1;
  }
  counter(game) {
    return null;
  }
}

export class Empty extends Symbol {
  static name = '⬜';
  constructor() {
    super();
  }
  copy() {
    throw new Error('Trying to get copy of Empty.');
  }
}

/* Gameplay symbols. */

export class Balloon extends Symbol {
  static name = '🎈';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new Balloon(); }
  async evaluate(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y)]);
    if (chance(game, 0.5, x, y)) {
      game.inventory.remove(this);
      game.board.clearCell(x, y);
      await game.board.spinDivOnce(game, x, y);
    }
  }
  description() {
    return '💵20<br>50% chance: pop';
  }
}

export class Bank extends Symbol {
  static name = '🏦';
  constructor() {
    super();
    this.turns = 0;
    this.rarity = 0.4;
  }
  copy() { return new Bank(); }
  async evaluate(game, x, y) {
    this.turns++;
    const mint = async () => {
      const coords = nextToEmpty(game.board.cells, x, y);
      if (coords.length === 0) {
        return;
      }
      const coin = new Coin();
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
      await addToBoard(game, coin, newX, newY);
    };
    if (this.turns % 4 === 0) {
      await mint(); await mint(); await mint(); 
      game.board.updateCounter(game, x, y);
    }
    
  }
  counter(game) {
    return 4 - this.turns % 4;
  }
  description() {
    return 'every 4 turns: mint 🪙🪙🪙';
  }
}

export class Bell extends Symbol {
  static name = '🔔';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Bell(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y)]);
  }
  async evaluate(game, x, y) {
    const coords = nextToEmpty(game.board.cells, x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await addToBoard(game, note, newX, newY);
    }
  }
  description() {
    return '💵1<br>20% chance: make 🎵';
  }
}

export class Bomb extends Symbol {
  static name = '💣';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Bomb(); }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = Util.nextToExpr(game.board.cells, x, y,
        (sym) => ![Empty.name, Firefighter.name].includes(sym.name()));
      if (coords.length === 0) {
        return;
      }
      const coord = Util.randomChoose(coords);
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.15, 2);
      game.board.clearCell(deleteX, deleteY);
      await game.board.spinDivOnce(game, deleteX, deleteY);
    }
  }
  description() {
    return '10% chance: destroy a neighbor';
  }
}

export class Briefcase extends Symbol {
  static name = '💼';
  constructor() {
    super();
    this.rarity = 0.13;
    this.count = 0;
  }
  copy() { return new Briefcase(); }
  async score(game, x, y) {
    const value = this.counter(game);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value, x, y)]);
  }
  counter(game) {
    return (game.inventory.symbols.length / 3 | 0) * 4;
  }
  description() {
    return '💵4 for every 3 symbols in inventory';
  }
}

export class Bug extends Symbol {
  static name = '🐛';
  constructor() {
    super();
    this.rarity = 0.3;
    this.foodScore = 0;
    this.timeToLive = 5;
  }
  copy() { return new Bug(); }
  async score(game, x, y) {
    if (this.foodScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.foodScore, x, y)]);
    }
    this.foodScore = 0;
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y, 
      (sym) => Food.includes(sym.name()));
    if (coords.length === 0) {
      this.timeToLive--;
      game.board.updateCounter(game, x, y);
      if (this.timeToLive <= 0) {
        game.inventory.remove(this);
        game.board.clearCell(x, y);
        await game.board.spinDivOnce(game, x, y);
      }
    } else {
      this.timeToLive = 5;
      game.board.updateCounter(game, x, y);
      for (const coord of coords) {
        this.foodScore += 5;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.clearCell(deleteX, deleteY);
        await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.15);
        await game.board.spinDivOnce(game, deleteX, deleteY);
      }
    }
  }
  counter(game) {
    return this.timeToLive - 1;
  }
  description() {
    return 'eat all food for 💵5<br>leave after 5 turns with no food';
  }
}

export class BullsEye extends Symbol {
  static name = '🎯';
  constructor() {
    super();
    this.rarity = 0.045;
  }
  copy() { return new BullsEye(); }
  description() {
    return 'neighboring rolls always succeed';
  }
}

export class Cherry extends Symbol {
  static name = '🍒';
  constructor() {
    super();
    this.rarity = 0.8;
  }
  copy() { return new Cherry(); }
  async score(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Cherry.name);
    if (coords.length === 0) {
      return;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, coords.length * 2, x, y)]);
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
}

export class Chick extends Symbol {
  static name = '🐣';
  constructor(timeToGrow = 3) {
    super();
    this.rarity = 0.2;
    this.turns = 0;
  }
  copy() { return new Chick(this.timeToGrow); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y)]);
  }
  async evaluate(game, x, y) {
    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns >= 3) {
      game.inventory.remove(this);
      const chicken = new Chicken();
      game.inventory.add(chicken);
      game.board.cells[y][x] = chicken;
      await game.board.spinDivOnce(game, x, y);
    }
  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return '💵1<br>after 3 turns: become 🐔';
  }
}

export class Chicken extends Symbol {
  static name = '🐔';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Chicken(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 3, x, y)]);
  }
  async evaluate(game, x, y) {
    const coords = nextToEmpty(game.board.cells, x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const eggCount = 1 + Util.random(3);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = Util.randomRemove(coords);
        const egg = new Egg();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
        await addToBoard(game, egg, newX, newY);
      }
    }
  }
  description() {
    return '💵3<br>10% chance: lay up to 3 🥚';
  }
}

export class Clover extends Symbol {
  static name = '🍀';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() { return new Clover(); }
  description() {
    return '+1% luck';
  }
}

export class Cocktail extends Symbol {
  static name = '🍹';
  constructor(cherryScore = 0) {
    super();
    this.rarity = 0.27;
    this.cherryScore = cherryScore;
  }
  copy() { return new Cocktail(this.cherryScore); }
  async score(game, x, y) {
    if (this.cherryScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.cherryScore, x, y)]);
    }
  }
  async evaluate(game, x, y) {
    const remove = async (sym, reward) => {
      const coords = Util.nextToSymbol(game.board.cells, x, y, sym.name);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.cherryScore += reward;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.clearCell(deleteX, deleteY);
        await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15);
        await game.board.spinDivOnce(game, deleteX, deleteY);
        game.board.updateCounter(game, x, y);
      }
    }
    await remove(Cherry, 2);
    await remove(Pineapple, 4);
    await remove(Mango, 8);
  }
  counter(game) {
    return this.cherryScore;
  }
  description() {
    return '💵2 per 🍒 removed<br>💵4 per 🍍 removed<br>💵8 per 🥭 removed';
  }
}

export class Coin extends Symbol {
  static name = '🪙';
  constructor() {
    super();
    this.rarity = 1;
  }
  copy() { return new Coin(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 2, x, y)]);
  }
  description() {
    return '💵2';
  }
}

export class Corn extends Symbol {
  static name = '🌽';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() { return new Corn(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 2, x, y)]);
  }
  async evaluate(game, x, y) {
    const coords = nextToEmpty(game.board.cells, x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      for (let i = 0; i < coords.length; ++i) {
        const [newX, newY] = coords[i];
        const popcorn = new Popcorn();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
        await addToBoard(game, popcorn, newX, newY);
      }
    }
  }
  description() {
    return '💵2<br>10% chance: pop 🍿';
  }
}

export class CreditCard extends Symbol {
  static name = '💳';
  constructor(turn=0) {
    super();
    this.turn = turn;
    this.rarity = 0.35;
  }
  copy() { return new CreditCard(); }
  async finalScore(game, x, y) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15, 3),
        this.addMoney(game, -1100, x, y)]);
  }
  async score(game, x, y) {
    this.turn += 1;
    if (this.turn === 1) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, 1000, x, y)]);
    } else {
      // await Promise.all([
      //   Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      //   this.addMoney(game, -5)]);
    }
  }
  description() {
    return '💵1000 now<br>💵-1100 on last turn';
  }
}

export class CrystalBall extends Symbol {
  static name = '🔮';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() { return new CrystalBall(); }
  description() {
    return '+3% luck';
  }
}

export class Dancer extends Symbol {
  static name = '💃';
  constructor() {
    super();
    this.rarity = 0.3;
    this.musicScore = 0;
  }
  copy() { return new Dancer(); }
  async score(game, x, y) {
    if (this.musicScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.musicScore, x, y)]);
      this.musicScore = 0;
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, MusicalNote.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.musicScore += 10;
    }
  }
  description() {
    return '💵10 for each neighboring 🎵';
  }
}

export class Diamond extends Symbol {
  static name = '💎';
  constructor() {
    super();
    this.rarity = 0.35;
  }
  copy() { return new Diamond(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y)]);
    const coords = Util.nextToSymbol(game.board.cells, x, y, Diamond.name);
    if (coords.length === 0) {
      return;
    }
    this.addMoney(game, coords.length * 4, x, y);
  }
  description() {
    return '💵4<br>💵4 for each neighboring 💎';
  }
}

export class Dice extends Symbol {
  static name = '🎲';
  constructor() {
    super();
    this.rarity = 0.14;
  }
  copy() { return new Dice(); }
  async score(game, x, y) {
    if (chance(game, 0.01, x, y)) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2),
        this.addMoney(game, 52, x, y)]);
    }
  }
  description() {
    return '1% chance: 💵52';
  }
}

export class Dragon extends Symbol {
  static name = '🐉';
  constructor() {
    super();
    this.rarity = 0.01;
  }
  copy() { return new Dragon(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 24, x, y)]);
  }
  description() {
    return '💵24';
  }
}

export class Drums extends Symbol {
  static name = '🥁';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() { return new Drums(); }
  async evaluate(game, x, y) {
    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns % 3 === 0) {
      const note = new MusicalNote();
      const coords = nextToEmpty(game.board.cells, x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 3);
      await addToBoard(game, note, newX, newY);
    }
  }
  counter(game) {
    return 3 - this.turns % 3;
  }
  description() {
    return 'every 3 turns: make 🎵';
  }
}

export class Egg extends Symbol {
  static name = '🥚';
  constructor() {
    super();
    this.rarity = 0.6;
    this.timeToHatch = 3 + Util.random(3);
  }
  copy() { return new Egg(); }
  async evaluate(game, x, y) {
    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns >= this.timeToHatch) {
      game.inventory.remove(this);
      let newSymbol = new Chick();
      if (chance(game, 0.01, x, y)) {
        newSymbol = new Dragon();
      }
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 1);
      game.inventory.add(newSymbol);
      game.board.cells[y][x] = newSymbol;
      await game.board.spinDivOnce(game, x, y);
    }
  }
  counter(game) {
    return this.timeToHatch - this.turns;
  }
  description() {
    return 'after 3-5 turns: hatch 🐣<br>1% chance: hatch 🐉'
  }
}

export class Firefighter extends Symbol {
  static name = '🧑‍🚒';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Firefighter(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Bomb.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.clearCell(deleteX, deleteY);
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.15, 2);
      await game.board.spinDivOnce(game, deleteX, deleteY);
    }
    game.inventory.remove(this);
    game.board.clearCell(x, y);
    await game.board.spinDivOnce(game, x, y);
  }
  description() {
    return 'disarm 💣, leave';
  }
}

export class Fox extends Symbol {
  static name = '🦊';
  constructor() {
    super();
    this.rarity = 0.25;
    this.eatenScore = 3;
    this.timeToLive = 5;
  }
  copy() { return new Fox(); }
  async score(game, x, y) {
    if (this.eatenScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.eatenScore, x, y)]);      
      this.eatenScore = 0;
    }
  }
  async evaluate(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = Util.nextToSymbol(game.board.cells, x, y, neighborClass.name);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.eatenScore += reward;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.clearCell(deleteX, deleteY);
        await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.15, 2);
        await game.board.spinDivOnce(game, deleteX, deleteY);
      }
      this.timeToLive = 5;
      game.board.updateCounter(game, x, y);
    };

    this.timeToLive--;
    game.board.updateCounter(game, x, y);
    await eatNeighbor(Chick, 10);
    await eatNeighbor(Chicken, 20);
    if (this.timeToLive <= 0) {
      game.inventory.remove(this);
      game.board.clearCell(x, y);
      await game.board.spinDivOnce(game, x, y);
    }
  }
  counter(game) {
    return this.timeToLive - 1;
  }
  description() {
    return 'eat 🐔 for 💵20<br>eat 🐣 for 💵10<br>leave after 5 turns with no food';
  }
}

export class FreeTurn extends Symbol {
  static name = '🎟️';
  constructor() {
    super();
    this.rarity = 0.03;
  }
  copy() { return new FreeTurn(); }
  async evaluate(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15, 3);
      game.inventory.turns++;
      game.inventory.updateUi();
    }
    game.board.clearCell(x, y);
    game.inventory.remove(this);
    await game.board.spinDivOnce(game, x, y);
  }
  description() {
    return '10% chance: one more ⏰<br>disappear'
  }
}

export class Grave extends Symbol {
  static name = '🪦';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() { return new Grave(); }
  async evaluate(game, x, y) {
    const coords = nextToEmpty(game.board.cells, x, y);
    if (coords.length === 0) {
      return;
    }
    if (game.inventory.graveyard.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const [newX, newY] = Util.randomRemove(coords);
      const oldSymbol = Util.randomRemove(game.inventory.graveyard).copy();
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
      await addToBoard(game, oldSymbol, newX, newY);
    }
  }
  description() {
    return '10% chance: add random symbol removed this game';
  }
}

export class Hole extends Symbol {
  static name = '🕳️';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() { return new Hole(); }
  description() {
    return 'always empty';
  }
}

export class MagicWand extends Symbol {
  static name = '🪄';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new MagicWand(); }
  async evaluate(game, x, y) {
    const emptyCoords = nextToEmpty(game.board.cells, x, y);
    if (emptyCoords.length === 0) {
      return;
    }
    const nonEmptyCoords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => sym.name() !== Empty.name);
    if (nonEmptyCoords.length === 0) {
      return;
    }
    if (chance(game, 0.15, x, y)) {
      const [copyX, copyY] = Util.randomChoose(nonEmptyCoords);
      const [newX, newY] = Util.randomChoose(emptyCoords);
      const newSymbol = game.board.cells[copyY][copyX].copy();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await addToBoard(game, newSymbol, newX, newY);
    }
  }  
  description() {
    return '15% chance: duplicate neighboring symbol';
  }
}

export class Mango extends Symbol {
  static name = '🥭';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() { return new Mango(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => Fruits.includes(sym.name()));
    if (coords.length === 0) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  description() {
    return 'x2 to neighboring fruit';
  }
}

export class MoneyBag extends Symbol {
  static name = '💰';
  constructor(coins=0) {
    super();
    this.coins = coins;
    this.rarity = 0.5;
  }
  copy() { return new MoneyBag(this.coins); }
  async score(game, x, y) {
    if (this.coins > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.coins, x, y)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Coin.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.coins += 2;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.clearCell(deleteX, deleteY);
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15, 2);
      await game.board.spinDivOnce(game, deleteX, deleteY);
      game.board.updateCounter(game, x, y);
    }
  }
  counter(game) {
    return this.coins;
  }
  description() {
    return '💵2 for each 🪙 bagged<br>bag neighboring 🪙'
  }
}

export class Multiplier extends Symbol {
  static name = '❎';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() { return new Multiplier(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => sym.name() !== Empty.name);
    if (coords.length === 0) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  description() {
    return 'x2 to all neighbors';
  }
}

export class MusicalNote extends Symbol {
  static name = '🎵';
  constructor() {
    super();
    this.rarity = 0;
  }
  copy() { return new MusicalNote(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 4, x, y)]);
  }
  async evaluate(game, x, y) {
    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns > 3) {
      game.inventory.remove(this);
      game.board.clearCell(x, y);
      await game.board.spinDivOnce(game, x, y);
    }

  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return '💵4<br>disappear after 3 turns';
  }
}

export class Pineapple extends Symbol {
  static name = '🍍';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Pineapple(); }
  async score(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y, 
      (sym) => sym.name() !== Empty.name);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 12 - coords.length * 2, x, y)]);
  }
  description() {
    return '💵12<br>💵-2 for all non-empty neighbors';
  }
}

export class Popcorn extends Symbol {
  static name = '🍿';
  constructor() {
    super();
    this.rarity = 0;
    this.timeToLive = 1 + Util.random(3);
  }
  copy() { return new Popcorn(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 7, x, y)]);
  }
  async evaluate(game, x, y) {
    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns > this.timeToLive) {
      game.inventory.remove(this);
      game.board.clearCell(x, y);
      await game.board.spinDivOnce(game, x, y);
    }
  }
  counter(game) {
    return this.timeToLive - this.turns;
  }
  description() {
    return '💵7<br>disappear after 1-3 turns'
  }
}

export class Record extends Symbol {
  static name = '📀';
  constructor(notes=0) {
    super();
    this.rarity = 0.12;
    this.notes = notes;
  }
  copy() { return new Record(this.notes); }
  async score(game, x, y) {
    if (this.notes > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.notes, x, y)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, MusicalNote.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.notes += 6;
      game.board.updateCounter(game, x, y);
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.clearCell(deleteX, deleteY);
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15, 2);
      await game.board.spinDivOnce(game, deleteX, deleteY);
    }
  }
  counter(game) {
    return this.notes;
  }
  description() {
    return 'record neighboring 🎵<br>💵6 for each 🎵 recorded';
  }
}

export class Refresh extends Symbol {
  static name = '🔀';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() { return new Refresh(); }
  async evaluate(game, x, y) {
    game.shop.refreshable = true;
    game.shop.refreshCount = 0;
  }
  description() {
    return 'allow infinite refresh';
  }
}

export class Rock extends Symbol {
  static name = '🪨';
  constructor() {
    super();
    this.rarity = 0.7;
  }
  copy() { return new Rock(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y)]);
  }
  description() {
    return '💵1';
  }
}

export class Rocket extends Symbol {
  static name = '🚀';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Rocket(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToCoords(game.board.cells, x, y);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shakeRocket', 0.15, 2);
    for (const cell of coords) {
      cell.turns++;
    }
  }
  description() {
    return 'speeds up neighbors by 1 turn';
  }
}

export class ShoppingBag extends Symbol {
  static name = '🛍️';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() { return new ShoppingBag(); }
  async evaluate(game, x, y) {
    game.shop.buyCount++;
  }
  description() {
    return 'allow picking 1 more item';
  }
}

export class Slots extends Symbol {
  static name ='🎰';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Slots(); }
  async score(game, x, y) {
    const value = new Set(game.inventory.symbols.map(s => s.name())).size;
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value * 3, x, y)]);
  }
  counter(game) {
    return new Set(game.inventory.symbols.map(s => s.name())).size * 3;
  }
  description() {
    return '💵3 per different symbol in inventory';
  }
}

export class Tree extends Symbol {
  static name = '🌳';
  constructor() {
    super();
    this.rarity = 0.4;
    this.turns = 0;
  }
  copy() { return new Tree(); }
  async evaluate(game, x, y) {
    const grow = async () => {
      const coords = nextToEmpty(game.board.cells, x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomRemove(coords);
      const cherry = new Cherry();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await addToBoard(game, cherry, newX, newY);
    };

    this.turns++;
    game.board.updateCounter(game, x, y);
    if (this.turns % 3 === 0) {
      await grow(); await grow();
    }
  }
  counter(game) {
    return 3 - this.turns % 3;
  }
  description() {
    return 'every 3 turns: grow 🍒🍒';
  }
}

export class Volcano extends Symbol {
  static name = '🌋';
  constructor() {
    super();
    this.rarity = 0.4;
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
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.spinDivOnce(game, newX, newY);
    }
  }
  description() {
    return '10% chance: replace random tile with 🪨'
  }
}

export class Worker extends Symbol {
  static name = '👷';
  constructor() {
    super();
    this.rarity = 0.45;
  }
  copy() { return new Worker(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Rock.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      await this.addMoney(game, 3, x, y);
      let newSymbol = new Empty();
      if (chance(game, 0.1, x, y)) {
        newSymbol = new Diamond();
      }
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      if (newSymbol.name() !== Empty.name) {
        game.inventory.add(newSymbol);
      }
      game.board.cells[deleteY][deleteX] = newSymbol;
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.15, 2);
      await game.board.spinDivOnce(game, deleteX, deleteY);
    }
  }
  description() {
    return 'destroy neighboring 🪨 for 💵3<br>10% chance: produce 💎'
  }
}

const Fruits = [Cherry, Mango, Pineapple].map(f => f.name);
const Vegetables = [Corn, Clover].map(f => f.name);
const Food = [...Fruits, ...Vegetables, Popcorn.name];
