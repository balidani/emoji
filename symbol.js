import * as Util from './util.js'

export const CATEGORY_EMPTY_SPACE = Symbol("Empty Space");
export const CATEGORY_UNBUYABLE = Symbol("Unbuyable");
export const CATEGORY_FOOD = Symbol("Food");
export const CATEGORY_FRUIT = Symbol("Fruit");
export const CATEGORY_VEGETABLES = Symbol("Vegetables");

const luckyChance = (game, chance, x, y) => {
  if (game.board.nextToSymbol(x, y, BullsEye.name).length > 0) {
    return 1.0;
  }
  return chance + game.inventory.lastLuckBonus;
}
const chance = (game, percent, x, y) =>
  Math.random() < luckyChance(game, percent, x, y);

export class Symb {
  static name = '⬛';
  constructor() {
    this.multiplier = 1;
    this.rarity = 0;
    this.turns = 0;
  }
  copy() {
    throw new Error('Trying to get copy of base class.');
  }
  async evaluateConsume() { }
  async evaluateProduce() { }
  async finalScore(game, x, y) { }
  async score(game, x, y) { }
  categories() {
    return [];
  }
  description() {
    throw new Error('Trying to get description of base class.');
  }
  descriptionLong() {
    throw new Error('Trying to get long description of base class.');
  }
  async addMoney(game, score, x, y) {
    const value = score * this.multiplier;
    const coords = game.board.nextToSymbol(x, y, Multiplier.name);
    for (const coord of coords) {
      const [multX, multY] = coord;
      await Util.animate(game.board.getSymbolDiv(multX, multY), 'flip', 0.15, 1);
    }
    await Promise.all([
      game.board.showMoneyEarned(x, y, value),
      game.inventory.addMoney(score * this.multiplier)]);
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

export class Empty extends Symb {
  static name = '⬜';
  constructor() {
    super();
  }
  copy() {
    return new Empty()
  }
  description() {
    return 'you should not be seeing this'
  }
  descriptionLong() {
    return 'this is empty space. it\'s not part of your inventory.';
  }
  categories() {
    return [CATEGORY_EMPTY_SPACE];
  }
}

/* Gameplay symbols. */

export class Balloon extends Symb {
  static name = '🎈';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new Balloon(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y)]);
  }
  async evaluateConsume(game, x, y) {
    if (chance(game, 0.5, x, y)) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  description() {
    return '💵20<br>50% chance: pop';
  }
  descriptionLong() {
    return 'this is a balloon. it gives you 💵20, but it has a 50% chance of popping and disappearing.';
  }
}

export class Bank extends Symb {
  static name = '🏦';
  constructor() {
    super();
    this.turns = 0;
    this.rarity = 0.4;
  }
  copy() { return new Bank(); }
  async evaluateProduce(game, x, y) {
    const mint = async () => {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const coin = new Coin();
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
      await game.board.addSymbol(game, coin, newX, newY);
    };
    await mint();
  }
  description() {
    return 'every turn: makes 🪙';
  }
  descriptionLong() {
    return 'this is a bank. if there is empty space nearby, it will put 🪙 there.';
  }
}

export class Bell extends Symb {
  static name = '🔔';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Bell(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 11, x, y)]);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.2, x, y)) {
      const note = new MusicalNote();
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, note, newX, newY);
    }
  }
  description() {
    return '💵11<br>20% chance: makes 🎵';
  }
  descriptionLong() {
    return 'this is a bell. it pays 💵11, and it has a 20% chance to create 🎵 on a neighboring empty space.';
  }
}

export class Bomb extends Symb {
  static name = '💣';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Bomb(); }
  async evaluateConsume(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const coords = game.board.nextToExpr(x, y,
        (sym) => ![Empty.name, Firefighter.name].includes(sym.name()));
      if (coords.length === 0) {
        return;
      }
      const coord = Util.randomChoose(coords);
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  description() {
    return '10% chance: destroys a neighbor';
  }
  descriptionLong() {
    return 'this is a bomb. there is a 10% chance it will destroy a neighboring symbol.';
  }
}

export class Briefcase extends Symb {
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
    return (game.inventory.symbols.length / 4 | 0) * 5;
  }
  description() {
    return '💵5 for every 4 symbols in inventory';
  }
  descriptionLong() {
    return 'this is a briefcase. it pays 💵5 for every 4 symbols you have in your inventory.';
  }
}

