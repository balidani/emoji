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
  total += check(Clover.name, 0.02);
  total += check(CrystalBall.name, 0.05);
  return chance + total;
}
const chance = (game, percent, x, y) => 
  Math.random() < luckyChance(game, percent, x, y);

export class Symbol {
  constructor() {
    this.multiplier = 1;
    this.rarity = 0;
  }
  copy() {
    throw new Error('Trying to get copy of base class.');
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
  name() { 
    return this.constructor.name;
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

export class Dollar {
  static name = '💵';
}

/* Gameplay symbols. */

export class Bank extends Symbol {
  static name = '🏦';
  constructor() {
    super();
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
  static name = '🔔';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Bell(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1)]);
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
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
  static name = '💣';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Bomb(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => ![Empty.name, Firefighter.name].includes(sym.name()));
    if (coords.length === 0) {
      return;
    }
    const coord = Util.randomChoose(coords);
    const [deleteX, deleteY] = coord;
    game.inventory.remove(game.board.cells[deleteY][deleteX]);
    game.board.cells[deleteY][deleteX] = new Empty();
    await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
    await game.board.spinDivOnce(deleteX, deleteY);
  }
  description() {
    return 'destroy random neighboring symbol';
  }
}

export class Bug extends Symbol {
  static name = '🐛';
  constructor() {
    super();
    this.rarity = 0.3;
    this.foodScore = 0;
    this.timeToLive = 3;
  }
  copy() { return new Bug(); }
  async score(game, x, y) {
    if (this.foodScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.foodScore)]);
    }
    this.foodScore = 0;
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y, 
      (sym) => [Cherry.name, Corn.name].includes(sym.name()));
    if (coords.length === 0) {
      this.timeToLive--;
      if (this.timeToLive <= 0) {
        game.inventory.remove(this);
        game.board.cells[y][x] = new Empty();
        await game.board.spinDivOnce(x, y);
      }
    } else {
      this.timeToLive = 3;
      for (const coord of coords) {
        this.foodScore += 5;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.cells[deleteY][deleteX] = new Empty();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15);
        await game.board.spinDivOnce(deleteX, deleteY);
      }
    }
  }
  description() {
    return 'eat neighboring fruit and vegetables for 💵5<br>die after 3 turns with no food';
  }
}

export class BullsEye extends Symbol {
  static name = '🎯';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() { return new BullsEye(); }
  description() {
    return 'neighboring roll always succeeds';
  }
}

export class Cherry extends Symbol {
  static name = '🍒';
  constructor() {
    super();
    this.rarity = 1;
  }
  copy() { return new Cherry(); }
  async score(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Cherry.name);
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
  static name = '🐣';
  constructor(timeToGrow = 3) {
    super();
    this.rarity = 0.2;
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
      this.addMoney(game, 3)]);
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
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
    return '💵3<br>10%: lay up to 3 🥚';
  }
}

export class Clover extends Symbol {
  static name = '🍀';
  constructor() {
    super();
    this.rarity = 0.3;
  }
  copy() { return new Clover(); }
  description() {
    return '+2% luck';
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
      this.addMoney(game, 1)]);
  }
  description() {
    return '💵1';
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
      this.addMoney(game, 1)]);
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
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
    return '💵1<br>10%: pop 🍿';
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
    return '💵100 on turn 1, -💵5 after';
  }
}

export class CrystalBall extends Symbol {
  static name = '🔮';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new CrystalBall(); }
  description() {
    return '+5% luck';
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
        this.addMoney(game, this.musicScore)]);
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
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = new Empty();
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'remove neighboring 🎵 for 💵10';
  }
}

