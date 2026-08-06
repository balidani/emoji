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
  // main.js <-> game.js circular import.
  constructor(
    progression,
    settings,
    catalog,
    renderer = new DomRenderer(),
    onGameOver,
    // Set by the replay driver (see replay.js) on the Game it constructs.
    // Guards every persistence side effect below (profile stats,
    // achievements, save data) so running a replay never touches the
    // player's real progress -- has to be known from construction time,
    // since Achievements itself persists unlocks as they happen, not just
    // at game over.
    isReplay = false
  ) {
    this.progression = progression;
    this.settings = settings;
    this.catalog = catalog;
    // Renderer port, used by every subsystem.
    this.view = renderer;
    this.onGameOver = onGameOver;
    this.isReplay = isReplay;
    // Separate from isReplay (which permanently guards persistence for the
    // lifetime of this Game -- see above): this one flips off partway
    // through, once runReplay() finishes driving the scripted event list
    // and hands control back to the player with turns still left (see
    // stopReplayDriving() and roll() below). Kept distinct so that handoff
    // doesn't also turn persistence back on.
    this.replayDriving = isReplay;
    this.inventory = new Inventory(this.settings, this.catalog, this.view);
    this.inventory.update();
    this.profileStats = new ProfileStats(loadProfile());
    this.stats = new Stats(this.profileStats);
    this.inventory.stats = this.stats;
    this.achievements = new Achievements(this.view, this.isReplay);
    this.board = new Board(this);
    this.eventlog = new EventLog(this.view);
    this.shop = new Shop(this.catalog, this.view);
    // Passive replay recorder (see replay.js); attached by bootstrap.js
    // right after construction, so no action can fire before it's set.
    this.recorder = null;
    this.rolling = false;
    // Tracks whether the progression bar under the board has already been
    // faded out for this round (see roll()) -- only ever fires once, on the
    // first roll.
    this.hasRolled = false;
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
  // Called by runReplay() once the scripted event list has played out and
  // turns remain, so this Game keeps going under the player's own input.
  // Lets roll() (below) resume resetting animation to "on" at the start of
  // every fresh roll, same as a live game -- without this, a replay
  // continuation that's ever skipped one roll's animation (tap during
  // rolling) would stay stuck skipping every roll after it forever, since
  // isReplay itself never flips back (persistence has to stay off for the
  // rest of this Game's life).
  stopReplayDriving() {
    this.replayDriving = false;
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
    if (!this.isReplay) {
      this.profileStats.gamesPlayed += 1;
    }
    this.achievements?.evaluate({
      event: 'gameover',
      finalScore: this.inventory.getResource(Const.MONEY),
      stats: this.stats,
      inventory: this.inventory,
    });
    // Everything this run satisfied, including achievements already
    // unlocked from a previous run -- earning one again is still worth
    // showing in the popup below, not just brand-new unlocks. (Achievements
    // itself skips persisting unlocks when isReplay -- this is display-only.)
    const earnedThisRun = this.achievements?.completedThisRun ?? [];
    // Refresh the sidebar panel right away so it's current whether or not
    // it's open right now (bootstrap.js also re-renders it on open).
    this.achievements?.renderPanel();
    if (!this.isReplay) {
      saveProfile(this.profileStats);
      // Progression-mode bag unlock gate; no-op in Sandbox mode (see
      // Progression.checkGateAndRollOffer). Guarded by isReplay so a
      // continued replay -- non-canonical by definition -- never grants a
      // progression unlock, same as it earns no achievements above.
      this.progression.checkGateAndRollOffer(
        this.inventory.getResource(Const.MONEY)
      );
    }
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
    } else if (!this.replayDriving) {
      // A replay drives itself, not the player -- leave animation exactly
      // as runReplay() set it (off, so a many-turn game finishes in
      // seconds instead of playing out in real time) rather than
      // re-enabling it on every roll like a live game does. Once
      // stopReplayDriving() has run (see there), this is true again even
      // for an isReplay Game, same as a live one.
      Util.animationOn();
    }
    this.rolling = true;
    if (!this.hasRolled) {
      this.hasRolled = true;
      // Declutter the board once play actually starts -- the bar already
      // did its job (showing where the run stands) before this roll; it
      // reappears fresh on the game-over screen and the next round's own
      // (freshly built, unfaded) element.
      document.querySelector('.game .progression-bar')?.classList.add('faded');
    }
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
      this.recorder?.recordRoll();
      await this.inventory.addResource(Const.TURNS, -1);
      this.inventory.symbols.forEach((s) => s.reset());
      await this.shop.close(this);
      await this.board.roll(this);
      await this.board.transformWildcards(this);
      await this.board.evaluate(this);
      await this.board.score(this);
      await this.board.revertWildcards(this);
      this.inventory.resetLuck();
      this.stats?.recordTurn();
      this.stats?.recordInventorySize(this.inventory.symbols.length);
      this.stats?.recordLuck(this.inventory.getResource(Const.LUCK));
      this.stats?.recordUniqueSymbols(
        new Set(this.inventory.symbols.map((s) => s.emoji())).size
      );
      this.stats?.recordRows(this.board.currentRows);
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
