import * as Const from './consts.js';
import * as Util from './util.js';

import { Board } from './board.js';
import { Inventory } from './inventory.js';
import { Shop } from './shop.js';
import { ResearchInventory } from './research_inventory.js';
import { ResearchShop } from './research_shop.js';

export class Game {
  constructor(progression, settings, catalog) {
    this.progression = progression;
    this.settings = settings;
    this.enabledPackages = settings.enabledPackages;
    this.catalog = catalog;
    this.inventory = new Inventory(this.settings, this.catalog);
    this.inventory.update();
    this.board = new Board(this);
    this.shop = new Shop(this.catalog);
    this.researchShop = new ResearchShop(this.catalog);
    this.researchInventory = new ResearchInventory(this.settings, this.catalog);
    this.rolling = false;
    this.info = document.querySelector('.game .info');
    this.progression.updateUi();
    if (settings.textLookup['greeting'] !== undefined) {
      Util.drawText(this.info, settings.textLookup['greeting']);
    }
    const grid = document.querySelector('.game .grid');
    grid.addEventListener('click', () => this.roll());
  }
  async over() {
    await this.board.finalScore(this);

    // Display trophy.
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
    const scoreDiv = Util.createDiv('', 'score');
    scoreDiv.innerHTML = `${trophy}<br>${Const.MONEY + this.inventory.getResource(Const.MONEY)}`;
    scoreContainer.appendChild(scoreDiv);

    await this.board.clear(this);
    document.querySelector('.game').appendChild(scoreContainer);
    await Util.animate(scoreDiv, 'scoreIn', 0.65);

    // Update info text.
    let infoText = '💬: ';
    if (trophy === '💩') {
      infoText +=
        "game over. you did not make it to a medal, so you don't gain 🧬 this time.";
    } else {
      infoText += 'you won! you can spend your 🧬 on upgrades.';
    }
    infoText += ' click the board to play again.';
    Util.drawText(this.info, infoText);

    // Replace inventory with the permanent "research" version.
    this.inventory.symbols = [];
    this.inventory.update();
    if (trophy !== '💩') {
      this.researchInventory.addResource(
        Const.RESEARCH_POINT,
        this.inventory.getResource(Const.RESEARCH_POINT)
      );
    }
    this.researchInventory.updateUi();

    // Open research shop.
    this.researchShop.open(this);
  }
  async roll() {
    // Remove previous score.
    const scoreDiv = document.querySelector('.game .scoreContainer .score');
    if (scoreDiv !== null) {
      // Reset inventory.
      this.inventory.reset();
      this.inventory.update();
      this.inventory.updateUi();
      // Reset shop
      this.shop.reset(this);
      await Util.animate(scoreDiv, 'scoreOut', 0.65);
      document.querySelector('.game .scoreContainer')?.remove();
    }
    if (this.researchShop.isOpen) {
      await this.researchShop.close(this);
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
      Util.drawText(this.info, textToDraw);
    }

    if (this.inventory.getResource(Const.TURNS) > 0) {
      await this.inventory.addResource(Const.TURNS, -1);
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      this.inventory.resetLuck();
    }

    if (this.inventory.getResource(Const.TURNS) === 0) {
      await this.over();
    } else {
      await this.shop.open(this);
    }

    this.rolling = false;
  }
}
