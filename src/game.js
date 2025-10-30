import * as Const from './consts.js';
import * as Util from './util.js';

import { Board } from './Board.js';
import { BoardView } from './BoardView.js';
import { EventLog } from './eventlog.js';
import { Inventory } from './Inventory.js';
import { InventoryView } from './InventoryView.js';
import { loadListener } from './main.js'; // Semi-Circular import, but it works.
import { Shop } from './Shop.js';
import { ShopView } from './ShopView.js';
import { Ui } from './ui.js';

export class Game {
  constructor(progression, settings, catalog) {
    this.progression = progression;
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = new Inventory(this.settings, this.catalog);
    // TODO #REFACTOR, remove update() call
    this.inventory.update();
    this.inventoryView = new InventoryView(this, this.inventory);
    
    this.board = new Board(this.settings, this.catalog, this.inventory);
    this.boardView = new BoardView(this, this.board);
    this.eventlog = new EventLog();
    this.shop = new Shop(this.catalog, this.inventory);

    this.shopView = new ShopView(this);

    this.controller = new Controller({
      boardView: this.boardView,
      inventoryView: this.inventoryView,
      shopView: this.shopView,
    });

    // Consider using pubsub for intents?
    this.shopView.handlers = {
      onBuy: async (offerId) => {
        await this.controller.dispatchSequentialEffects(
          this.shop.attemptPurchase(offerId)
        );
      },
      onRefresh: async () => {
        await this.controller.dispatchSequentialEffects(
          this.shop.attemptRefresh()
        );
      }
    };

    this.rolling = false;
    this.info = document.querySelector('.game .info');
    this.progression.updateUi();
    this.isOver = false;
    if (settings.textLookup['greeting'] !== undefined) {
      Util.drawText(
        this.info,
        Util.createInteractiveDescription(settings.textLookup['greeting']),
        /* isHtml= */ true
      );
    }
    this.boardView.addClickListener(this);
  }
  async over() {
    this.isOver = true;
    document.querySelector('.game .grid').disabled = true;
    await this.board.finalScore(this);
    
    let trophy = '💩';
    const sortedKeys = Object.keys(this.settings.resultLookup).sort(
      (a, b) => b > a
    );
    sortedKeys.forEach((req) => {
      if (this.inventory.getResource(Const.MONEY) >= req) {
        trophy = this.settings.resultLookup[req];
        return;
      }
    });
    const scoreContainer = Util.createDiv('', 'scoreContainer');
    const scoreDiv = Util.createDiv(trophy, 'score');
    const scoreNumber = Util.formatBigNumber(this.inventory.getResource(Const.MONEY));
    const scoreText = `${Const.MONEY + scoreNumber}`;
    const scoreSubDiv = Util.createDiv('', 'finalScore');
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const letters = [...segmenter.segment(scoreText)].map(x => x.segment);
    scoreSubDiv.innerHTML = letters
      .map((char, i) => `<span style="animation-delay:${i * 0.25}s">${char}</span>`)
      .join('');
    scoreDiv.appendChild(scoreSubDiv);
    scoreContainer.appendChild(scoreDiv);

    this.board.clear(this);
    await this.boardView.clear();

    document.querySelector('.game').appendChild(scoreContainer);
    await Util.animate(scoreDiv, 'scoreIn', 0.65);

    // TODO: Remove loadListener and reset the board without having to recreate `Game`.
    document.querySelector('body').addEventListener('click', loadListener);
  }
  async roll() {
    if (this.isOver) {
      return;
    }
    if (this.rolling) {
      Util.animationOff();
      return;
    } else {
      Util.animationOn();
    }
    this.rolling = true;
    Util.deleteText(this.info);
    const textToDraw =
      this.settings.textLookup[this.inventory.getResource(Const.TURNS)];
    if (textToDraw) {
      Util.drawText(
        this.info,
        Util.createInteractiveDescription(textToDraw),
        /* isHtml= */ true
      );
    }

    if (this.inventory.getResource(Const.TURNS) > 0) {
      // TODO #REFACTOR, dispatch effect here
      await this.controller.dispatchSequentialEffects(
        this.inventory.addResource(Const.TURNS, -1)
      );
      // TODO #REFACTOR, should this be inside Board?
      this.inventory.symbols.forEach((s) => s.reset());

      await this.controller.dispatchSequentialEffects(
        this.shop.close(this)
      );

      // Build context
      const ctx = {
        board: this.board.buildContext(),
        inventory: this.inventory.buildContext(),
      };

      await this.controller.dispatchParallelEffects(
        this.board.roll()
      );
      await this.controller.dispatchSequentialEffects(
        this.board.evaluate(ctx)
      );
      await this.controller.dispatchSequentialEffects(
        this.board.score(ctx)
      );
      await this.controller.dispatchSequentialEffects(
        this.inventory.resetLuck()
      );
    }

    if (this.inventory.getResource(Const.TURNS) === 0) {
      await this.over();
    } else {
      await this.controller.dispatchParallelEffects(
        this.shop.open(this)
      );
    }

    this.rolling = false;
    // this.eventlog.startHide();
  }
}
