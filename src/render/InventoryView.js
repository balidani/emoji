import { createInteractiveDescription, formatBigNumber } from '../core/util.js';
import { createSpan } from './animations.js';

// The inventory + resource panel DOM. `showInfo` is a callback
// (descriptionHtml) -- wired to DomRenderer.showInfo by whoever constructs
// this -- since clicking an entry here is what drives the info panel.
export class InventoryView {
  constructor(showInfo) {
    this.symbolsDiv = document.querySelector('.game .inventory');
    this.uiDiv = document.querySelector('.game .ui');
    this.showInfo = showInfo;
  }

  renderInventory(entries) {
    this.symbolsDiv.replaceChildren();
    for (const { emoji, count, description } of entries) {
      const symbolSpan = createSpan(emoji, 'inventoryEntry');
      symbolSpan.addEventListener('click', () => {
        this.showInfo(createInteractiveDescription(description, emoji));
      });
      const countSpan = createSpan(count, 'inventoryEntryCount');
      symbolSpan.appendChild(countSpan);
      this.symbolsDiv.appendChild(symbolSpan);
    }
  }

  renderResources(entries) {
    this.uiDiv.replaceChildren();
    for (const { emoji, value, description } of entries) {
      const symbolSpan = createSpan(emoji, 'inventoryEntry');
      symbolSpan.addEventListener('click', () => {
        this.showInfo(createInteractiveDescription(description, emoji));
      });
      const countSpan = createSpan(
        formatBigNumber(value) + '',
        'inventoryEntryCount'
      );
      symbolSpan.appendChild(countSpan);
      this.uiDiv.appendChild(symbolSpan);
    }
  }
}
