import * as Const from '../consts.js';
import * as Util from '../util.js';
import { Symb, chance } from '../symbol.js';

/* This file contains symbols still in testing. They may be broken or unbalanced */

export class FreeTurn extends Symb {
  static emoji = '🎟️';
  constructor() {
    super();
    this.rarity = 0.03;
  }
  copy() {
    return new FreeTurn();
  }
  // NOTE: this used to be a dead `evaluate(game, x, y)` hook that Board never
  // calls (only evaluateConsume/evaluateProduce/finalScore/score exist) --
  // the ticket never actually fired. evaluateConsume matches the "disappears
  // when it triggers" symbols elsewhere (e.g. things.js's Balloon).
  async evaluateConsume(game, x, y) {
    if (!chance(game, 0.1, x, y)) {
      return;
    }
    game.stats?.recordFreeTurn();
    // addResource (not a bare game.inventory.addResource) so this also
    // works from the permanent/passive inventory (x === -1): it reads the
    // source emoji via game.board.getEmoji, which already handles passives,
    // and logs the gain to the event log like every other resource-earning
    // symbol.
    await this.addResource(game, x, y, Const.TURNS, 1);
    if (x === -1 || y === -1) {
      return;
    }
    await game.view.animateCell(x, y, 'flip', 0.15, 3);
    await game.board.removeSymbol(game, x, y);
  }
  description() {
    return '10% [Chance](chance) to gain one more ⏰, then disappears. Voids all achievements';
  }
}

export class Grave extends Symb {
  static emoji = '🪦';
  constructor() {
    super();
    this.rarity = 0.06;
  }
  copy() {
    return new Grave();
  }
  async evaluateProduce(game, x, y) {
    // game.board.nextToEmpty(-1, y) already returns [] (passives have no
    // neighbors), so this naturally never fires while Grave is in the
    // permanent inventory -- there's nowhere for it to place a symbol.
    const coords = game.board.nextToEmpty(x, y);
    if (coords.length === 0) {
      return;
    }
    if (game.inventory.graveyard.length === 0) {
      return;
    }
    if (chance(game, 0.1, x, y)) {
      const [newX, newY] = Util.randomRemove(coords);
      const oldSymbol = Util.randomChoose(game.inventory.graveyard).copy();
      await game.view.animateCell(x, y, 'bounce', 0.15, 2);
      await game.board.addSymbol(game, oldSymbol, newX, newY);
      await game.eventlog.logResourceChange(
        oldSymbol.emoji(),
        '',
        this.emoji(),
        'earned'
      );
    }
  }
  description() {
    return '10% [Chance](chance) to [Spawn](spawn) a previously removed symbol nearby';
  }
}
