import * as Util from './util.js';

export class InventoryView {
  constructor(game, inventory) {
    this.game = game;
    this.inventory = inventory;
    
    this.inventoryDiv = document.querySelector('.game .inventory');
    this.resourceDiv = document.querySelector('.game .resources');
    // TODO #REFACTOR: move infoDiv to a separate Info(View).js
    this.infoDiv = document.querySelector('.info');

    this.createResources(inventory.resources);
    this.createInventory(inventory.symbols);
  }
  createResources(resources) {
    this.resourceDiv.replaceChildren();
    const displayKeyValue = (key, value) => {
      const symbolSpan = Util.createSpan(key, 'inventoryEntry');
      symbolSpan.id = `resource-${key}`;
      symbolSpan.addEventListener('click', (_) => {
        const interactiveDescription = Util.createInteractiveDescription(
          this.inventory.catalog.symbol(key).descriptionLong(),
          /*emoji=*/ key
        );
        Util.drawText(this.infoDiv, interactiveDescription, true);
      });
      const countSpan = Util.createSpan(
        Util.formatBigNumber(value) + '', 'inventoryEntryCount');
      symbolSpan.appendChild(countSpan);
      this.resourceDiv.appendChild(symbolSpan);
    };
    for (const [key, value] of Object.entries(resources)) {
      displayKeyValue(key, value);
    }
  }
  createInventory(inventory) {
    this.inventoryDiv.replaceChildren();
    const map = new Map();
    inventory.forEach((symbol) => {
      const name = symbol.emoji();
      if (!map.has(name)) {
        map.set(name, { count: 0, description: symbol.descriptionLong() });
      }
      map.set(name, {
        count: map.get(name).count + 1,
        description: symbol.descriptionLong(),
      });
    });
    map.forEach(({ count, description }, name) => {
      this.createInventoryEntry(name, count, description);
    });
  }
  createInventoryEntry(name, count, description) {
    const symbolSpan = Util.createSpan(name, 'inventoryEntry');
    symbolSpan.id = `inventory-${name}`;
    symbolSpan.addEventListener('click', (_) => {
      const interactiveDescription = Util.createInteractiveDescription(
        description,
        /*emoji=*/ name
      );
      Util.drawText(this.infoDiv, interactiveDescription, true);
    });
    const countSpan = Util.createSpan(count, 'inventoryEntryCount');
    symbolSpan.appendChild(countSpan);
    this.inventoryDiv.appendChild(symbolSpan);
  }
  async updateInventoryEntry(name, count, description = '') {
    const symbolSpan = document.getElementById(`inventory-${name}`);
    if (!symbolSpan) {
      this.createInventoryEntry(name, count, description);
      return;
    }
    if (count === 0) {
      symbolSpan.remove();
      // TODO #REFACTOR: Add animation
      return;
    }
    const countSpan = symbolSpan.querySelector('.inventoryEntryCount');
    // Just in case player has 100K+ of the same symbol :)
    countSpan.innerText = Util.formatBigNumber(count) + '';
    // TODO #REFACTOR: Add animation for inventory change
  }

  async addSymbol({ symbol, count, description }) {
    await this.updateInventoryEntry(symbol.emoji(), count, description);
  }
  async removeSymbol({ symbol, count }) {
    await this.updateInventoryEntry(symbol.emoji(), count);
  }

  async resourceSet({ key, value }) {
    const resourceSpan = document.getElementById(`resource-${key}`);
    if (!resourceSpan) {
      console.warn('No resource entry found for', key);
      return;
    }
    const countSpan = resourceSpan.querySelector('.inventoryEntryCount');
    countSpan.innerText = Util.formatBigNumber(value) + '';
    // TODO #REFACTOR: Add animation for resource change
  }

  async moneyEarnedOverlay({coords, value}) {
    // TODO #REFACTOR: Implement money earned overlay animation
  }

  // TODO #REFACTOR, is this needed?
  getPassiveSymbolDiv(y) {
    // Passive symbol, look for the div among inventoryEntry.
    const emoji = this.passiveCells[y].emoji();
    const entries = document.getElementsByClassName('inventoryEntry');
    for (const entry of entries) {
      if (entry.innerText.includes(emoji)) {
        return entry;
      }
    }
    return null;
  }
}
