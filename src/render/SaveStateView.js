import { createButton, createDiv, createInput } from './animations.js';

// Export/import panel DOM.
export class SaveStateView {
  constructor() {
    this.root = document.querySelector('.save-state-panel');
  }
  renderSaveState({ code, onImport }) {
    this.root.replaceChildren();

    const exportLabelText = 'Export save (click to copy)';
    const { label: exportLabel, input: exportBox } = createInput(
      exportLabelText,
      'textarea',
      code
    );
    exportBox.readOnly = true;
    exportBox.classList.add('click-to-copy');
    exportBox.addEventListener('click', async () => {
      exportBox.select();
      try {
        await navigator.clipboard.writeText(exportBox.value);
      } catch {
        document.execCommand('copy');
      }
      exportLabel.textContent = 'Export save (copied!)';
      setTimeout(() => {
        exportLabel.textContent = exportLabelText;
      }, 1500);
    });

    const { label: importLabel, input: importBox } = createInput(
      'Import save',
      'textarea',
      ''
    );
    const errorDiv = createDiv('', 'save-state-error', 'hidden');
    const loadButton = createButton('Load', () => {
      errorDiv.classList.add('hidden');
      try {
        onImport(importBox.value);
      } catch (e) {
        errorDiv.textContent = e.message;
        errorDiv.classList.remove('hidden');
      }
    });

    this.root.appendChild(exportLabel);
    this.root.appendChild(exportBox);
    this.root.appendChild(importLabel);
    this.root.appendChild(importBox);
    this.root.appendChild(loadButton);
    this.root.appendChild(errorDiv);
  }
}
