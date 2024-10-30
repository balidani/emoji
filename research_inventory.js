import { Inventory } from './inventory.js';

export class ResearchInventory extends Inventory {
  constructor(settings, catalog) {
    super(settings, catalog);
    this.symbols = [];
    this.resources = { '🧬': 0 };
  }
  getInventory(game) {
    return game.researchInventory;
  }
}
