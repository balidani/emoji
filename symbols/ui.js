import * as Const from '../consts.js';
import { Symb } from '../symbol.js';

// Symbols in this file are only used for UI purposes.

export class Empty extends Symb {
  static emoji = '⬜';
  constructor() {
    super();
  }
  copy() {
    return new Empty();
  }
  description() {
    return 'you should not be seeing this';
  }
  descriptionLong() {
    return "this is empty space. it's not part of your inventory.";
  }
  categories() {
    return [Const.CATEGORY_EMPTY_SPACE, Const.CATEGORY_UNBUYABLE];
  }
}

export class Money extends Symb {
  static emoji = '💵';
  constructor() {
    super();
  }
  copy() {
    return new Money();
  }
  description() {
    return 'this is money';
  }
  descriptionLong() {
    return 'this is money. you should get as much as possible before the game ends.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}
export class Turn extends Symb {
  static emoji = '⏰';
  constructor() {
    super();
  }
  copy() {
    return new Turn();
  }
  description() {
    return 'this is how many turns you have left';
  }
  descriptionLong() {
    return 'this is how many turns you have left.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class PlayButton extends Symb {
  static emoji = '🕹️';
  constructor() {
    super();
  }
  copy() {
    return new PlayButton();
  }
  description() {
    return 'click to play';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 1) {
      await game.board.removeSymbol(game, x, y);
    }
  }
}

export class BronzeMedal extends Symb {
  static emoji = '🥉';
  constructor() {
    super();
  }
  copy() {
    return new BronzeMedal();
  }
  description() {
    return 'this is a bronze medal. it is awarded when you earn 💵10000. you also earn 🧬1';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class SilverMedal extends Symb {
  static emoji = '🥈';
  constructor() {
    super();
  }
  copy() {
    return new SilverMedal();
  }
  description() {
    return 'this is a silver medal. it is awarded when you earn 💵15000. you also earn 🧬2';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class GoldMedal extends Symb {
  static emoji = '🥇';
  constructor() {
    super();
  }
  copy() {
    return new GoldMedal();
  }
  description() {
    return 'this is a gold medal. it is awarded when you earn 💵20000. you also earn 🧬3';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class Trophy extends Symb {
  static emoji = '🏆';
  constructor() {
    super();
  }
  copy() {
    return new Trophy();
  }
  description() {
    return 'this is a trophy. it is awarded when you earn 💵25000. you also earn 🧬4';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class Crown extends Symb {
  static emoji = '👑';
  constructor() {
    super();
  }
  copy() {
    return new Crown();
  }
  description() {
    return 'this is a crown. it is awarded when you earn 💵100000. at this point, you have completed the game.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class SpeechBubble extends Symb {
  static emoji = '💬';
  constructor() {
    super();
  }
  copy() {
    return new SpeechBubble();
  }
  description() {
    return "this is a speech bubble. it doesn't do anything, but it looks nice.";
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}

export class BuyButton extends Symb {
  static emoji = '✅';
  constructor() {
    super();
  }
  copy() {
    return new BuyButton();
  }
  description() {
    return 'this is a buy button. click on it to add an emoji to your inventory.';
  }
  categories() {
    return [Const.CATEGORY_UNBUYABLE];
  }
}
