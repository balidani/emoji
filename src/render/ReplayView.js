import { createButton, createDiv, createInput } from './animations.js';

// Export/import/run panel DOM, structurally a clone of SaveStateView (see
// REPLAY_PLAN.md, section 9).
export class ReplayView {
  constructor() {
    this.root = document.querySelector('.replay-panel');
  }
  renderReplay({ code, onRun }) {
    this.root.replaceChildren();

    const exportLabelText = 'Export replay (click to copy)';
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
      exportLabel.textContent = 'Export replay (copied!)';
      setTimeout(() => {
        exportLabel.textContent = exportLabelText;
      }, 1500);
    });

    const { label: importLabel, input: importBox } = createInput(
      'Import replay',
      'textarea',
      ''
    );
    const errorDiv = createDiv('', 'replay-error', 'hidden');
    const runButton = createButton('Run replay', async () => {
      errorDiv.classList.add('hidden');
      try {
        // runReplay is async and can reject partway through (a divergence
        // is only ever detected mid-drive, after several awaits) -- await
        // it here so that rejection is caught same as a synchronous throw.
        await onRun(importBox.value);
      } catch (e) {
        errorDiv.textContent = e.message;
        errorDiv.classList.remove('hidden');
      }
    });

    this.root.appendChild(exportLabel);
    this.root.appendChild(exportBox);
    this.root.appendChild(importLabel);
    this.root.appendChild(importBox);
    this.root.appendChild(runButton);
    this.root.appendChild(errorDiv);
  }
}
