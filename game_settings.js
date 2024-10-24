import * as Utils from './util.js';

import { loadSettings } from './main.js';

const ALL_TESTED_SYMBOL_FILES = ['./symbols/boss.js'];

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
    this.name = name || 'Boss Fight Prototype';
    this.boardX = boardX || 5;
    this.boardY = boardY || 5;
    this.gameLength = gameLength || 50;
    this.startingSet = startingSetString || '🧙‍♂️🪨🪨🌲';
    this.initiallyLockedCells = initiallyLockedCells || {
      '2,2': { emoji: '🧙‍♂️', duration: -1 },
    };
    this.symbolSources = symbolSources || ALL_TESTED_SYMBOL_FILES;
    this.resultLookup = resultLookup || {
      25000: '🏆',
      20000: '🥇',
      15000: '🥈',
      10000: '🥉',
    };
    this.textLookup = textLookup || {
      50: ' ',
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
