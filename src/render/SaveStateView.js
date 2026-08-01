import { createButton, createDiv, createInput } from './animations.js';

// Export/import panel DOM (see ACHIEVEMENTS_DESIGN.md, sections 9-10).
export class SaveStateView {
  constructor() {
    this.root = document.querySelector('.save-state-panel');
  }
  renderSaveState({ code, onImport }) {
    this.root.replaceChildren();

    const { label: exportLabel, input: exportBox } = createInput(
      'Export save',
      'textarea',
      code
    );
    exportBox.readOnly = true;
    const copyButton = createButton('Copy', async () => {
      exportBox.select();
      try {
        await navigator.clipboard.writeText(exportBox.value);
        copyButton.textContent = 'Copied!';
      } catch {
        document.execCommand('copy');
      }
      setTimeout(() => {
        copyButton.textContent = 'Copy';
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
    this.root.appendChild(copyButton);
    this.root.appendChild(importLabel);
    this.root.appendChild(importBox);
    this.root.appendChild(loadButton);
    this.root.appendChild(errorDiv);
  }
}
