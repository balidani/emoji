import { formatBigNumber, createInteractiveDescription } from '../core/util.js';
import { animate } from './animations.js';

// The shop item DOM, extracted from shop.js (see REFACTOR_PLAN.md, Phase 7).
// Offers carry their own onBuy callback (a closure Shop built over `game` and
// the offer's id), matching the original code's per-offer closure design --
// this view never needs a reference to `game` or `Shop` itself, only
// `showInfo` for the click-to-info behavior on each offer's emoji.
export class ShopView {
  constructor(showInfo) {
    this.shopDiv = document.querySelector('.game .shop');
    this.showInfo = showInfo;
    this.offerDivs = {};
  }

  makeShopItemDiv(emoji, description, cost, canBuy, buttonText, onBuy) {
    const shopItemDiv = document.createElement('div');
    shopItemDiv.classList.add('shopItem');
    const symbolDiv = document.createElement('div');
    symbolDiv.classList.add('shopEmoji');
    symbolDiv.innerHTML = emoji;
    symbolDiv.addEventListener('click', () => {
      this.showInfo(createInteractiveDescription(description, emoji));
    });
    shopItemDiv.appendChild(symbolDiv);

    const descriptionDiv = document.createElement('div');
    descriptionDiv.classList.add('description');
    descriptionDiv.innerHTML = createInteractiveDescription(description);
    shopItemDiv.appendChild(descriptionDiv);

    const costDiv = document.createElement('div');
    costDiv.classList.add('cost');
    for (const [key, value] of Object.entries(cost)) {
      const resourceDiv = document.createElement('div');
      resourceDiv.innerHTML = key + formatBigNumber(value);
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
    buyButton.addEventListener('click', onBuy);
    // Only for simulator.
    buyButton.clickSim = onBuy;
    buyDiv.appendChild(buyButton);
    shopItemDiv.appendChild(buyDiv);
    return shopItemDiv;
  }

  async renderShop(offers, refreshOffer) {
    this.shopDiv.classList.remove('hidden');
    this.shopDiv.replaceChildren();
    this.offerDivs = {};
    for (const offer of offers) {
      const itemDiv = this.makeShopItemDiv(
        offer.emoji,
        offer.description,
        offer.cost,
        offer.canBuy,
        offer.buttonText,
        offer.onBuy
      );
      this.offerDivs[offer.id] = itemDiv;
      this.shopDiv.appendChild(itemDiv);
    }
    if (refreshOffer) {
      const itemDiv = this.makeShopItemDiv(
        '&nbsp;',
        '',
        refreshOffer.cost,
        refreshOffer.canBuy,
        refreshOffer.buttonText,
        refreshOffer.onBuy
      );
      this.shopDiv.appendChild(itemDiv);
    }
    await animate(this.shopDiv, 'openShop', 0.4);
  }

  async markOfferBought(offerId) {
    const div = this.offerDivs[offerId];
    if (!div) {
      return;
    }
    await animate(div, 'closeShop', 0.2);
    div.classList.add('hidden');
  }

  async disableOffer(offerId) {
    const div = this.offerDivs[offerId];
    const button = div && div.querySelector('.buyButton');
    if (button) {
      button.disabled = true;
    }
  }

  async closeShop() {
    await animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv.classList.add('hidden');
    this.shopDiv.replaceChildren();
  }

  hideShop() {
    this.shopDiv.classList.add('hidden');
  }

  showShop() {
    this.shopDiv.classList.remove('hidden');
  }
}
