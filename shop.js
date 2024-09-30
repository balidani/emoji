import * as Util from "./util.js"

export class Shop {
  constructor(catalog) {
    this.catalog = catalog;
    this.shopDiv = document.querySelector('.game .shop');
    this.isOpen = false;
    this.refreshCost = 1;
    this.refreshCount = 0;
    this.refreshable = false;
    this.buyCount = 1;
  }
  async open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;

    this.shopDiv.replaceChildren();
    const newCatalog = this.catalog.generateShop(
      3,
      game.inventory.lastLuckBonus
    );

    const makeShopItem = (
      symbol,
      symbolCost,
      handler,
      buttonText = '✅'
    ) => {
      const shopItemDiv = document.createElement('div');
      shopItemDiv.classList.add('shopItem');
      const symbolDiv = document.createElement('div');
      symbolDiv.classList.add('shopEmoji');
      symbolDiv.innerHTML = symbol.emoji();
      symbolDiv.addEventListener('click', () => {
        const interactiveDescription = Util.createInteractiveDescription(
          symbol.descriptionLong(), /*emoji=*/symbol.emoji());
        Util.drawText(game.info, interactiveDescription, true);
      });
      shopItemDiv.appendChild(symbolDiv);

      const descriptionDiv = document.createElement('div');
      descriptionDiv.classList.add('description');
      descriptionDiv.innerHTML = Util.createInteractiveDescription(symbol.description());
      shopItemDiv.appendChild(descriptionDiv);

      const costDiv = document.createElement('div');
      costDiv.classList.add('cost');

      if (symbolCost > 0) {
        costDiv.innerHTML = '💵' + symbolCost;
      }
      shopItemDiv.appendChild(costDiv);

      const buyDiv = document.createElement('div');
      buyDiv.classList.add('buy');
      const buyButton = document.createElement('button');
      buyButton.classList.add('buyButton');
      buyButton.innerText = buttonText;
      if (game.inventory.money < symbolCost) {
        buyButton.disabled = true;
      }
      buyButton.addEventListener('click', handler);
      buyDiv.appendChild(buyButton);
      shopItemDiv.appendChild(buyDiv);
      return shopItemDiv;
    };
    for (let i = 0; i < 3; ++i) {
      const symbol = Util.randomRemove(newCatalog);
      // Support for dynamically generated cost -- report the same value that is subtracted later.
      const symbolCost = symbol.cost();
      const shopItemDiv = makeShopItem(
        symbol,
        symbolCost,
        async (e) => {
          if (game.shop.buyCount > 0 && game.inventory.money > symbolCost) {
            game.shop.buyCount--;
            await Promise.all([
              game.board.showMoneyEarned(0, 0, -symbolCost),
              game.inventory.addMoney(-symbolCost),
            ]);
            game.inventory.add(symbol);
          }
          if (game.shop.buyCount > 0) {
            const div = e.srcElement.parentElement.parentElement;
            await Util.animate(div, 'closeShop', 0.2);
            div.classList.add('hidden');
          }
          if (game.shop.buyCount === 0) {
            await game.shop.close(game);
          }
        }
      );
      this.shopDiv.appendChild(shopItemDiv);
    }

    // Refresh
    if (game.shop.refreshable || game.shop.refreshCount === 0) {
      const shopItemDiv = makeShopItem(
        {
          emoji: () => '&nbsp;', description: () => '', descriptionLong: () => '',
        },
        this.refreshCost,
        async () => {
          game.shop.refreshCount++;
          if (game.inventory.money > this.refreshCost) {
            await Promise.all([
              game.board.showMoneyEarned(0, 0, -this.refreshCost),
              game.inventory.addMoney(-this.refreshCost),
            ]);
            this.refreshCost *= 2;
            this.isOpen = false;
            this.open(game);
          }
        },
        /*buttonText=*/'🔀'
      );
      this.shopDiv.appendChild(shopItemDiv);
    }

    await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close(game) {
    if (!this.isOpen) {
      return;
    }
    this.refreshable = false;
    this.refreshCost = (1 + game.inventory.money * 0.01) | 0;
    this.refreshCount = 0;

    this.buyCount = 1;
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv;
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }
}