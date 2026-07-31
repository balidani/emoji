import * as Const from './consts.js';
import * as Util from './util.js';

export class Shop {
  constructor(catalog, renderer) {
    this.catalog = catalog;
    this.view = renderer;
    this.isOpen = false;
    this.refreshCost = 1;
    this.refreshCount = 0;
    this.allowRefresh = true;
    this.haveRefreshSymbol = false;
    this.buyCount = 1;
    this.buyLines = 3;
    this.refreshCostResource = Const.MONEY;
    this.refreshCostIncrease = 1;
    this.refreshCostMult = 1.5;
    this.refreshCostInitialMult = 0.01;
    this.firstTurnRare = false;
    this.currentOffers = [];
  }
  canAfford(game, cost) {
    for (const [key, value] of Object.entries(cost)) {
      if (this.getInventory(game).getResource(key) < value) {
        return false;
      }
    }
    return true;
  }
  makeCatalog(game) {
    const rareOnly =
      game.inventory.getResource(Const.TURNS) ===
        game.settings.gameLength - 1 && this.firstTurnRare;
    return this.catalog.generateShop(
      this.buyLines,
      this.getInventory(game).getResource(Const.LUCK),
      /* rareOnly= */ rareOnly
    );
  }
  getInventory(game) {
    return game.inventory;
  }
  async open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    const catalog = this.makeCatalog(game);
    this.currentOffers = [];
    const offers = [];
    for (let i = 0; i < this.buyLines; ++i) {
      if (catalog.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(catalog, /* shop= */ true);
      // Support for dynamically generated cost -- report the same value that is subtracted later.
      const cost = symbol.cost();
      const id = this.currentOffers.length;
      this.currentOffers.push({ symbol, cost });
      offers.push({
        id,
        emoji: symbol.emoji(),
        description: symbol.description(),
        descriptionLong: symbol.descriptionLong(),
        cost,
        canBuy: this.canAfford(game, cost),
        buttonText: Const.BUY,
        onBuy: () => this.attemptPurchase(game, id),
      });
    }
    // Refresh
    let refreshOffer = null;
    if (
      this.allowRefresh &&
      (this.haveRefreshSymbol || this.refreshCount === 0)
    ) {
      const cost = { [this.refreshCostResource]: this.refreshCost };
      refreshOffer = {
        cost,
        canBuy: this.canAfford(game, cost),
        buttonText: Const.REFRESH,
        onBuy: () => this.attemptRefresh(game),
      };
    }
    await this.view.renderShop(offers, refreshOffer);
  }
  async attemptPurchase(game, offerId) {
    const offer = this.currentOffers[offerId];
    if (!offer) {
      return;
    }
    const { symbol, cost } = offer;
    const canBuy = this.canAfford(game, cost);
    if (this.buyCount > 0 && canBuy) {
      this.buyCount--;
      for (const [key, value] of Object.entries(cost)) {
        await Promise.all([
          game.eventlog.logResourceChange(
            key,
            -value,
            Const.SHOPPING_CART,
            'earned'
          ),
          this.getInventory(game).addResource(key, -value),
        ]);
      }
      await symbol.onBuy(game);
    } else if (!canBuy) {
      // Disable button.
      // This is not the best solution, we should disable the button
      // once we know the player doesn't have enough resources.
      await this.view.disableOffer(offerId);
      return;
    }
    if (this.buyCount > 0) {
      await this.view.markOfferBought(offerId);
    }
    if (this.buyCount === 0) {
      await this.close(game);
    }
  }
  async attemptRefresh(game) {
    this.refreshCount++;
    if (
      this.getInventory(game).getResource(this.refreshCostResource) >=
      this.refreshCost
    ) {
      await Promise.all([
        game.eventlog.logResourceChange(
          this.refreshCostResource,
          -this.refreshCost,
          Const.REFRESH,
          'earned'
        ),
        this.getInventory(game).addResource(
          this.refreshCostResource,
          -this.refreshCost
        ),
      ]);
      this.refreshCost += this.refreshCostIncrease;
      this.refreshCost = Math.trunc(this.refreshCost * this.refreshCostMult);
      this.isOpen = false;
      await this.view.closeShop();
      await this.open(game);
    }
  }
  async close(game) {
    if (!this.isOpen) {
      return;
    }
    this.reset(game);
    await this.view.closeShop();
    this.isOpen = false;
  }
  hide() {
    this.view.hideShop();
  }
  show() {
    if (this.buyCount > 0) {
      this.view.showShop();
    }
  }
  reset(game) {
    this.haveRefreshSymbol = false;
    this.refreshCost = Math.trunc(
      1 +
        this.getInventory(game).getResource(this.refreshCostResource) *
          this.refreshCostInitialMult
    );
    this.refreshCount = 0;
    this.buyCount = 1;
    this.buyLines = 3;
  }
}
