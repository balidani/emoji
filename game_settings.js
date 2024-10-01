import * as Utils from './util.js';

import { loadSettings } from './main.js';

const ALL_TESTED_SYMBOL_FILES = [
  './symbols/advanced.js',
  './symbols/animals.js',
  './symbols/food.js',
  './symbols/money.js',
  './symbols/music.js',
  './symbols/rocks.js',
  './symbols/things.js',
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
    textLookup
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
    this.startingSet = startingSetString || '🍒🍒🍒🪙🍀';
    this.symbolSources = symbolSources || ALL_TESTED_SYMBOL_FILES;
    this.resultLookup = resultLookup || {
      // NOTE: These temporarily are assumed to be sorted such that the hardest score is first.
      25000: '🏆',
      20000: '🥇',
      15000: '🥈',
      10000: '🥉',
    };
    this.textLookup = textLookup || {
      50: 'you can add a symbol to your inventory. press (✅) to do that, refresh the shop (🔀), or roll again.',
      49: 'you have 48 turns left. earn 💵10000 for 🥉, 💵15000 for 🥈, 💵20000 for 🥇, 💵25000 for 🏆. good luck!',
      48: 'you can double tap the roll (🕹️) button to skip animation.',
      47: 'you can tap on any symbol, on the board or in the shop, to get more information.',
    };
  }

  async open(_game) {
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
  async close(_game) {
    if (!this.isOpen) {
      return;
    }
    this.settingsDiv.replaceChildren();
    this.isOpen = false;
  }
}