export class Bubble extends Symb {
  static name = '🫧';
  constructor() {
    super();
    this.rarity = 0;
  }
  copy() { return new Bubble(); }
  async evaluateConsume(game, x, y) {
    if (this.turns < 3) {
      return;
    }
    await game.board.removeSymbol(game, x, y);
  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return 'disappears after 3 turns';
  }
  descriptionLong() {
    return 'this is a bubble. it doesn\'t really do anything. it will disappear after 3 turns.';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class Butter extends Symb {
  static name = '🧈';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new Butter(); }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 7) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter() {
    return 7 - this.turns;
  }
  categories() {
    return [CATEGORY_FOOD];
  }
  description() {
    return 'x3 to neighboring 🍿<br>melts after 7 turns';
  }
  descriptionLong() {
    return 'this is butter. it triples the value of all neighboring 🍿. it disappears after 7 turns.';
  }
}

export class Bug extends Symb {
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
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_FOOD)
    if (coords.length === 0) {
      if (this.turns >= 5) {
        await game.board.removeSymbol(game, x, y);
      }
    } else {
      this.turns = 0;
      game.board.updateCounter(game, x, y);
      for (const coord of coords) {
        this.foodScore += 8;
        const [deleteX, deleteY] = coord;
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
    }
  }
  counter(game) {
    return 5 - this.turns;
  }
  description() {
    return 'eats nearby food for 💵8 each<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a bug. it will eat all edible neighbors and pay out 💵8 for each item eaten. it disappears after 5 turns with no food.';
  }
}

export class BullsEye extends Symb {
  static name = '🎯';
  constructor() {
    super();
    this.rarity = 0.045;
  }
  copy() { return new BullsEye(); }
  description() {
    return 'neighboring rolls always succeed';
  }
  descriptionLong() {
    return 'this is a bullseye. any neighboring symbol that has a chance of doing something will always succeed.';
  }
}

export class Champagne extends Symb {
  static name = '🍾';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() { return new Champagne(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 70, x, y)]);
  }
  async evaluateProduce(game, x, y) {
    if (this.turns < 3) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
    await game.board.removeSymbol(game, x, y);
    await game.board.addSymbol(game, new Bubble(), x, y);
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    for (let i = 0; i < coords.length; ++i) {
      const [newX, newY] = coords[i];
      await game.board.addSymbol(game, new Bubble(), newX, newY);
    }
  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return '💵70<br>after 3 turns: explodes';
  }
  descriptionLong() {
    return 'this is a champagne. it pays 💵70, but explodes after 3 turns, making 🫧 on empty neighboring spaces and itself.';
  }
}

export class Cherry extends Symb {
  static name = '🍒';
  constructor() {
    super();
    this.rarity = 0.8;
  }
  copy() { return new Cherry(); }
  async score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Cherry.name);
    if (coords.length === 0) {
      return;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, coords.length * 2, x, y)]);
  }
  categories() {
    return [CATEGORY_FOOD, CATEGORY_FRUIT];
  }
  description() {
    return '💵2 for each neighboring 🍒';
  }
  descriptionLong() {
    return 'this is a cherry. it pays 💵2 for each other 🍒 next to it.';
  }
}

export class Chick extends Symb {
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
  async evaluateConsume(game, x, y) {
    if (this.turns >= 3) {
      await game.board.removeSymbol(game, x, y);
      await game.board.addSymbol(game, new Chicken(), x, y);
    }
  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return '💵1<br>after 3 turns: becomes 🐔';
  }
  descriptionLong() {
    return 'this is a chick. it pays 💵1 and becomes 🐔 in 3 turns.';
  }
}

export class Chicken extends Symb {
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
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const eggCount = 1 + Util.random(3);
      for (let i = 0; i < Math.min(coords.length, eggCount); ++i) {
        const [newX, newY] = Util.randomRemove(coords);
        const egg = new Egg();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
        await game.board.addSymbol(game, egg, newX, newY);
      }
    }
  }
  description() {
    return '💵3<br>10% chance: lays up to 3 🥚';
  }
  descriptionLong() {
    return 'this is a chicken. it pays 💵3 and has a 10% chance of laying up to 3 🥚 on empty spaces around it.';
  }
}

export class Clover extends Symb {
  static name = '🍀';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() { return new Clover(); }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '+1% luck';
  }
  descriptionLong() {
    return 'this is a clover. it gives you luck. symbols having a chance to do something will succeed more. and you get rarer items to choose from in the shop.';
  }
  async score(game, x, y) {
    game.inventory.addLuck(0.01);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
  }
}

