import * as Const from './consts.js';
import * as Util from './util.js';

import { Inventory } from './inventory.js';
import { loadListener } from './main.js'; // Semi-Circular import, but it works.
import { Shop } from './shop.js';

export class Game {
  constructor(progression, settings, catalog) {
    this.progression = progression;
    this.settings = settings;
    this.catalog = catalog;
    this.inventory = new Inventory(this.settings, this.catalog);
    this.inventory.update();
    this.shop = new Shop(this.catalog);
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
    const grid = document.querySelector('.game .grid');
    grid.addEventListener('click', () => this.roll());
  }
  async over() {
    console.log('Game over');
  }
  // async over() {
  //   this.isOver = true;
  //   document.querySelector('.game .grid').disabled = true;
  //   let trophy = '💩';
  //   const sortedKeys = Object.keys(this.settings.resultLookup).sort(
  //     (a, b) => b > a
  //   );
  //   sortedKeys.forEach((req) => {
  //     if (this.inventory.getResource(Const.MONEY) >= req) {
  //       trophy = this.settings.resultLookup[req];
  //       return;
  //     }
  //   });
  //   const scoreContainer = Util.createDiv('', 'scoreContainer');
  //   const scoreDiv = Util.createDiv('', 'score');
  //   scoreDiv.innerHTML = `${trophy}<br>${Const.MONEY + this.inventory.getResource(Const.MONEY)}`;
  //   scoreContainer.appendChild(scoreDiv);

  //   // await this.board.clear(this);
  //   document.querySelector('.game').appendChild(scoreContainer);
  //   await Util.animate(scoreDiv, 'scoreIn', 0.65);

  //   // TODO: Remove loadListener and reset the board without having to recreate `Game`.
  //   document.querySelector('body').addEventListener('click', loadListener);
  // }
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

    this.inventory.addResource(Const.TURNS, 1);
    //   // await this.board.evaluate(this);
    await this.shop.close(this);
    await this.shop.open(this);

    this.rolling = false;
  }
}
