import { Emoji } from './emoji.js';

export class CombatView {
  static eqipOrder = ['head', 'torso', 'hand', 'foot', 'weapon'];

  constructor(model) {
    this.model = model;
    this.valueSpanMap = {};

    this.containerDiv = document.querySelector('.container');
    this.template = document.querySelector('.template .combat-grid');
    this.templateDetail = document.querySelector('.template .combat-detail-grid');

    const templateDiv = this.template.cloneNode(true);
    this.containerDiv.appendChild(templateDiv);
    this.render(templateDiv, 'hero');
    this.render(templateDiv, 'enemy');
  }
  render(div, selector) {
    const character = this.model[selector];
    const characterDiv = div.querySelector(`.character.${selector}`);
    characterDiv.querySelector('.char').innerText = Emoji.map(character.name);

    const renderIntValue = (div, key, valueRef, hideEmpty=false) => {
      const detailDiv = this.templateDetail.cloneNode(true);
      div.appendChild(detailDiv);

      const keyDiv = detailDiv.querySelector('.key .char');
      keyDiv.innerText = Emoji.map(key);

      const valueDiv = detailDiv.querySelector('.values');
      const valueSpan = document.createElement('span');
      valueDiv.appendChild(valueSpan);
      valueSpan.className = 'char';

      valueSpan.innerText = Emoji.convertInt(valueRef.value);

      valueRef.detail = detailDiv;
      valueRef.span = valueSpan;
      if (hideEmpty && valueRef.value === 0) {
        valueRef.hide();
      }
    };

    const attribsDiv = div.querySelector(`.attribs.${selector}`);
    for (const [key, ref] of Object.entries(character.attribs)) {
      renderIntValue(attribsDiv, key, ref);
    }

    // For statuses, generate all divs/spans, but hide values that are 0.
    const statusesDiv = div.querySelector(`.statuses.${selector}`);
    for (const [key, ref] of Object.entries(character.statuses)) {
      renderIntValue(statusesDiv, key, ref, /*hideEmpty=*/true);
    }

    const equipsDiv = div.querySelector(`.equips.${selector}`);
    for (const equipName of Object.values(CombatView.eqipOrder)) {
      if (!(equipName in character.equips)) {
        continue;
      }

      const equip = character.equips[equipName];
      const detailDiv = this.templateDetail.cloneNode(true);
      equipsDiv.appendChild(detailDiv);

      const keyDiv = detailDiv.querySelector('.key .char');
      keyDiv.innerText = Emoji.map(equip.name);

      const valueDiv = detailDiv.querySelector('.values');
      for (const [key, value] of Object.entries(equip.attribs)) {
        renderIntValue(valueDiv, key, value);
      }
    }
  }
  addLog(logs, selector, opponent) {
    const logDiv = this.containerDiv.querySelector(`.log.${selector}`);
    const prefix = Emoji.map(this.model[selector].name) 
      + Emoji.map('damage') 
      + Emoji.map(this.model[opponent].name);
    for (const logEntry of Object.values(logs)) {
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
      logDiv.innerHTML += prefix + logString + '<br>'; 
    }
  }
}
