import * as Const from './consts.js';
import * as Util from './util.js';

import { Effect } from './Effect.js';

export class ShopView {
  constructor() {
    this.shopDiv = document.querySelector('.game .shop');
    this.dispatch = null;
  }
  setController(controller) {
    this.dispatch = (...args) => controller.dispatch(...args);
  }

  async showOffer({ offerId, symbol, symbolCost, canBuy }) {
    // Note that we are sending a model effect from a view handler.
    const buyHandler = (_) => {
      this.dispatch({}, Effect.modelOf('shop.attemptPurchase').params({ offerId }))
    };
    const shopItemDiv = this._makeShopItem(symbol, symbolCost, canBuy, buyHandler);
    shopItemDiv.id = `shop-offer-${offerId}`;
    this.shopDiv.appendChild(shopItemDiv);
  }
  async showRefresh({ refreshCostResource, refreshCost, canRefresh }) {
    const refreshHandler = (_) => {
      this.dispatch({}, Effect.modelOf('shop.attemptRefresh').params({}))
    };
    const refreshDiv = this._makeShopItem(
      {
        emoji: () => '&nbsp;',
        description: () => '',
        descriptionLong: () => '',
      },
      { [refreshCostResource]: refreshCost },
      canRefresh,
      refreshHandler,
      Const.REFRESH
    );
    // TODO #REFACTOR, Make the refreshDiv always last
    this.shopDiv.appendChild(refreshDiv);
  }

  async show() {
    this.shopDiv.classList.remove('hidden');
    await Util.animate(this.shopDiv, 'openShop', 0.2);
  }
 
  async close() {
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv.classList.add('hidden');
    this.shopDiv.replaceChildren();
  }

  async purchaseSuccess({ offerId }) {
    const shopItemDiv = document.getElementById(`shop-offer-${offerId}`);
    if (!shopItemDiv) {
      return;
    }
    await Util.animate(shopItemDiv, 'boughtShopItem', 0.2);
    shopItemDiv.remove();
  }

  _makeShopItem(symbol, symbolCost, canBuy, buyHandler, buttonText = Const.BUY) {
    const shopItemDiv = document.createElement('div');
    shopItemDiv.classList.add('shopItem');
    const symbolDiv = document.createElement('div');
    symbolDiv.classList.add('shopEmoji');
    symbolDiv.innerHTML = symbol.emoji();
    symbolDiv.addEventListener('click', () => {
      const interactiveDescription = Util.createInteractiveDescription(
        symbol.descriptionLong(),
        /*emoji=*/ symbol.emoji()
      );
      // TODO #REFACTOR
      Util.drawText(game.info, interactiveDescription, true);
    });
    shopItemDiv.appendChild(symbolDiv);

    const descriptionDiv = document.createElement('div');
    descriptionDiv.classList.add('description');
    descriptionDiv.innerHTML = Util.createInteractiveDescription(
      symbol.description()
    );
    shopItemDiv.appendChild(descriptionDiv);

    const costDiv = document.createElement('div');
    costDiv.classList.add('cost');
    for (const [key, value] of Object.entries(symbolCost)) {
      const resourceDiv = document.createElement('div');
      resourceDiv.innerHTML = key + Util.formatBigNumber(value);
      costDiv.appendChild(resourceDiv);
    }
    shopItemDiv.appendChild(costDiv);

    const buyDiv = document.createElement('div');
    buyDiv.classList.add('buy');
    const buyButton = document.createElement('button');
    buyButton.classList.add('buyButton');
    buyButton.innerText = buttonText;

    if (!canBuy) {
      buyButton.disabled = true;
    }

    buyButton.addEventListener('click', buyHandler);
    buyDiv.appendChild(buyButton);
    shopItemDiv.appendChild(buyDiv);
    return shopItemDiv;
  }
}
