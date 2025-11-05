import * as Const from './consts.js';
import * as Util from './util.js';

import { Effect } from './Effect.js';

export class Shop {
  constructor(catalog, inventory) {
    this.catalog = catalog;
    this.inventory = inventory;
    this.shopDiv = document.querySelector('.game .shop');

    // TODO #REFACTOR, these should come from the config
    this.buyCount = 1;
    this.buyLines = 3;

    this.refreshCost = 1;
    this.refreshCount = 0;
    this.haveRefreshSymbol = false;
    this.refreshCostResource = Const.MONEY;
    this.refreshCostIncrease = 1;
    this.refreshCostMult = 1.5;
    this.refreshCostInitialMult = 0.01;
    this.currentOffers = {};
  }
  makeCatalog() {
    return this.catalog.generateShop(
      this.buyLines,
      this.inventory.getResource(Const.LUCK)
    );
  }
  open() {
    if (this.buyCount <= 0) {
      return Effect.none();
    }
    const catalog = this.makeCatalog();
    const offers = [];
    for (let i = 0; i < this.buyLines; ++i) {
      if (catalog.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(catalog, /* shop= */ true);
      const symbolCost = symbol.cost();
      // Currently static, should maybe be re-checked when other items are bought.
      const canBuy = this._canBuySymbol(symbolCost);
      const offerInfo = {
        offerId: i,
        symbol: symbol,
        symbolCost: symbolCost,
        canBuy: canBuy
      };
      const offer = Effect.viewOf('shop.showOffer')
        .params(offerInfo);
      offers.push(offer);
      this.currentOffers[i] = offerInfo;
    }
    if (this.haveRefreshSymbol || this.refreshCount === 0) {
      const canRefresh = this._canBuySymbol({
        [this.refreshCostResource]: this.refreshCost
      });
      offers.push(Effect.viewOf('shop.showRefresh')
        .params({
          refreshCostResource: this.refreshCostResource,
          refreshCost: this.refreshCost,
          canRefresh: canRefresh
        }));
    }
    return Effect.serial(...offers, Effect.viewOf('shop.show').params());
  }
  close() {
    this.reset();
    this.currentOffers = {};
    return Effect.viewOf('shop.close').params();
  }
  attemptPurchase({ offerId }) {
    const offer = this.currentOffers[offerId];
    if (!this._canBuySymbol(offer.symbolCost)) {
      return Effect.none();
    }
    if (this.buyCount <= 0) {
      return Effect.none();
    }

    const effects = [];
    for (const [key, value] of Object.entries(offer.symbolCost)) {
      // TODO #REFACTOR, inventory should call and return event log effects.
      // effects.push(...game.eventlog.showResourceEarned(key, -value, Const.SHOPPING_CART));
      effects.push(this.inventory.addResource(key, -value));
    }
    effects.push(Effect.viewOf('shop.purchaseSuccess').params({offerId: offerId}));
    effects.push(offer.symbol.onBuy());
    this.buyCount--;
    if (this.buyCount === 0) {
      effects.push(Effect.viewOf('shop.close').params());
    }
    return Effect.serial(...effects);
  }
  attemptRefresh() {
    if (!this._canBuySymbol({
      [this.refreshCostResource]: this.refreshCost
    })) {
      return Effect.none();
    }
    const effects = [];
    effects.push(this.inventory.addResource({
      key: this.refreshCostResource,
      value: -this.refreshCost
    }));
    this.refreshCount++;
    this.refreshCost += this.refreshCostIncrease;
    this.refreshCost = Math.trunc(this.refreshCost * this.refreshCostMult);

    // We call ShopView.close, which does not reset the shop state, only visually closes it.
    effects.push(Effect.viewOf('shop.close').params());
    effects.push(this.open());
    return Effect.serial(...effects);
  }
  allowRefresh({_ctx, _params}) {
    this.haveRefreshSymbol = true;
  }

  // for (let i = 0; i < this.buyLines; ++i) {
  //   if (catalog.length === 0) {
  //     break;
  //   }
  //   const symbol = Util.randomRemove(catalog, /* shop= */ true);
  //   // Support for dynamically generated cost -- report the same value that is subtracted later.
  //   const symbolCost = symbol.cost();
  //   const shopItemDiv = this.makeShopItem(
  //     game,
  //     symbol,
  //     symbolCost,
  //     async (e) => {
  //       let canBuy = true;
  //       for (const [key, value] of Object.entries(symbolCost)) {
  //         if (game.inventory.getResource(key) < value) {
  //           canBuy = false;
  //           break;
  //         }
  //       }
  //       if (this.buyCount > 0 && canBuy) {
  //         this.buyCount--;
  //         for (const [key, value] of Object.entries(symbolCost)) {
  //           await Promise.all([
  //             game.eventlog.showResourceEarned(key, -value, Const.SHOPPING_CART),
  //             game.inventory.addResource(key, -value),
  //           ]);
  //         }
  //         await symbol.onBuy(game);
  //       } else if (!canBuy) {
  //         // Disable button.
  //         // This is not the best solution, we should disable the button
  //         // once we know the player doesn't have enough resources.
  //         e.target.disabled = true;
  //         return;
  //       }
  //       if (this.buyCount > 0) {
  //         const div = e.srcElement.parentElement.parentElement;
  //         await Util.animate(div, 'closeShop', 0.2);
  //         div.classList.add('hidden');
  //       }
  //       if (this.buyCount === 0) {
  //         await this.close(game);
  //       }
  //     }
  //   );
  //   this.shopDiv.appendChild(shopItemDiv);
  // }
  // // Refresh
  // if (this.haveRefreshSymbol || this.refreshCount === 0) {
  //   const shopItemDiv = this.makeShopItem(
  //     game,
  //     {
  //       emoji: () => '&nbsp;',
  //       description: () => '',
  //       descriptionLong: () => '',
  //     },
  //     { [this.refreshCostResource]: this.refreshCost },
  //     async (_) => {
  //       this.refreshCount++;
  //       if (
  //         game.inventory.getResource(this.refreshCostResource) >=
  //         this.refreshCost
  //       ) {
  //         await Promise.all([
  //           game.eventlog.showResourceEarned(
  //             this.refreshCostResource,
  //             -this.refreshCost,
  //             Const.REFRESH
  //           ),
  //           game.inventory.addResource(
  //             this.refreshCostResource,
  //             -this.refreshCost
  //           ),
  //         ]);
  //         this.refreshCost += this.refreshCostIncrease;
  //         this.refreshCost = Math.trunc(this.refreshCost * this.refreshCostMult);
  //         this.isOpen = false;
  //         await Util.animate(this.shopDiv, 'closeShop', 0.2);
  //         this.shopDiv.classList.add('hidden');
  //         await this.open(game);
  //       }
  //     },
  //     /*buttonText=*/ Const.REFRESH
  //   );
  //   this.shopDiv.appendChild(shopItemDiv);
  // }
  // await Util.animate(this.shopDiv, 'openShop', 0.4);
  _canBuySymbol(symbolCost) {
    if (this.buyCount <= 0) {
      return false;
    }
    let canBuy = true;
    for (const [key, value] of Object.entries(symbolCost)) {
      if (this.inventory.getResource(key) < value) {
        canBuy = false;
        break;
      }
    }
    return canBuy;
  }
  hide() {
    this.shopDiv.classList.add('hidden');
  }
  show() {
    if (this.buyCount > 0) {
      this.shopDiv.classList.remove('hidden');
    }
  }
  reset() {
    this.haveRefreshSymbol = false;
    this.refreshCost =
      Math.trunc(1 +
        this.inventory.getResource(this.refreshCostResource) *
          this.refreshCostInitialMult);
    this.refreshCount = 0;
    this.buyCount = 1;
    this.buyLines = 3;
  }
}