export class Cocktail extends Symb {
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
  async evaluateConsume(game, x, y) {
    const remove = async (sym, reward) => {
      const coords = game.board.nextToSymbol(x, y, sym.name);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.cherryScore = reward(this.cherryScore);
        const [deleteX, deleteY] = coord;
        await game.board.removeSymbol(game, deleteX, deleteY);
        game.board.updateCounter(game, x, y);
      }
    }
    await remove(Cherry, (v) => v + 2);
    await remove(Pineapple, (v) => v + 4);
    await remove(Champagne, (v) => v * 2);
  }
  counter(game) {
    return this.cherryScore;
  }
  description() {
    return '💵2 per 🍒 removed<br>💵4 per 🍍 removed<br>x2 per 🍾 removed';
  }
  descriptionLong() {
    return 'this is a cocktail. it permanently gives more 💵 by removing neighboring 🍒 (💵2), 🍍 (💵4) and 🍾 (x2).';
  }
}

export class Coin extends Symb {
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
  descriptionLong() {
    return 'this is a coin. it pays 💵2.';
  }
}

export class Corn extends Symb {
  static name = '🌽';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() { return new Corn(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 20, x, y)]);
  }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      for (let i = 0; i < coords.length; ++i) {
        const [newX, newY] = coords[i];
        const popcorn = new Popcorn();
        await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
        await game.board.addSymbol(game, popcorn, newX, newY);
      }
    }
  }
  categories() {
    return [CATEGORY_VEGETABLES, CATEGORY_FOOD];
  }
  description() {
    return '💵20<br>10% chance: pops 🍿';
  }
  descriptionLong() {
    return 'this is corn. it pays 💵20, and has a 10% chance to pop, making 🍿 on all empty space nearby.';
  }
}

export class CreditCard extends Symb {
  static name = '💳';
  constructor(turn = 0) {
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
    }
  }
  description() {
    return '💵1000 now<br>💵-1100 on last turn';
  }
  descriptionLong() {
    return 'this is a credit card. it pays 💵1000, but takes 💵1100 on your last turn. if it\'s not on the board on your last turn, however ...';
  }
}

export class CrystalBall extends Symb {
  static name = '🔮';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() { return new CrystalBall(); }
  description() {
    return '+3% luck';
  }
  descriptionLong() {
    return 'this is a crystal ball. symbols having a chance to do something will succeed more. and you get rarer items to choose from in the shop.';
  }
  async score(game, x, y) {
    game.inventory.addLuck(0.03);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1, 2);
  }
}

export class Dancer extends Symb {
  static name = '💃';
  constructor() {
    super();
    this.rarity = 0.3;
    this.musicScore = 0;
  }
  copy() { return new Dancer(); }
  async score(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, MusicalNote.name);
    if (coords.length === 0) {
      return;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, coords.length * 10, x, y)]);
  }
  description() {
    return '💵10 for each neighboring 🎵';
  }
  descriptionLong() {
    return 'this is a dancer. it pays 💵10 for each 🎵 it\'s standing next to.';
  }
}

export class Diamond extends Symb {
  static name = '💎';
  constructor() {
    super();
    this.rarity = 0.3;
  }
  copy() { return new Diamond(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.15),
      this.addMoney(game, 6, x, y)]);
    const coords = game.board.nextToSymbol(x, y, Diamond.name);
    if (coords.length === 0) {
      return;
    }
    await this.addMoney(game, coords.length * 5, x, y);
  }
  description() {
    return '💵6<br>💵5 for each neighboring 💎';
  }
  descriptionLong() {
    return 'this is a diamond. it pays 💵6 and 💵5 for each other 💎 next to it.';
  }
}

export class Dice extends Symb {
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
  descriptionLong() {
    return 'this is a die. it has a 1% chance to pay 💵52.';
  }
}

export class Dragon extends Symb {
  static name = '🐉';
  constructor() {
    super();
    this.rarity = 0.01;
  }
  copy() { return new Dragon(); }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 42, x, y)]);
  }
  description() {
    return '💵42';
  }
  descriptionLong() {
    return 'this is a mighty dragon. it pays 💵42.';
  }
}

