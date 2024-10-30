import * as Const from './consts.js';
import { Shop } from './shop.js';

export class ResearchShop extends Shop {
  constructor(catalog) {
    super(catalog);
    this.allowRefresh = false;
    this.refreshCostResource = Const.RESEARCH_POINT;
    this.refreshCostIncrease = 1;
    this.refreshCostMult = 1;
    this.refreshCostInitialMult = 0;
  }
  makeCatalog(_) {
    return this.catalog.generateResearchShop(3);
  }
  getInventory(game) {
    return game.researchInventory;
  }
}
