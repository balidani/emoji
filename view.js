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
    this.renderSingle(templateDiv, 'hero');
    this.renderSingle(templateDiv, 'enemy');
  }
  renderSingle(div, selector) {
    const character = this.model[selector];
    const characterDiv = div.querySelector(`.character.${selector}`);
    characterDiv.querySelector('.char').innerText = Emoji.map(character.name);

    const renderIntValue = (div, selector, key, value) => {
      const detailDiv = this.templateDetail.cloneNode(true);
      div.appendChild(detailDiv);

      const keyDiv = detailDiv.querySelector('.key .char');
      keyDiv.innerText = Emoji.map(key);

      const valueDiv = detailDiv.querySelector('.values');
      const valueSpan = document.createElement('span');
      valueDiv.appendChild(valueSpan);
      valueSpan.className = 'char';
      valueSpan.innerText = Emoji.convertInt(value);

      this.valueSpanMap[[selector, key].join('.')] = valueSpan;
    };

    const attribsDiv = div.querySelector(`.attribs.${selector}`);
    for (const [key, value] of Object.entries(character.attribs)) {
      renderIntValue(attribsDiv, selector, key, value);
    }
    const statusesDiv = div.querySelector(`.statuses.${selector}`);
    for (const [key, value] of Object.entries(character.statuses)) {
      renderIntValue(statusesDiv, selector, key, value);
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
        renderIntValue(valueDiv, [selector, equipName].join('.'), key, value);
      }
    }
  }
  update(selector, value) {
    this.valueSpanMap[selector].innerText = Emoji.convertInt(value);
  }
}