export class Drums extends Symb {
  static name = '🥁';
  constructor() {
    super();
    this.rarity = 0.25;
  }
  copy() { return new Drums(); }
  async evaluateProduce(game, x, y) {
    if (this.turns % 3 === 0) {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomChoose(coords);
      await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 3);
      await game.board.addSymbol(game, new MusicalNote(), newX, newY);
    }
  }
  counter(game) {
    return 3 - this.turns % 3;
  }
  description() {
    return 'every 3 turns: makes 🎵';
  }
  descriptionLong() {
    return 'these are drums. every third turn, they create 🎵 on a nearby empty space.';
  }
}

export class Egg extends Symb {
  static name = '🥚';
  constructor() {
    super();
    this.rarity = 0.6;
    this.timeToHatch = 3 + Util.random(3);
  }
  copy() { return new Egg(); }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToHatch) {
      let newSymbol = new Chick();
      if (chance(game, 0.01, x, y)) {
        newSymbol = new Dragon();
      }
      await game.board.removeSymbol(game, x, y);
      await game.board.addSymbol(game, newSymbol, x, y);
    }
  }
  counter(game) {
    return this.timeToHatch - this.turns;
  }
  description() {
    return 'after 3-5 turns: hatches 🐣<br>1% chance: hatches 🐉'
  }
  descriptionLong() {
    return 'this is an egg. after 3-5 turns, it becomes a 🐣, or with 1% chance it becomes a 🐉.';
  }
}

export class Firefighter extends Symb {
  static name = '🧑‍🚒';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Firefighter(); }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Bomb.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
    await game.board.removeSymbol(game, x, y);
  }
  description() {
    return 'disarms 💣, then leaves';
  }
  descriptionLong() {
    return 'this is an firefighter. if it stands to a 💣, it will remove the 💣 and leave your inventory.';
  }
}

export class Fox extends Symb {
  static name = '🦊';
  constructor() {
    super();
    this.rarity = 0.25;
    this.eatenScore = 3;
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
  async evaluateConsume(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = game.board.nextToSymbol(x, y, neighborClass.name);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.eatenScore += reward;
        const [deleteX, deleteY] = coord;
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
      this.turns = 0;
      game.board.updateCounter(game, x, y);
    };
    await eatNeighbor(Chick, 10);
    await eatNeighbor(Chicken, 20);
    if (this.turns >= 5) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter(game) {
    return 5 - this.turns;
  }
  description() {
    return 'eats 🐔 for 💵20<br>eats 🐣 for 💵10<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a fox. it will eat 🐣 and 🐔 neighbors and pay 💵10 and 💵20 respectively. it disappears after 5 turns with no food.';
  }
}

export class Hole extends Symb {
  static name = '🕳️';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() { return new Hole(); }
  description() {
    return 'always empty';
  }
  descriptionLong() {
    return 'this is a hole. it works like an empty space, other symbols can be created here and they will go into your inventory.';
  }
  categories() {
    return [CATEGORY_EMPTY_SPACE]
  }
}

export class MagicWand extends Symb {
  static name = '🪄';
  constructor() {
    super();
    this.rarity = 0.1;
  }
  copy() { return new MagicWand(); }
  async evaluateProduce(game, x, y) {
    const emptyCoords = game.board.nextToEmpty(x, y);
    if (emptyCoords.length === 0) {
      return;
    }
    const nonEmptyCoords = game.board.nextToExpr(x, y,
      (sym) => sym.name() !== Empty.name);
    if (nonEmptyCoords.length === 0) {
      return;
    }
    if (chance(game, 0.15, x, y)) {
      const [copyX, copyY] = Util.randomChoose(nonEmptyCoords);
      const [newX, newY] = Util.randomChoose(emptyCoords);
      const newSymbol = game.board.cells[copyY][copyX].copy();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, newSymbol, newX, newY);
    }
  }
  description() {
    return '15% chance: duplicates neighboring symbol';
  }
  descriptionLong() {
    return 'this is a magic wand. it has a 15% chance to copy a neighboring symbol and place it on nearby empty space.';
  }
}

export class Mango extends Symb {
  static name = '🥭';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() { return new Mango(); }
  async evaluateScore(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_FRUIT);
    if (coords.length === 0) {
      return;
    }
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.15, 2);
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  categories() {
    return [CATEGORY_FRUIT, CATEGORY_FOOD];
  }
  description() {
    return 'x2 to neighboring fruit';
  }
  descriptionLong() {
    return 'this is a mango. it makes nearby fruit give double 💵.';
  }
}