export class Diamond extends Symbol {
  static name = '💎';
  constructor() {
    super();
    this.rarity = 0.32;
  }
  copy() { return new Diamond(); }
  async score(game, x, y) {
    await this.addMoney(game, 3);
    const coords = Util.nextToSymbol(game.board.cells, x, y, Diamond.name);
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
  static name = '🐉';
  constructor() {
    super();
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
  static name = '🥁';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() { return new Drums(); }
  async evaluate(game, x, y) {
    if (game.inventory.turns % 3  == 0) {
      const note = new MusicalNote();
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
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
  static name = '🥚';
  constructor(timeToHatch=3 + Util.random(3)) {
    super();
    this.rarity = 0.6;
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
      game.board.cells[deleteY][deleteX] = new Empty();
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
    game.inventory.remove(this);
    game.board.cells[y][x] = new Empty();
    await game.board.spinDivOnce(x, y);
  }
  description() {
    return 'remove 💣, leave';
  }
}

export class Fox extends Symbol {
  static name = '🦊';
  constructor() {
    super();
    this.rarity = 0.25;
    this.eatenScore = 3;
  }
  copy() { return new Fox(); }
  async evaluate(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = Util.nextToSymbol(game.board.cells, x, y, neighborClass.name);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.eatenScore += 10;
        const [deleteX, deleteY] = coord;
        game.inventory.remove(game.board.cells[deleteY][deleteX]);
        game.board.cells[deleteY][deleteX] = new Empty();
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
    return '💵3<br>eats neighboring 🐔 for 💵10<br>eats neighboring 🐣 for 💵5';
  }
}

export class Grave extends Symbol {
  static name = '🪦';
  constructor() {
    super();
    this.rarity = 0.12;
  }
  copy() { return new Grave(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
    if (coords.length === 0) {
      return;
    }
    if (game.inventory.graveyard.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const [newX, newY] = Util.randomRemove(coords);
      const oldSymbol = Util.randomRemove(game.inventory.graveyard).copy();
      game.board.cells[newY][newX] = oldSymbol;
      game.inventory.add(oldSymbol);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '10%: add random symbol removed this game';
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
    const emptyCoords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
    if (emptyCoords.length === 0) {
      return;
    }
    const nonEmptyCoords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => sym.name() !== Empty.name);
    if (nonEmptyCoords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
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

export class Mango extends Symbol {
  static name = '🥭';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() { return new Mango(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => [Cherry.name].includes(sym.name()));
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      await Util.animate(game.board.getSymbolDiv(neighborX, neighborY), 'shake', 0.1, 2);
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
    this.rarity = 0.45;
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
    const coords = Util.nextToSymbol(game.board.cells, x, y, Coin.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.coins += 1;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = new Empty();
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return '💵1 for each 🪙 bagged<br>bag neighboring 🪙'
  }
}

export class Multiplier extends Symbol {
  static name = '❎';
  constructor() {
    super();
    this.rarity = 0.04;
  }
  copy() { return new Multiplier(); }
  async evaluate(game, x, y) {
    const coords = Util.nextToExpr(game.board.cells, x, y,
      (sym) => sym.name() !== Empty.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
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
  static name = '🎵';
  constructor(timeToLive=3) {
    super();
    this.rarity = 0;
    this.timeToLive = timeToLive;
  }
  copy() { return new MusicalNote(this.timeToLive); }
  async evaluate(game, x, y) {
    if (this.timeToLive === 0) {
      game.inventory.remove(this);
      game.board.cells[y][x] = new Empty();
      await game.board.spinDivOnce(x, y);
    }
    this.timeToLive--;
  }
  description() {
    return 'disappear after 3 turns';
  }
}

export class Popcorn extends Symbol {
  static name = '🍿';
  constructor(timeToLive=1 + Util.random(3)) {
    super();
    this.rarity = 0;
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
      game.board.cells[y][x] = new Empty();
      await game.board.spinDivOnce(x, y);
    }
    this.timeToLive--;
  }
  description() {
    return '💵3<br>disappear after 1-3 turns'
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
        this.addMoney(game, this.notes)]);
    }
  }
  async evaluate(game, x, y) {
    const coords = Util.nextToSymbol(game.board.cells, x, y, MusicalNote.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.notes += 3;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = new Empty();
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'record neighboring 🎵<br>💵3 for each 🎵 recorded';
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
    await Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.1, 2);
    game.shop.refreshable = true;
    game.shop.refreshCost = 1 + (game.inventory.money * 0.01) | 0;
  }
  description() {
    return 'allows refreshing in the shop';
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
      this.addMoney(game, 1)]);
  }
  description() {
    return '💵1';
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
    this.turns++;
    if (this.turns % 3 === 0) {
      const coords = Util.nextToSymbol(game.board.cells, x, y, Empty.name);
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
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
      await game.board.spinDivOnce(newX, newY);
    }
  }
  description() {
    return '10%: replace random tile with 🪨'
  }
}

export class Wine extends Symbol {
  static name = '🍷';
  constructor() {
    super();
    this.rarity = 0.22;
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
    const coords = Util.nextToSymbol(game.board.cells, x, y, Cherry.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.cherryScore += 5;
      const [deleteX, deleteY] = coord;
      game.inventory.remove(game.board.cells[deleteY][deleteX]);
      game.board.cells[deleteY][deleteX] = new Empty();
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'flip', 0.15);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'remove neighboring 🍒 for 💵5'
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
      await game.inventory.addMoney(3);
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
      await Util.animate(game.board.getSymbolDiv(deleteX, deleteY), 'shake', 0.1, 2);
      await game.board.spinDivOnce(deleteX, deleteY);
    }
  }
  description() {
    return 'destroy neighboring 🪨 for 💵3, 10%: 💎'
  }
}
