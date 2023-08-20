import { Constants } from './constants.js';
import { Emoji } from './emoji.js';
import { IntRef } from './ui.js';

export class HeaderView {
  constructor(game, containerDiv) {
    this.game = game;
    this.containerDiv = containerDiv;
    this.render();
  }
  render() {
    const character = this.game.hero;
    character.level.bindTo(this.containerDiv.querySelector('.header-level'));
    character.gold.bindTo(this.containerDiv.querySelector('.header-gold'));
  }
}

export class AttribsView {
  constructor(game, containerDiv) {
    this.game = game;
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .attribs-row');
    this.rows = {};
  }
  render() {
    this.renderFor(this.game.hero);
  }
  renderFor(character) {
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
      const ref = character.attribs[attrib];
      ref.bindTo(valueSpan);

      row.querySelector('.attribs-add').classList.add('hidden');
    }

    const skillPointsRow = this.rowTemplate.cloneNode(true);
    contentDiv.appendChild(skillPointsRow);
    const pointsSpan = skillPointsRow.querySelector('.attribs-skill-points');
    character.skillPoints.bindTo(pointsSpan, pointsSpan);
    if (character.skillPoints.value === 0) {
      character.skillPoints.hide();
    }

    for (const attrib of Object.values(Constants.levelableAttribs)) {
      const row = this.rows[attrib];
      const button = row.querySelector('.attribs-add');

      if (character.skillPoints.value > 0) {
        button.classList.remove('hidden');
      }

      button.addEventListener('click', () => {
        character.assignPoint(attrib);
        if (character.skillPoints.value === 0) {
          this.removeButtons();
          character.skillPoints.hide();
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
  constructor(game, containerDiv) {
    this.game = game;
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .equips-row');
  }
  render() {
    this.renderFor(this.game.hero);
  }
  renderFor(character, isEnemy=false) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'equips-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const slot of Object.values(Constants.equipOrder)) {
      // In enemy mode, don't show empty slots.
      if (isEnemy && !(slot in character.equips)) {
        continue;
      }

      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);

      row.querySelector('.equip-slot').textContent = Emoji.map(slot);

      if (!(slot in character.equips)) {
        row.querySelector('.equips-remove').classList.add('hidden');
        continue;
      }

      const equip = character.equips[slot];
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

      if (isEnemy) {
        unequipButton.classList.add('hidden');
      } else {
        unequipButton.addEventListener('click', () => {
          character.unequip(slot);
          this.renderFor(character, isEnemy);
          this.game.views['inventory'].render();
        });
      }
    }
  }
}

export class InventoryView {
  constructor(game, containerDiv) {
    this.game = game;
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .inventory-row');
  }
  render() {
    const character = this.game.hero;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'inventory-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const item of Object.values(character.inventory)) {
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
        character.equip(item);
        this.render();
        this.game.views['equips'].render();
      });

      const sellButton = row.querySelector('.item-sell');
      // TODO(): Implement item sale.
    }
  }
}

export class EnemySelectView {
  constructor(game, containerDiv) {
    this.game = game;
    this.containerDiv = containerDiv;
    this.rowTemplate = document.querySelector('.template .enemy-select-row');
  }
  render() {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'enemy-select-view';
    this.containerDiv.replaceChildren();
    this.containerDiv.appendChild(contentDiv);

    for (const enemyName of Object.values(Constants.enemyOrder)) {
      const row = this.rowTemplate.cloneNode(true);
      contentDiv.appendChild(row);

      row.querySelector('.enemy-name').textContent = Emoji.map(enemyName);

      const enemy = this.game.enemies[enemyName];

      row.querySelector('.enemy-level').textContent = 
        Emoji.map('level') + Emoji.convertInt(enemy.level.value);

      const fightButton = row.querySelector('.enemy-fight');
      fightButton.addEventListener('click', () => {
        this.game.fight(enemy);
      });

      const detailsButton = row.querySelector('.enemy-details');
      let detailsClicked = false;
      detailsButton.addEventListener('click', () => {
        const attribsDiv = row.querySelector('.enemy-attribs');
        const equipsDiv = row.querySelector('.enemy-equips');
        if (detailsClicked) {
          attribsDiv.classList.toggle('hidden');
          equipsDiv.classList.toggle('hidden');
          return;
        }

        const attribsView = new AttribsView({}, attribsDiv);
        attribsView.renderFor(enemy);
        const equipsView = new EquipsView({}, equipsDiv);
        equipsView.renderFor(enemy, /*isEnemy=*/true);
        detailsClicked = true;
      });

      // The first enemy that is higher level than the hero is unlocked.
      if (enemy.level.value > this.game.hero.level.value) {
        break;
      }
    }
  }
}

export class CombatView {
  static logsVisible = false;

  constructor(game, model) {
    this.game = game;
    this.model = model;

    this.containerDiv = document.querySelector('.combat');
    this.template = document.querySelector('.template .combat-view');
    this.templateDetail = document.querySelector('.template .combat-detail-grid');
    this.render();
  }
  render() {
    this.containerDiv.replaceChildren();
    const combatDiv = this.template.cloneNode(true);
    this.containerDiv.appendChild(combatDiv);

    const backButton = combatDiv.querySelector('.back-button');
    backButton.addEventListener('click', () => {
      this.game.endFight(this.game.sim.won);
    });

    combatDiv.querySelector('.next-button').addEventListener('click', () => {
      this.game.sim.step();
    });
    combatDiv.querySelector('.play-button').addEventListener('click', () => {
      const timer = setInterval(() => {
        this.game.sim.step();
        if (this.game.sim.done) {
          clearInterval(timer);
        }
      }, Constants.combatSpeed);
    });
    combatDiv.querySelector('.log-button').addEventListener('click', () => {
      const button = document.querySelector('.log-button');
      const nodes = document.querySelectorAll('.combat-grid-item.log');
      for (const node of Object.values(nodes)) {
        node.classList.toggle('hidden');
        CombatView.logsVisible = !node.classList.contains('hidden');
      }
      this.updateLogButton();
    });
    this.updateLogButton();
    this.renderSingle(combatDiv, 'hero');
    this.renderSingle(combatDiv, 'enemy');
  }
  updateLogButton() {
    const button = document.querySelector('.log-button');
    if (CombatView.logsVisible) {
      button.textContent = Emoji.map('book_open');
    } else {
      button.textContent = Emoji.map('book_closed');
    }
  }
  renderSingle(div, selector) {
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
  showWinner(selector) {
    const characterDiv = this.containerDiv.querySelector(`.character.${selector}`);
    characterDiv.querySelector('.trophy').classList.remove('hidden');

    this.containerDiv.querySelector('.next-button').classList.add('hidden');
    this.containerDiv.querySelector('.play-button').classList.add('hidden');
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
  destruct() {
    this.containerDiv.replaceChildren();
  }
}
