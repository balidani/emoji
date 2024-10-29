import { Shop } from './shop.js';

export class ResearchShop extends Shop {
  constructor(catalog) {
    super(catalog);
    this.allowRefresh = false;
  }
  makeCatalog(_) {
    return this.catalog.generateResearchShop(3);
  }
}
