import * as Util from '../util.js';
import { Symb } from '../symbol.js';

// Frozen disguise pool: every emoji that can legitimately appear on the board
// (no tools/UI), plus the three special members behaviour #2 calls out. Kept
// as an explicit constant so the pick is deterministic and independent of
// future catalog growth.
export const JOKER_DISGUISES = Util.parseEmojiString(
  '🪙💼🏦💳💰🫙🎲💸🐣🐔🦊🐉🐛🧈🍒🌽🍍🍿🍹🍾🌳💎🪨🌋👷🔔🥁📀🎈🌝🧵🎁☁️🪄❎🔀🛍️📮🍀🔮🥠🎯🚀🧊🎰🫧🥚🧑‍🎄🃏'
);

export class Wildcard extends Symb {
  static emoji = '🃏';
  constructor() {
    super();
    this.rarity = 0.04;
  }
  copy() {
    return new Wildcard();
  }
  transformsOnRoll() {
    return true;
  }
  // One seeded main-stream draw, at transform time only (never in the
  // constructor) -- no import-time draw. Draws from the full frozen pool,
  // not the player's unlocked set, so in Progression mode a disguise can
  // (harmlessly) preview a symbol not yet unlocked for purchase.
  rollDisguise(game) {
    return game.catalog.symbol(Util.randomChoose(JOKER_DISGUISES));
  }
  description() {
    return '[Transforms](transform) into a random symbol each turn.';
  }
}
