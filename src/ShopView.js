export class ShopView {
  constructor(game, shop) {
    this.game = game;
    this.shop = shop;
    this.shopDiv = document.querySelector('.game .shop');
  }
  async handleViewEvent(effect) {
    switch (effect.type) {
      case 'shop.open':
        break;
      default:
        console.warn(`Unknown shop view event type: ${effect.type}`);
    }
  }

  makeShopItem(game, symbol, symbolCost, handler, buttonText = Const.BUY) {
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

    let canBuy = true;
    for (const [key, value] of Object.entries(symbolCost)) {
      if (game.inventory.getResource(key) < value) {
        canBuy = false;
        break;
      }
    }
    if (!canBuy) {
      buyButton.disabled = true;
    }

    buyButton.addEventListener('click', handler);
    // Only for simulator.
    buyButton.clickSim = handler;
    buyDiv.appendChild(buyButton);
    shopItemDiv.appendChild(buyDiv);
    return shopItemDiv;
  }
}
