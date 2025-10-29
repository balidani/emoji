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
    this.buyLines = 3;
    this.refreshCostResource = Const.MONEY;
    this.refreshCostIncrease = 1;
    this.refreshCostMult = 1.5;
    this.refreshCostInitialMult = 0.01;
    this.firstTurnRare = false;
  }
  
  makeCatalog(game) {
    const rareOnly =
      (game.inventory.getResource(Const.TURNS) ===
        game.settings.gameLength - 1) && this.firstTurnRare;
    return this.catalog.generateShop(
      this.buyLines,
      game.inventory.getResource(Const.LUCK),
      /* rareOnly= */ rareOnly
    );
  }
  open(game) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    // this.shopDiv.classList.remove('hidden');
    // this.shopDiv.replaceChildren();
    const catalog = this.makeCatalog(game);

    const offers = [];
    for (let i = 0; i < this.buyLines; ++i) {
      if (catalog.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(catalog, /* shop= */ true);
      const symbolCost = symbol.cost();

      // TODO: Create list of offers with all state needed to render shop, for example:
      // symbol, cost, canBuy. Pass this to the view for rendering.
      // const canBuy = this.canBuySymbol(game, symbolCost);
      // Do it for refresh too.
    }

    for (let i = 0; i < this.buyLines; ++i) {
      if (catalog.length === 0) {
        break;
      }
      const symbol = Util.randomRemove(catalog, /* shop= */ true);
      // Support for dynamically generated cost -- report the same value that is subtracted later.
      const symbolCost = symbol.cost();
      const shopItemDiv = this.makeShopItem(
        game,
        symbol,
        symbolCost,
        async (e) => {
          let canBuy = true;
          for (const [key, value] of Object.entries(symbolCost)) {
            if (game.inventory.getResource(key) < value) {
              canBuy = false;
              break;
            }
          }
          if (this.buyCount > 0 && canBuy) {
            this.buyCount--;
            for (const [key, value] of Object.entries(symbolCost)) {
              await Promise.all([
                game.eventlog.showResourceEarned(key, -value, Const.SHOPPING_CART),
                game.inventory.addResource(key, -value),
              ]);
            }
            await symbol.onBuy(game);
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
            game.inventory.getResource(this.refreshCostResource) >=
            this.refreshCost
          ) {
            await Promise.all([
              game.eventlog.showResourceEarned(
                this.refreshCostResource,
                -this.refreshCost,
                Const.REFRESH
              ),
              game.inventory.addResource(
                this.refreshCostResource,
                -this.refreshCost
              ),
            ]);
            this.refreshCost += this.refreshCostIncrease;
            this.refreshCost = Math.trunc(this.refreshCost * this.refreshCostMult);
            this.isOpen = false;
            await Util.animate(this.shopDiv, 'closeShop', 0.2);
            this.shopDiv.classList.add('hidden');
            await this.open(game);
          }
        },
        /*buttonText=*/ Const.REFRESH
      );
      this.shopDiv.appendChild(shopItemDiv);
    }

    return [{type: 'shop.open', offers: offers}];
    // await Util.animate(this.shopDiv, 'openShop', 0.4);
  }
  async close(game) {
    if (!this.isOpen) {
      return;
    }
    this.reset(game);
    await Util.animate(this.shopDiv, 'closeShop', 0.2);
    this.shopDiv.classList.add('hidden');
    this.shopDiv.replaceChildren();
    this.isOpen = false;
  }
  hide() {
    this.shopDiv.classList.add('hidden');
  }
  show() {
    if (this.buyCount > 0) {
      this.shopDiv.classList.remove('hidden');
    }
  }
  reset(game) {
    this.haveRefreshSymbol = false;
    this.refreshCost =
      Math.trunc(1 +
        game.inventory.getResource(this.refreshCostResource) *
          this.refreshCostInitialMult);
    this.refreshCount = 0;
    this.buyCount = 1;
    this.buyLines = 3;
  }
}
