import { Constants } from './constants.js';
import { Emoji } from './emoji.js';
import { IntRef } from './ui.js';

export class AttribsView {
  constructor(containerDiv) {
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .attribs-row');
    this.rows = {};
  }
  render(hero) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'attribs-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const attrib of Object.values(Constants.attribOrder)) {
      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);
      this.rows[attrib] = row;

      row.querySelector('.attrib-key').textContent = Emoji.map(attrib);
      const valueSpan = row.querySelector('.attrib-value');
      const ref = hero.attribs[attrib];
      ref.bindTo(valueSpan);

      row.querySelector('.attribs-add').classList.add('hidden');
    }

    const skillPointsRow = this.rowTemplate.cloneNode(true);
    contentDiv.appendChild(skillPointsRow);
    const pointsSpan = skillPointsRow.querySelector('.attribs-skill-points');
    hero.skillPoints.bindTo(pointsSpan, pointsSpan);
    if (hero.skillPoints.value === 0) {
      hero.skillPoints.hide();
    }

    for (const attrib of Object.values(Constants.levelableAttribs)) {
      const row = this.rows[attrib];
      const button = row.querySelector('.attribs-add');

      if (hero.skillPoints.value > 0) {
        button.classList.remove('hidden');
      }

      button.addEventListener('click', () => {
        hero.assignPoint(attrib);
        if (hero.skillPoints.value === 0) {
          this.removeButtons();
          hero.skillPoints.hide();
        }
      });
    }
  }
  removeButtons() {
    for (const [key, row] of Object.entries(this.rows)) {
      row.querySelector('.attribs-add').classList.add('hidden');
    }
  }
}

export class EquipsView {
  constructor(containerDiv) {
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .equips-row');
  }
  render(hero) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'equips-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const slot of Object.values(Constants.equipOrder)) {
      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);

      row.querySelector('.equip-slot').textContent = Emoji.map(slot);

      if (!(slot in hero.equips)) {
        row.querySelector('.equips-remove').classList.add('hidden');
        continue;
      }

      const equip = hero.equips[slot];
      const equipName = row.querySelector('.equip-name');
      equipName.textContent = Emoji.map(equip.name);

      const description = row.querySelector('.equip-description');
      for (const [key, ref] of Object.entries(equip.attribs)) {
        const line = document.createElement('div');
        description.appendChild(line);
        line.textContent = 
          Emoji.map(key) + Emoji.convertInt(ref.value);
      }
      
      const unequipButton = row.querySelector('.equips-remove');
      unequipButton.addEventListener('click', () => {
        hero.unequip(slot);
        equipName.classList.add('hidden');
        description.classList.add('hidden');
        unequipButton.classList.add('hidden');
      });
    }
  }
}

export class InventoryView {
  constructor(containerDiv) {
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .inventory-row');
  }
  render(hero) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'inventory-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const item of Object.values(hero.inventory)) {
      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);

      row.querySelector('.item-name').textContent = Emoji.map(item.name);

      const description = row.querySelector('.item-description');
      for (const [key, ref] of Object.entries(item.attribs)) {
        const line = document.createElement('div');
        description.appendChild(line);
        line.textContent = 
          Emoji.map(key) + Emoji.convertInt(ref.value);
      }

      const equipButton = row.querySelector('.item-equip');
      equipButton.addEventListener('click', () => {
        hero.equip(item);
        this.render(hero);
      });

      const sellButton = row.querySelector('.item-sell');
      // TODO(): Implement item sale.
    }
  }
}

export class EnemySelectView {
  constructor(containerDiv) {
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .enemy-select-row');
  }
  render(hero) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'enemy-select-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    // Which enemies are unlocked?
    
    for (const item of Object.values(hero.inventory)) {
      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);

      row.querySelector('.item-name').textContent = Emoji.map(item.name);

      const description = row.querySelector('.item-description');
      for (const [key, ref] of Object.entries(item.attribs)) {
        const line = document.createElement('div');
        description.appendChild(line);
        line.textContent = 
          Emoji.map(key) + Emoji.convertInt(ref.value);
      }

