import * as Const from './consts.js';
import * as Util from './util.js';

import { Board } from './Board.js';
import { BoardView } from './BoardView.js';
import { Controller } from './Controller.js';
import { EventLog } from './eventlog.js';
import { Inventory } from './Inventory.js';
import { InventoryView } from './InventoryView.js';
import { loadListener } from './main.js'; // Semi-Circular import, but it works.
import { Shop } from './Shop.js';
import { ShopView } from './ShopView.js';

export class Game {
  constructor(progression, settings, catalog) {
    this.progression = progression;
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = new Inventory(this.settings, this.catalog);
    this.inventoryView = new InventoryView(this, this.inventory);
    this.board = new Board(this.settings, this.catalog, this.inventory);
    this.boardView = new BoardView(this, this.board);
    this.eventlog = new EventLog();
    this.shop = new Shop(this.catalog, this.inventory);
    this.shopView = new ShopView();

    const env = {
      model: {
        board: this.board,
        inventory: this.inventory,
        shop: this.shop,
      },
      view: {
        board: this.boardView,
        inventory: this.inventoryView,
        shop: this.shopView,
      }
    };
    this.controller = new Controller(env);
    this.shopView.setController(this.controller);

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

    // Build context
    const buildCtx = () => ({
      board: this.board.buildContext(),
      inventory: this.inventory.buildContext(),
    });
    const dispatch = async (effects) => {
      await this.controller.dispatch(buildCtx(), effects);
    };

    if (this.inventory.getResource(Const.TURNS) > 0) {
      await dispatch(this.inventory.addResource(
        { key: Const.LUCK, value: this.inventory.tempLuckBonus }));
      
      // TODO #REFACTOR, should this be inside Board?
      this.inventory.symbols.forEach((s) => s.reset());

      await dispatch(this.shop.close());
      await dispatch(this.board.roll(buildCtx()));
      await dispatch(this.inventory.evaluate(buildCtx()));
      await dispatch(this.inventory.score(buildCtx()));
      await dispatch(this.board.evaluateConsume(buildCtx()));
      await dispatch(this.board.evaluateProduce(buildCtx()));
      await dispatch(this.board.evaluateConsume(buildCtx()));
      await dispatch(this.board.increaseTurns(buildCtx()));
      await dispatch(this.board.score(buildCtx()));


      this.inventory.resetLuck();
    }

    if (this.inventory.getResource(Const.TURNS) === 0) {
      await this.over();
    } else {
      await dispatch(this.shop.open());
    }

    this.rolling = false;
    // this.eventlog.startHide();
  }
}
