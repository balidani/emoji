import * as Const from './consts.js';
import * as Util from './util.js';

export class Shop {
  constructor(catalog) {
    this.catalog = catalog;
    this.shopDiv = document.querySelector('.game .shop');
    this.isOpen = false;
    this.refreshCost = 1;
    this.refreshCount = 0;
    this.allowRefresh = true;
    this.haveRefreshSymbol = false;
    this.buyCount = 1;
    this.refreshCostResource = Const.MONEY;
    this.refreshCostIncrease = 0;
    this.refreshCostMult = 2;
    this.refreshCostInitialMult = 0.01;
    this.firstTurnRare = false;
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
      resourceDiv.innerHTML = key + value;
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
      if (this.getInventory(game).getResource(key) < value) {
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
  makeCatalog(game) {
    const rareOnly =
      (game.inventory.getResource(Const.TURNS) ===
        game.settings.gameLength - 1) && this.firstTurnRare;
    return this.catalog.generateShop(
      3,
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
    this.shopDiv.replaceChildren();
    const catalog = this.makeCatalog(game);
    for (let i = 0; i < 3; ++i) {
      if (catalog.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(catalog);
      // Support for dynamically generated cost -- report the same value that is subtracted later.
      const symbolCost = symbol.cost();
      const shopItemDiv = this.makeShopItem(
        game,
        symbol,
        symbolCost,
        async (e) => {
          let canBuy = true;
          for (const [key, value] of Object.entries(symbolCost)) {
            if (this.getInventory(game).getResource(key) < value) {
              canBuy = false;
              break;
            }
          }
          if (this.buyCount > 0 && canBuy) {
            this.buyCount--;
            for (const [key, value] of Object.entries(symbolCost)) {
              await Promise.all([
                game.board.showResourceEarned(key, -value),
                this.getInventory(game).addResource(key, -value),
              ]);
            }
            this.getInventory(game).add(symbol);
            symbol.onBuy(game);
          } else if (!canBuy) {
            // Disable button.
            // This is not the best solution, we should disable the button
            // once we know the player doesn't have enough resources.
            e.target.disabled = true;
            return;
          }
          if (this.buyCount > 0) {
            const div = e.srcElement.parentElement.parentElement;
            await Util.animate(div, 'closeShop', 0.2);
            div.classList.add('hidden');
          }
          if (this.buyCount === 0) {
            await this.close(game);
          }
        }
      );
      this.shopDiv.appendChild(shopItemDiv);
    }
    // Refresh
    if (
      this.allowRefresh &&
      (this.haveRefreshSymbol || this.refreshCount === 0)
    ) {
      const shopItemDiv = this.makeShopItem(
        game,
        {
          emoji: () => '&nbsp;',
          description: () => '',
          descriptionLong: () => '',
        },
        { [this.refreshCostResource]: this.refreshCost },
        async (_) => {
          this.refreshCount++;
          if (
            this.getInventory(game).getResource(this.refreshCostResource) >=
            this.refreshCost
          ) {
            await Promise.all([
              game.board.showResourceEarned(
                this.refreshCostResource,
                -this.refreshCost
              ),
              this.getInventory(game).addResource(
                this.refreshCostResource,
                -this.refreshCost
              ),
            ]);
            this.refreshCost += this.refreshCostIncrease;
            this.refreshCost *= this.refreshCostMult;
            this.isOpen = false;
            await this.open(game);
          }
        },
        /*buttonText=*/ Const.REFRESH
      );
      this.shopDiv.appendChild(shopItemDiv);
    }
    await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close(game) {
    if (!this.isOpen) {
      return;
    }
    this.reset(game);
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }
  reset(game) {
    this.haveRefreshSymbol = false;
    this.refreshCost =
      (1 +
        this.getInventory(game).getResource(this.refreshCostResource) *
          this.refreshCostInitialMult) |
      0;
    this.refreshCount = 0;
    this.buyCount = 1;
  }
}
