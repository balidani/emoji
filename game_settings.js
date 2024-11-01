import * as Const from './consts.js';
import * as Utils from './util.js';

import { loadSettings } from './main.js';

const ALL_TESTED_SYMBOL_FILES = [
  './symbols/advanced.js',
  './symbols/animals.js',
  './symbols/food.js',
  './symbols/money.js',
  './symbols/music.js',
  './symbols/research.js',
  './symbols/rocks.js',
  './symbols/things.js',
  './symbols/ui.js',
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
    this.settingsDiv = document.querySelector('.game .settings');
    this.settingsOpener = document.querySelector('.open-settings');
    this.settingsOpener.addEventListener('click', (_) => {
      this.open();
    });

    this.isOpen = false;
    this.name = name || 'Default Game Settings';
    this.boardX = boardX || 5;
    this.boardY = boardY || 5;
    this.gameLength = gameLength || 50;
    this.enabledPackages = new Set([
      Const.PACK_BASE,
      Const.PACK_FARM,
      Const.PACK_ROCK,
    ]);
    this.startingSet = startingSetString || '🍒🍒🍒🪙🍀';
    this.initiallyLockedCells =
      initiallyLockedCells ||
      {
        // '2,2': { emoji: '🕹️', duration: -1 },
      };
    this.symbolSources = symbolSources || ALL_TESTED_SYMBOL_FILES;
    this.resultLookup = resultLookup || {
      100000: '👑',
      25000: '🏆',
      20000: '🥇',
      15000: '🥈',
      10000: '🥉',
    };
    this.textLookup = textLookup || {
      greeting:
        '💬: welcome to emoji slots. press anywhere on the board above when you are ready to play 🕹️',
      50: '💬: now you can add an emoji to your inventory. press ✅ to do that, refresh the shop 🔀, or roll again.',
      49: '💬: if you want to find out more about an emoji, tap on it. for example, try tapping here: 🌋.',
      48: '💬: you have 47 turns left. earn 💵 to get a trophy: 🥉, 🥈, 🥇, 🏆.',
      47: '💬: by the way, you can double tap the grid to skip animation.',
      46: '💬: you can unlock upgrades at the end of the game.',
      45: '💬: upgrades cost 🧬. you get 🧬 awarded if you earn at least 🥉.',
      44: '💬: you can also get 🧬 from some of the emoji, but these are only awarded if you earned a trophy.',
      43: '💬: the ultimate goal is to reach 💵100000 for the 👑 trophy. good luck!',
    };
  }

  async open(_) {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.settingsDiv = document.querySelector('.game .settings');
    this.settingsDiv.replaceChildren();

    // Create input elements
    const numRowsInput = Utils.createInput('# of Rows', 'number', this.boardX);
    const numColumnsInput = Utils.createInput(
      '# of Columns',
      'number',
      this.boardY
    );
    const gameLengthInput = Utils.createInput(
      'Game Length',
      'number',
      this.gameLength
    );
    const symbolSourcesInput = Utils.createInput(
      'Symbol Sources',
      'textarea',
      this.symbolSources.join('\n')
    );
    const startingSymbolsInput = Utils.createInput(
      'Starting Symbols',
      'text',
      this.startingSet
    );
    // Create buttons
    const cancelButton = Utils.createButton(
      'Cancel',
      async () => await this.close()
    );
    const saveButton = Utils.createButton('Save', () =>
      this.save(
        numRowsInput,
        numColumnsInput,
        gameLengthInput,
        symbolSourcesInput,
        startingSymbolsInput
      )
    );

    // Append elements to the settings div
    const settingsBoxDiv = document.createElement('div');
    settingsBoxDiv.classList.add('settings-box');
    settingsBoxDiv.append(numRowsInput.label, numRowsInput.input);
    settingsBoxDiv.append(numColumnsInput.label, numColumnsInput.input);
    settingsBoxDiv.append(gameLengthInput.label, gameLengthInput.input);
    settingsBoxDiv.append(symbolSourcesInput.label, symbolSourcesInput.input);
    settingsBoxDiv.append(
      startingSymbolsInput.label,
      startingSymbolsInput.input
    );
    settingsBoxDiv.append(cancelButton, saveButton);

    this.settingsDiv = document.querySelector('.game .settings');
    this.settingsDiv.append(settingsBoxDiv);
  }

  save(
    numRowsInput,
    numColsInput,
    gameLengthInput,
    symbolSourcesInput,
    startingSymbolsInput
  ) {
    this.boardX = numRowsInput.input.value;
    this.boardY = numColsInput.input.value;
    this.gameLength = gameLengthInput.input.value;
    this.symbolSources = symbolSourcesInput.input.value.split('\n');
    this.startingSet = startingSymbolsInput.input.value;
    this.close();
    loadSettings(this);
  }
  async close(_) {
    if (!this.isOpen) {
      return;
    }
    this.settingsDiv.replaceChildren();
    this.isOpen = false;
  }
}