export class MoneyBag extends Symb {
  static name = '💰';
  constructor(coins = 0) {
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
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Coin.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.coins += 2;
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
      game.board.updateCounter(game, x, y);
    }
  }
  counter(game) {
    return this.coins;
  }
  description() {
    return '💵2 for each 🪙 collected<br>collects neighboring 🪙'
  }
  descriptionLong() {
    return 'this is a money bag. it collects neighboring 🪙 and permanently gives 💵2 more for each 🪙 collected.';
  }
}

export class Moon extends Symb {
  static name = '🌝';
  constructor(turns = 0) {
    super();
    this.rarity = 0.28;
    this.turns = turns;
  }
  copy() { return new Moon(this.turns); }
  async score(game, x, y) {
    if (this.turns >= 31) {
      this.turns = 0;
      game.board.updateCounter(game, x, y);
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'flip', 0.3),
        this.addMoney(game, 555, x, y)]);
    }
    this.moonScore = 0;
  }
  counter(game) {
    return 31 - this.turns;
  }
  description() {
    return 'every 31 turns: 💵555';
  }
  descriptionLong() {
    return 'this is a moon. every 31 turns, it gives 💵555.';
  }
}

export class Multiplier extends Symb {
  static name = '❎';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() { return new Multiplier(); }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToExpr(x, y,
      (sym) => sym.name() !== Empty.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [neighborX, neighborY] = coord;
      game.board.cells[neighborY][neighborX].multiplier *= 2;
    }
  }
  description() {
    return 'x2 to all neighbors';
  }
  descriptionLong() {
    return 'this is a multiplier. it doubles the 💵 gained (or lost) for all neighboring symbols.';
  }
}

export class MusicalNote extends Symb {
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
  async evaluateConsume(game, x, y) {
    if (this.turns >= 3) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter(game) {
    return 3 - this.turns;
  }
  description() {
    return '💵4<br>disappears after 3 turns';
  }
  descriptionLong() {
    return 'this is a musical note. it pays 💵4, and disappears after 3 turns';
  }
}

export class Pineapple extends Symb {
  static name = '🍍';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Pineapple(); }
  async score(game, x, y) {
    const coords = game.board.nextToExpr(x, y,
      (sym) => sym.name() !== Empty.name);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 12 - coords.length * 2, x, y)]);
  }
  categories() {
    return [CATEGORY_FRUIT, CATEGORY_FOOD];
  }
  description() {
    return '💵12<br>💵-2 for all non-empty neighbors';
  }
  descriptionLong() {
    return 'this is a pineapple. it pays 💵12, minus 💵2 for all neighboring symbols that are not empty.';
  }
}

export class Popcorn extends Symb {
  static name = '🍿';
  constructor() {
    super();
    this.rarity = 0;
    this.timeToLive = 2 + Util.random(4);
  }
  copy() { return new Popcorn(); }
  async score(game, x, y) {
    const butter = game.board.nextToSymbol(x, y, Butter.name);
    let score = 17;
    for (const b of butter) {
      score *= 3;
    }
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, score, x, y)]);
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToLive) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  counter(game) {
    return this.timeToLive - this.turns;
  }
  categories() {
    return [CATEGORY_FOOD];
  }
  description() {
    return '💵17<br>disappears after 2-5 turns'
  }
  descriptionLong() {
    return 'this is popcorn. it pays 💵17 and disappears after 2-5 turns.';
  }
}

export class Record extends Symb {
  static name = '📀';
  constructor(notes = 0) {
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
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, MusicalNote.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      this.notes += 6;
      game.board.updateCounter(game, x, y);
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
    }
  }
  counter(game) {
    return this.notes;
  }
  description() {
    return 'records neighboring 🎵<br>💵6 for each 🎵 recorded';
  }
  descriptionLong() {
    return 'this is a record. it removes neighboring 🎵 and permanently pays 💵6 more for each 🎵 removed.';
  }
}

export class Refresh extends Symb {
  static name = '🔀';
  constructor() {
    super();
    this.rarity = 0.05;
  }
  copy() { return new Refresh(); }
  async evaluateProduce(game, x, y) {
    game.shop.refreshable = true;
    game.shop.refreshCount = 0;
  }
  description() {
    return 'always allows refreshing the shop';
  }
  descriptionLong() {
    return 'this is a refresher. it allows refreshing the selection in the shop more than once. careful, the cost of refreshing also increases.';
  }
}

