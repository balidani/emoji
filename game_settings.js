import * as Utils from "./util.js"

export class GameSettings {
    static loadFn;

    constructor() {
        this.settingsDiv = document.querySelector('.game .settings');
        this.settingsOpener = document.querySelector('.open-settings');

        this.settingsOpener.addEventListener('click', (_) => {
            this.open()
        })

        this.isOpen = false;
        this.boardX = 5;
        this.boardY = 5;
        this.gameLength = 50;
        this.startingSet = "🍒🍒🍒🪙🍀"
        this.symbolSources = ['./symbol.js']
    }

    async open(game) {
        if (this.isOpen) {
            return;
        }
        this.isOpen = true;
        this.settingsDiv = document.querySelector('.game .settings');
        this.settingsDiv.replaceChildren();

        // Create input elements
        const numRowsInput = Utils.createInput('# of Rows', 'number', this.boardX);
        const numColumnsInput = Utils.createInput('# of Columns', 'number', this.boardY);
        const gameLengthInput = Utils.createInput("Game Length", 'number', this.gameLength);
        const symbolSourcesInput = Utils.createInput('Symbol Sources', 'textarea', this.symbolSources.join("\n"));
        const startingSymbolsInput = Utils.createInput('Starting Symbols', 'text', this.startingSet);
        // Create buttons
        const cancelButton = Utils.createButton('Cancel', async () => await this.close());
        const saveButton = Utils.createButton('Save', () => this.save(numRowsInput, numColumnsInput, gameLengthInput, symbolSourcesInput, startingSymbolsInput));

        // Append elements to the settings div
        const settingsBoxDiv = document.createElement('div');
        settingsBoxDiv.classList.add('settings-box')
        settingsBoxDiv.append(numRowsInput.label, numRowsInput.input);
        settingsBoxDiv.append(numColumnsInput.label, numColumnsInput.input);
        settingsBoxDiv.append(gameLengthInput.label, gameLengthInput.input);
        settingsBoxDiv.append(symbolSourcesInput.label, symbolSourcesInput.input);
        settingsBoxDiv.append(startingSymbolsInput.label, startingSymbolsInput.input);
        settingsBoxDiv.append(cancelButton, saveButton);
        
        this.settingsDiv = document.querySelector('.game .settings');
        this.settingsDiv.append(settingsBoxDiv);
    }

    async close(game) {
        if (!this.isOpen) {
            return;
        }

        this.settingsDiv.replaceChildren();
        this.isOpen = false;
    }

    save(numRowsInput, numColsInput, gameLengthInput, symbolSourcesInput, startingSymbolsInput) {
        this.boardX = numRowsInput.input.value;
        this.boardY = numColsInput.input.value;
        this.gameLength = gameLengthInput.input.value;
        this.symbolSources = symbolSourcesInput.input.value.split("\n");
        this.startingSet = startingSymbolsInput.input.value;
        this.close();
        GameSettings.loadFn(this);
    }
}

