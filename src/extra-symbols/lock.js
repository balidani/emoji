import { CATEGORY_EMPTY_SPACE, Symb, chance } from '../symbol.js';
import * as Util from '../util.js';

export class Lock extends Symb {
  static emoji = '🔒';
  constructor() {
    super();
    this.rarity = 0.06;
    this.lockedCells = {};
  }
  copy() {
    return new Lock();
  }
  description() {
    return '[Pays](pays) 💵1. 50% [Chance](chance) to lock a neighboring cell for 3 turns';
  }
  async score(game, x, y) {
    await this.addMoney(game, 1, x, y);
    if (chance(game, 0.5, x, y)) {
      const targets = game.board.nextToExpr(
        x,
        y,
        (symb) => !symb.categories().includes(CATEGORY_EMPTY_SPACE)
      );
      if (targets.length > 0) {
        const [tx, ty] = Util.randomChoose(targets);
        await game.view.animateCell(x, y, 'shake', 0.15, 3);
        await game.board.lockCell(x, y, game.board.cells[ty][tx], 3);
        this.lockedCells[this.turns + 3] = game.board.cells[ty][tx];
        game.inventory.remove(game.board.cells[ty][tx]);
      }
      const unlocked = this.lockedCells[this.turns];
      if (unlocked) {
        game.inventory.add(this.lockedCells[this.turns]);
        delete this.lockedCells[this.turns];
      }
    }
  }
}