export class Rock extends Symb {
  static name = '🪨';
  constructor() {
    super();
    this.rarity = 0.55;
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
  descriptionLong() {
    return 'this is a rock. it pays 💵1. i\'m not sure what you expected.';
  }
}

export class Snail extends Symb {
  static name = '🐌';
  constructor() {
    super();
    this.rarity = 0.12;
  }
  copy() { return new Snail(); }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToExpr(x, y, (sym) => true);
    for (const cell of coords) {
      const [neighborX, neighborY] = cell;
      game.board.cells[neighborY][neighborX].turns--;
    }
  }
  description() {
    return 'slows down neighbors by 1 turn';
  }
  descriptionLong() {
    return 'this is a snail. all neighboring symbols that have a timer will take one more turn to complete.';
  }
}

export class Rocket extends Symb {
  static name = '🚀';
  constructor() {
    super();
    this.rarity = 0.18;
  }
  copy() { return new Rocket(); }
  async evaluateProduce(game, x, y) {
    const coords = game.board.nextToExpr(x, y, (sym) => true);
    for (const cell of coords) {
      const [neighborX, neighborY] = cell;
      game.board.cells[neighborY][neighborX].turns++;
    }
  }
  description() {
    return 'speeds up neighbors by 1 turn';
  }
  descriptionLong() {
    return 'this is a rocket. all neighboring symbols that have a timer will complete one turn faster.';
  }
}

export class ShoppingBag extends Symb {
  static name = '🛍️';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() { return new ShoppingBag(); }
  async evaluateProduce(game, x, y) {
    game.shop.buyCount++;
  }
  description() {
    return 'allows picking 1 more item';
  }
  descriptionLong() {
    return 'these are shopping bags. you can choose one more item to buy from the shop.';
  }
}

export class Slots extends Symb {
  static name = '🎰';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() { return new Slots(); }
  async score(game, x, y) {
    const value = this.counter(game);
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, value, x, y)]);
  }
  counter(game) {
    return new Set(game.inventory.symbols.map(s => s.name())).size * 2;
  }
  description() {
    return '💵2 per different symbol in inventory';
  }
  descriptionLong() {
    return 'this is a slot machine. it pays 💵2 for all the different symbols in your inventory.';
  }
}

export class Tree extends Symb {
  static name = '🌳';
  constructor() {
    super();
    this.rarity = 0.4;
    this.turns = 0;
  }
  copy() { return new Tree(); }
  async evaluateProduce(game, x, y) {
    const grow = async () => {
      const coords = game.board.nextToEmpty(x, y);
      if (coords.length === 0) {
        return;
      }
      const [newX, newY] = Util.randomRemove(coords);
      const cherry = new Cherry();
      await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.15, 2);
      await game.board.addSymbol(game, cherry, newX, newY);
    };

    if (this.turns % 3 === 0) {
      await grow(); await grow();
    }
  }
  counter(game) {
    return 3 - this.turns % 3;
  }
  description() {
    return 'every 3 turns: grows 🍒🍒';
  }
  descriptionLong() {
    return 'this is a tree. every 3 turns, it will grow up to two 🍒 on nearby empty space.';
  }
}

export class Volcano extends Symb {
  static name = '🌋';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() { return new Volcano(); }
  async evaluateProduce(game, x, y) {
    if (chance(game, 0.1, x, y)) {
      const newX = Util.random(game.gameSettings.boardX);
      const newY = Util.random(game.gameSettings.boardY);
      await game.board.removeSymbol(game, newX, newY);
      await game.board.addSymbol(game, new Rock(), newX, newY);
    }
  }
  description() {
    return '10% chance: replaces random tile with 🪨'
  }
  descriptionLong() {
    return 'this is a volcano. it has a 10% chance to replace a random tile on the board with 🪨.';
  }
}

export class Worker extends Symb {
  static name = '👷';
  constructor() {
    super();
    this.rarity = 0.45;
  }
  copy() { return new Worker(); }
  async evaluateConsume(game, x, y) {
    const coords = game.board.nextToSymbol(x, y, Rock.name);
    if (coords.length === 0) {
      return;
    }
    for (const coord of coords) {
      const [deleteX, deleteY] = coord;
      await game.board.removeSymbol(game, deleteX, deleteY);
      if (chance(game, 0.5, x, y)) {
        await game.board.addSymbol(game, new Diamond(), deleteX, deleteY);
      }
    }
  }
  description() {
    return 'destroys neighboring 🪨 for 💵3<br>50% chance: produce 💎'
  }
  descriptionLong() {
    return 'this is a worker. it pays 💵3 for each neighboring 🪨 removed. it has a 50% chance to produce 💎 in place of the destroyed 🪨.';
  }
}
