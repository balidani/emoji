import { createDiv, createInput, createButton } from './animations.js';

// The settings form. GameSettings keeps the data; this class only builds
// the form DOM and reports the opener click / save / cancel back via
// callbacks.
export class SettingsView {
  // Called once per GameSettings instance that wants to open this view --
  // preserves the original quirk where each level's GameSettings attaches
  // its own listener to the shared .open-settings button.
  registerOpener(onOpenRequested) {
    const opener = document.querySelector('.open-settings');
    opener.addEventListener('click', (_) => {
      onOpenRequested();
    });
  }

  // values: {boardX, boardY, gameLength, symbolSources, startingSet}
  render(values, { onSave, onCancel }) {
    const settingsDiv = document.querySelector('.game .settings');
    settingsDiv.replaceChildren();

    const numRowsInput = createInput('# of Rows', 'number', values.boardX);
    const numColumnsInput = createInput(
      '# of Columns',
      'number',
      values.boardY
    );
    const gameLengthInput = createInput(
      'Game Length',
      'number',
      values.gameLength
    );
    const symbolSourcesInput = createInput(
      'Symbol Sources',
      'textarea',
      values.symbolSources.join('\n')
    );
    const startingSymbolsInput = createInput(
      'Starting Symbols',
      'text',
      values.startingSet
    );

    const cancelButton = createButton('Cancel', async () => await onCancel());
    const saveButton = createButton('Save', () =>
      onSave({
        boardX: parseInt(numRowsInput.input.value),
        boardY: parseInt(numColumnsInput.input.value),
        gameLength: parseInt(gameLengthInput.input.value),
        symbolSources: symbolSourcesInput.input.value.split('\n'),
        startingSet: startingSymbolsInput.input.value,
      })
    );

    const settingsBoxDiv = createDiv('', 'settings-box');
    settingsBoxDiv.append(numRowsInput.label, numRowsInput.input);
    settingsBoxDiv.append(numColumnsInput.label, numColumnsInput.input);
    settingsBoxDiv.append(gameLengthInput.label, gameLengthInput.input);
    settingsBoxDiv.append(symbolSourcesInput.label, symbolSourcesInput.input);
    settingsBoxDiv.append(
      startingSymbolsInput.label,
      startingSymbolsInput.input
    );
    settingsBoxDiv.append(cancelButton, saveButton);

    settingsDiv.append(settingsBoxDiv);
  }

  close() {
    document.querySelector('.game .settings').replaceChildren();
  }
}