      const equipButton = row.querySelector('.item-equip');
      equipButton.addEventListener('click', () => {
        hero.equip(item);
        this.render(hero);
      });

      const sellButton = row.querySelector('.item-sell');
      // TODO(): Implement item sale.
    }
  }
}

export class CombatView {
  constructor(model) {
    this.model = model;
    this.valueSpanMap = {};

    this.containerDiv = document.querySelector('.container');
    this.template = document.querySelector('.template .combat-view');
    this.templateDetail = document.querySelector('.template .combat-detail-grid');

    const templateDiv = this.template.cloneNode(true);
    this.containerDiv.appendChild(templateDiv);
    this.render(templateDiv, 'hero');
    this.render(templateDiv, 'enemy');
  }
  render(div, selector) {
    const character = this.model[selector];
    const characterDiv = div.querySelector(`.character.${selector}`);
    characterDiv.querySelector('.char').textContent = Emoji.map(character.name);

    const renderIntValue = (div, key, valueRef, hideEmpty=false) => {
      const detailDiv = this.templateDetail.cloneNode(true);
      div.appendChild(detailDiv);

      const keyDiv = detailDiv.querySelector('.key .char');
      keyDiv.textContent = Emoji.map(key);

      const valueDiv = detailDiv.querySelector('.values');
      const valueSpan = document.createElement('span');
      valueDiv.appendChild(valueSpan);
      valueSpan.className = 'char';
      valueRef.bindTo(valueSpan, /*hider=*/detailDiv);
      if (hideEmpty && valueRef.value === 0) {
        valueRef.hide();
      }
    };

    const attribsDiv = div.querySelector(`.attribs.${selector}`);
    for (const attrib of Object.values(Constants.attribOrder)) {
      renderIntValue(attribsDiv, attrib, character.attribs[attrib]);
    }

    // For statuses, generate all divs/spans, but hide values that are 0.
    const statusesDiv = div.querySelector(`.statuses.${selector}`);
    for (const [key, ref] of Object.entries(character.statuses)) {
      renderIntValue(statusesDiv, key, ref, /*hideEmpty=*/true);
    }

    const equipsDiv = div.querySelector(`.equips.${selector}`);
    for (const equipName of Object.values(Constants.equipOrder)) {
      if (!(equipName in character.equips)) {
        continue;
      }

      const equip = character.equips[equipName];
      const detailDiv = this.templateDetail.cloneNode(true);
      equipsDiv.appendChild(detailDiv);

      const keyDiv = detailDiv.querySelector('.key .char');
      keyDiv.textContent = Emoji.map(equip.name);

      const valueDiv = detailDiv.querySelector('.values');
      for (const [key, value] of Object.entries(equip.attribs)) {
        renderIntValue(valueDiv, key, value);
      }
    }
  }
  addLog(logs, selector, opponent) {
    const logDiv = this.containerDiv.querySelector(`.log.${selector}`);
    const combatPrefix = Emoji.map(this.model[selector].name) 
      + Emoji.map('damage') 
      + Emoji.map(this.model[opponent].name);
    const statusPrefix = Emoji.map(this.model[selector].name);
    for (const logEntry of Object.values(logs)) {
      if (logEntry.type === 'status') {
        logDiv.innerHTML += statusPrefix 
          + Emoji.map(logEntry.status) 
          + Emoji.convertInt(logEntry.value) + '<br>';
        continue;
      }

      let logString = '';
      if (logEntry.type === 'miss' || logEntry.type === 'dodge') {
        logString = Emoji.map('miss');
      } else if (logEntry.type === 'hit') {
        logString = Emoji.map('hp') + Emoji.convertInt(logEntry.value);
        if (logEntry.crit === true) {
          logString += Emoji.map('crit');
        }
        if (logEntry.multi === true) {
          logString += Emoji.map('multi') + Emoji.convertInt(logEntry.count);
        }
      }
      logDiv.innerHTML += combatPrefix + logString + '<br>'; 
    }
  }
}
