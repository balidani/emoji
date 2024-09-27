import { Inventory } from './inventory.js';
import { Board } from "./board.js";
import { Shop } from "./shop.js";
import * as Util from "./util.js"
import { loadListener } from './main.js';   // Semi-Circular import, but it works.

export class Game {
  constructor(progression, gameSettings, catalog) {
    this.progression = progression;
    this.gameSettings = gameSettings;
    this.catalog = catalog;
    this.inventory = new Inventory(
      this.gameSettings.gameLength,
      this.catalog.symbolsFromString(this.gameSettings.startingSet)
    );
    this.inventory.update();
    this.board = new Board(this.gameSettings, this.catalog);
    this.shop = new Shop(this.catalog);
    this.rolling = false;
    this.info = document.querySelector('.game .info');
    Util.drawText(
      this.info,
      'hi there. press (🕹️) when you are ready to play.'
    );
    document
      .querySelector('.game .roll')
      .addEventListener('click', () => this.roll());
    console.log(this);
  }
  async over() {
    document.querySelector('.game .roll').disabled = true;
    await this.board.finalScore(this);
    const blurDiv = document.querySelector('.game .blur-me');
    // blurDiv.classList.add('blur');
    // await Util.animate(blurDiv, 'blurStart', 0.6);
    {
      const scoreContainer = document.createElement('div');
      scoreContainer.classList.add('scoreContainer');
      const scoreDiv = document.createElement('div');
      scoreDiv.classList.add('score');
      scoreDiv.innerText = '💵' + this.inventory.money;
      scoreContainer.appendChild(scoreDiv);
      document.querySelector('.game').appendChild(scoreContainer);
      await Util.animate(scoreDiv, 'scoreIn', 0.4);
    }
    let trophy = '💩';
    for (const [requirement, reward] of this.gameSettings.resultLookup) {
      if (this.inventory.money >= requirement) {
        trophy = reward;
        break;
      }
    }
    {
      this.progression.postResultAndAdvance(this.inventory.money, trophy);
      const trophyContainer = document.createElement('div');
      trophyContainer.classList.add('scoreContainer');
      const trophyDiv = document.createElement('div');
      trophyDiv.classList.add('trophy');
      trophyDiv.innerText = trophy;
      trophyContainer.appendChild(trophyDiv);
      document.querySelector('.game').appendChild(trophyContainer);
      await Util.animate(trophyDiv, 'scoreIn', 0.4);
    }
    document.querySelector('body').addEventListener('click', loadListener);
  }
  async roll() {
    if (this.rolling) {
      Util.animationOff();
      return;
    } else {
      Util.animationOn();
    }
    this.rolling = true;

    Util.deleteText(this.info);

    const textToDraw = this.gameSettings.textLookup[this.inventory.turns];

    if (textToDraw) {
      Util.drawText(this.info, textToDraw);
    }

    if (this.inventory.money > 0) {
      this.inventory.turns--;
      this.inventory.updateUi();
      this.inventory.addMoney(-1);
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      this.inventory.resetLuck();
    } else {
      // Handle the case where player ran out of money
    }
    if (this.inventory.turns === 0) {
      await this.over();
    } else {
      await this.shop.open(this);
    }

    this.rolling = false;
  }
}