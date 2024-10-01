import {
  chance, Symb, CATEGORY_UNBUYABLE, CATEGORY_EMPTY_SPACE,
} from "../symbol.js";
import * as Util from "../util.js";

export const CATEGORY_ENEMY = Symbol('Enemy');
export const CATEGORY_ANIMAL = Symbol('Enemy');

export class Wizard extends Symb {
  static emoji = '🧙‍♂️';
  constructor(hp = 100) {
    super();
    this.rarity = -1.0;
    this.hp = hp;
  }
  copy() {
    return new Wizard(this.hp);
  }
  async score(game, x, y) {
    if (this.hp <= 0) {
      game.over();
    }
    if (this.turns % 5 === 0 && this.turns > 0) {
      await this.addMoney(game, -(game.inventory.money - 1), x, y);
    }
  }
  async damage(game, x, y, dmg) {
    this.hp -= dmg;
    game.board.redrawCell(game, x, y);
    await Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1);
  }
  categories() {
    return [CATEGORY_ENEMY];
  }
  counter(game) {
    return this.hp;
  }
  description() {
    return 'this is the grand mage.';
  }
  descriptionLong() {
    return 'this is the grand mage. it steals almost all your money every 5 turns.';
  }
}

export class Dagger extends Symb {
  static emoji = '🗡️';
  constructor() {
    super();
    this.rarity = 0.4;
  }
  copy() {
    return new Dagger();
  }
  async score(game, x, y) {
    const coords = game.board.nextToCategory(x, y, CATEGORY_ENEMY);
    if (coords.length === 0) {
      return;
    }
    const [attackX, attackY] = Util.randomRemove(coords);
    await Util.animate(game.board.getSymbolDiv(x, y), 'shake', 0.1);
    await game.board.cells[attackY][attackX].damage(game, attackX, attackY, 3);
  }
  cost() {
    return 11;
  }
  description() {
    return 'deals 3 damage to a random enemy nearby.';
  }
  descriptionLong() {
    return 'deals 3 damage to a random enemy nearby.';
  }
}

export class Coin extends Symb {
  static emoji = '🪙';
  constructor() {
    super();
    this.rarity = 1;
  }
  copy() {
    return new Coin();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y),
    ]);
  }
  description() {
    return '💵1';
  }
  descriptionLong() {
    return 'this is a coin. it pays 💵1.';
  }
}

export class Clover extends Symb {
  static emoji = '🍀';
  constructor() {
    super();
    this.rarity = 0.21;
  }
  copy() {
    return new Clover();
  }
  categories() {
    return [];
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

export class CrystalBall extends Symb {
  static emoji = '🔮';
  constructor() {
    super();
    this.rarity = 0.07;
  }
  copy() {
    return new CrystalBall();
  }
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

export class Chick extends Symb {
  static emoji = '🐣';
  constructor(timeToGrow = 3) {
    super();
    this.timeToGrow = timeToGrow;
    this.rarity = 0.2;
    this.turns = 0;
  }
  copy() {
    return new Chick(this.timeToGrow);
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 1, x, y),
    ]);
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= this.timeToGrow) {
      await game.board.removeSymbol(game, x, y);
      await game.board.addSymbol(game, new Chicken(), x, y);
    }
  }
  counter(_) {
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
  static emoji = '🐔';
  constructor() {
    super();
    this.rarity = 0.15;
  }
  copy() {
    return new Chicken();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 3, x, y),
    ]);
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
  categories() {
    return [CATEGORY_ANIMAL];
  }
  description() {
    return '💵3<br>10% chance: lays up to 3 🥚';
  }
  descriptionLong() {
    return 'this is a chicken. it pays 💵3 and has a 10% chance of laying up to 3 🥚 on empty spaces around it.';
  }
}

export class Egg extends Symb {
  static emoji = '🥚';
  constructor() {
    super();
    this.rarity = 0.6;
    this.timeToHatch = 3 + Util.random(3);
  }
  copy() {
    return new Egg();
  }
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
  counter(_) {
    return this.timeToHatch - this.turns;
  }
  description() {
    return 'after 3-5 turns: hatches 🐣<br>1% chance: hatches 🐉';
  }
  descriptionLong() {
    return 'this is an egg. after 3-5 turns, it becomes a 🐣, or with 1% chance it becomes a 🐉.';
  }
}

export class Fox extends Symb {
  static emoji = '🦊';
  constructor() {
    super();
    this.rarity = 0.25;
    this.eatenScore = 3;
  }
  copy() {
    return new Fox();
  }
  async score(game, x, y) {
    if (this.eatenScore > 0) {
      await Promise.all([
        Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
        this.addMoney(game, this.eatenScore, x, y),
      ]);
      this.eatenScore = 0;
    }
  }
  async evaluateConsume(game, x, y) {
    const eatNeighbor = async (neighborClass, reward) => {
      const coords = game.board.nextToSymbol(x, y, neighborClass.emoji);
      if (coords.length === 0) {
        return;
      }
      for (const coord of coords) {
        this.eatenScore += reward;
        const [deleteX, deleteY] = coord;
        await game.board.removeSymbol(game, deleteX, deleteY);
      }
      this.turns = 0;
      game.board.redrawCell(game, x, y);
    };
    await eatNeighbor(Chick, 10);
    await eatNeighbor(Chicken, 20);
    if (this.turns >= 5) {
      await game.board.removeSymbol(game, x, y);
    }
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  counter(_) {
    return 5 - this.turns;
  }
  description() {
    return 'eats 🐔 for 💵20<br>eats 🐣 for 💵10<br>leaves after 5 turns with no food';
  }
  descriptionLong() {
    return 'this is a fox. it will eat 🐣 and 🐔 neighbors and pay 💵10 and 💵20 respectively. it disappears after 5 turns with no food.';
  }
}

export class Dragon extends Symb {
  static emoji = '🐉';
  constructor() {
    super();
    this.rarity = 0.01;
  }
  copy() {
    return new Dragon();
  }
  async score(game, x, y) {
    await Promise.all([
      Util.animate(game.board.getSymbolDiv(x, y), 'bounce', 0.1),
      this.addMoney(game, 42, x, y),
    ]);
  }
  categories() {
    return [CATEGORY_ANIMAL];
  }
  description() {
    return '💵42';
  }
  descriptionLong() {
    return 'this is a mighty dragon. it pays 💵42.';
  }
}
