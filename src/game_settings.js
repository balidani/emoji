import { MEDAL_TIERS } from './symbols/ui.js';

const ALL_TESTED_SYMBOL_FILES = [
  './symbols/advanced.js',
  './symbols/animals.js',
  './symbols/food.js',
  './symbols/money.js',
  './symbols/music.js',
  './symbols/rocks.js',
  './symbols/things.js',
  './symbols/tools.js',
  './symbols/ui.js',
  './extra-symbols/beta.js',
];

export class GameSettings {
  static settings = null;
  static instance() {
    if (GameSettings.settings === null) {
      GameSettings.settings = new GameSettings();
    }
    return GameSettings.settings;
  }

  constructor(
    name,
    boardX,
    boardY,
    gameLength,
    startingSetString,
    symbolSources,
    resultLookup,
    textLookup,
    initiallyLockedCells
  ) {
    this.isOpen = false;
    this.name = name || 'Default Game Settings';
    this.boardX = boardX || 5;
    this.boardY = boardY || 5;
    this.gameLength = gameLength || 50;
    // '🎈🏦🔔💼🐛🎯🧈🍾🍒🐣🐔🍀🍹🪙🌽💳🔮💃💎🎲🐉🥁🥚💸🥠🦊🧊🫙🪄💰🌝❎🍍🍿📀🔀🪨🚀🎰🧵🌳🌋👷📮'
    this.startingSet = startingSetString || '🍒🍒🍒🪙🍀🔀';
    this.initiallyLockedCells =
      initiallyLockedCells ||
      {
        // '2,2': { emoji: '🕹️', duration: -1 },
      };
    this.symbolSources = symbolSources || ALL_TESTED_SYMBOL_FILES;
    // Derived from the medal/trophy classes (symbols/ui.js) so thresholds
    // live in exactly one place -- see ACHIEVEMENTS_DESIGN.md section 7.
    // Numeric-string keys iterate in ascending order regardless of
    // insertion order, so where GoatMedal sits in MEDAL_TIERS doesn't matter.
    this.resultLookup = resultLookup || {
      5000: '😞',
      ...Object.fromEntries(MEDAL_TIERS.map((M) => [M.threshold, M.emoji])),
    };
    this.textLookup = textLookup || {
      greeting:
        '💬: welcome to emoji slots. press anywhere on the board above when you are ready to play (🕹️)',
      50: '💬: now you can add a symbol to your inventory. press (✅) to do that, refresh the shop (🔀), or roll again by pressing on the board above',
      49: '💬: if you want to find out more about a symbol, tap on it. for example, try tapping here: 🌋',
      48: '💬: you have 47 turns left. earn enough 💵 to get a trophy: 🥉, 🥈, 🥇, 🏆, 👑',
      47: '💬: you can double tap the grid to skip animation',
      46: '💬: you can tap on any symbol in the shop and in your inventory to get more information',
    };
  }

  // Called once per instance to wire it to a SettingsView + the reload
  // callback. tutorialLevelSettings and standardGameSettings (progression.js)
  // both call this with the same SettingsView, preserving the original quirk
  // where each instance's own click listener fires on the shared
  // .open-settings button.
  attachView(view, reload) {
    this.view = view;
    this.reload = reload;
    this.view.registerOpener(() => this.open());
  }

  async open(_) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.view.render(
      {
        boardX: this.boardX,
        boardY: this.boardY,
        gameLength: this.gameLength,
        symbolSources: this.symbolSources,
        startingSet: this.startingSet,
      },
      {
        onSave: (values) => this.save(values),
        onCancel: async () => await this.close(),
      }
    );
  }

  save(values) {
    this.boardX = values.boardX;
    this.boardY = values.boardY;
    this.gameLength = values.gameLength;
    this.symbolSources = values.symbolSources;
    this.startingSet = values.startingSet;
    this.close();
    this.reload(this);
  }

  async close(_) {
    if (!this.isOpen) {
      return;
    }
    this.view.close();
    this.isOpen = false;
  }
}
