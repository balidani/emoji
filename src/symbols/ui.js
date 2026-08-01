import { Symb, CATEGORY_UNBUYABLE, CATEGORY_EMPTY_SPACE } from '../symbol.js';

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
    return 'Empty space. Not part of your inventory';
  }
  categories() {
    return [CATEGORY_EMPTY_SPACE, CATEGORY_UNBUYABLE];
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
    return 'Get as much as possible before the game ends';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
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
    return 'How many turns you have left';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
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
    return 'Click to play';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
  async evaluateConsume(game, x, y) {
    if (this.turns >= 1) {
      await game.board.removeSymbol(game, x, y);
    }
  }
}

export class BronzeMedal extends Symb {
  static emoji = '🥉';
  static threshold = 10000;
  static label = 'Bronze';
  constructor() {
    super();
  }
  copy() {
    return new BronzeMedal();
  }
  description() {
    return `Awarded when you earn 💵${BronzeMedal.threshold}`;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class SilverMedal extends Symb {
  static emoji = '🥈';
  static threshold = 25000;
  static label = 'Silver';
  constructor() {
    super();
  }
  copy() {
    return new SilverMedal();
  }
  description() {
    return `Awarded when you earn 💵${SilverMedal.threshold}`;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class GoldMedal extends Symb {
  static emoji = '🥇';
  static threshold = 50000;
  static label = 'Gold';
  constructor() {
    super();
  }
  copy() {
    return new GoldMedal();
  }
  description() {
    return `Awarded when you earn 💵${GoldMedal.threshold}`;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class Trophy extends Symb {
  static emoji = '🏆';
  static threshold = 100000;
  static label = 'Trophy';
  constructor() {
    super();
  }
  copy() {
    return new Trophy();
  }
  description() {
    return `Awarded when you earn 💵${Trophy.threshold}`;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class Crown extends Symb {
  static emoji = '👑';
  static threshold = 1000000;
  static label = 'Crown';
  constructor() {
    super();
  }
  copy() {
    return new Crown();
  }
  description() {
    return `Awarded when you earn 💵${Crown.threshold}`;
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

// Ordered ascending -- the one place score tiers are defined (used by
// game_settings.js's resultLookup and the frugal-medal achievements).
export const MEDAL_TIERS = [BronzeMedal, SilverMedal, GoldMedal, Trophy, Crown];

export class SpeechBubble extends Symb {
  static emoji = '💬';
  constructor() {
    super();
  }
  copy() {
    return new SpeechBubble();
  }
  description() {
    return "Doesn't do anything, but it looks nice";
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
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
    return 'Click to add an emoji to your inventory';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}

export class Luck extends Symb {
  static emoji = '💫';
  constructor() {
    super();
  }
  copy() {
    return new Luck();
  }
  description() {
    return 'Increases the chances of getting rare symbols in the shop';
  }
  categories() {
    return [CATEGORY_UNBUYABLE];
  }
}
