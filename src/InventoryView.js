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

  async handleViewEvent(effect) {
    const [_component, action] = effect.type.split('.');
    switch (action) {
      case 'resourceSet':
        await this.updateResource(effect.key, effect.value);
        break;
      case 'addSymbol':
        await this.updateInventoryEntry(effect.symbol, effect.count);
        break;
      case 'removeSymbol':
        await this.updateInventoryEntry(effect.symbol, effect.count);
        break;
      case 'moneyEarnedOverlay':
        // TODO #REFACTOR: Implement money earned overlay animation
        break;
      default:
        console.warn(`Unknown inventory view event action: ${action}`);
    }
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
  async updateInventoryEntry(name, count) {
    const symbolSpan = document.getElementById(`inventory-${name}`);
    if (!symbolSpan) {
      console.warn('No inventory entry found for', name);
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

  async updateResource(key, value) {
    const resourceSpan = document.getElementById(`resource-${key}`);
    if (!resourceSpan) {
      console.warn('No resource entry found for', key);
      return;
    }
    const countSpan = resourceSpan.querySelector('.inventoryEntryCount');
    countSpan.innerText = Util.formatBigNumber(value) + '';
    // TODO #REFACTOR: Add animation for resource change
  }
  
}
