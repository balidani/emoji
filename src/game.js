import * as Const from './consts.js';
import * as Util from './util.js';

import { Board } from './board.js';
import { EventLog } from './eventlog.js';
import { Inventory } from './inventory.js';
import { Shop } from './shop.js';
import { DomRenderer } from './render/DomRenderer.js';
import { Stats, ProfileStats } from './stats.js';
import { Achievements } from './achievements.js';
import { loadProfile, saveProfile } from './achievements-store.js';

export class Game {
  // onGameOver: called (as a body click listener) once the final-score
  // screen is showing, to reset into the next game. Injected by the caller
  // (main.js's loadListener) instead of imported directly, to break the
  // main.js <-> game.js circular import (REFACTOR_PLAN.md, Phase 9).
  constructor(
    progression,
    settings,
    catalog,
    renderer = new DomRenderer(),
    onGameOver
  ) {
    this.progression = progression;
    this.settings = settings;
    this.catalog = catalog;
    // Renderer port (see REFACTOR_PLAN.md, Phase 3), now used by every
    // subsystem as of Phase 7.
    this.view = renderer;
    this.onGameOver = onGameOver;
    this.inventory = new Inventory(this.settings, this.catalog, this.view);
    this.inventory.update();
    this.profileStats = new ProfileStats(loadProfile());
    this.stats = new Stats(this.profileStats);
    this.inventory.stats = this.stats;
    this.achievements = new Achievements(this.view);
    this.board = new Board(this);
    this.eventlog = new EventLog(this.view);
    this.shop = new Shop(this.catalog, this.view);
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
    this.board.addClickListener(this);
  }
  async over() {
    this.isOver = true;
    await this.view.setGridEnabled(false);
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
    this.profileStats.gamesPlayed += 1;
    this.achievements?.evaluate({
      event: 'gameover',
      finalScore: this.inventory.getResource(Const.MONEY),
      stats: this.stats,
      inventory: this.inventory,
    });
    // Everything this run satisfied, including achievements already
    // unlocked from a previous run -- earning one again is still worth
    // showing in the popup below, not just brand-new unlocks.
    const earnedThisRun = this.achievements?.completedThisRun ?? [];
    // Refresh the sidebar panel right away so it's current whether or not
    // it's open right now (bootstrap.js also re-renders it on open).
    this.achievements?.renderPanel();
    saveProfile(this.profileStats);
    const scoreContainer = Util.createDiv('', 'scoreContainer');
    const scoreDiv = Util.createDiv(trophy, 'score');
    const scoreNumber = Util.formatBigNumber(
      this.inventory.getResource(Const.MONEY)
    );
    const scoreText = `${Const.MONEY + scoreNumber}`;
    const scoreSubDiv = Util.createDiv('', 'finalScore');
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    const letters = [...segmenter.segment(scoreText)].map((x) => x.segment);
    scoreSubDiv.innerHTML = letters
      .map(
        (char, i) => `<span style="animation-delay:${i * 0.25}s">${char}</span>`
      )
      .join('');
    scoreDiv.appendChild(scoreSubDiv);
    scoreContainer.appendChild(scoreDiv);

    let achievementPopup = null;
    if (earnedThisRun.length > 0) {
      achievementPopup = Util.createDiv('', 'achievementPopup');
      for (const def of earnedThisRun) {
        const entry = Util.createDiv('', 'achievementPopupEntry');
        entry.appendChild(Util.createSpan(def.icon, 'achievementPopupIcon'));
        entry.appendChild(Util.createSpan(def.name, 'achievementPopupName'));
        achievementPopup.appendChild(entry);
      }
      scoreContainer.appendChild(achievementPopup);
    }

    await this.board.clear(this);
    document.querySelector('.game').appendChild(scoreContainer);
    await Util.animate(scoreDiv, 'scoreIn', 0.65);
    if (achievementPopup) {
      await Util.animate(achievementPopup, 'achievementPopIn', 0.5);
    }

    // TODO: Remove onGameOver and reset the board without having to recreate `Game`.
    document.querySelector('body').addEventListener('click', this.onGameOver);
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
      await this.inventory.addResource(Const.TURNS, -1);
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      this.inventory.resetLuck();
      this.stats?.recordTurn();
      this.stats?.recordInventorySize(this.inventory.symbols.length);
      this.stats?.recordLuck(this.inventory.getResource(Const.LUCK));
      this.stats?.recordUniqueSymbols(
        new Set(this.inventory.symbols.map((s) => s.emoji())).size
      );
      this.achievements?.evaluate({
        event: 'roll',
        stats: this.stats,
        inventory: this.inventory,
      });
    }

    if (this.inventory.getResource(Const.TURNS) === 0) {
      await this.over();
    } else {
      await this.shop.open(this);
    }

    this.rolling = false;
    // this.eventlog.startHide();
  }
}
