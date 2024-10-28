import { Shop } from './shop.js';

export class ResearchShop extends Shop {
  constructor(catalog) {
    super(catalog);
  }
  makeCatalog(_) {
    return this.catalog.generateResearchShop(3);
  }
}
