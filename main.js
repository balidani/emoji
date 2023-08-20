import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Constants } from './constants.js';
import { Emoji } from './emoji.js';
import { Item } from './item.js';
import { AttribsView, EnemySelectView, EquipsView, HeaderView, InventoryView } from './view.js';

class Game {
  constructor() {
    // Hero starts with lvl 5 and one free skill point.
    this.hero = new Character('hero', 4,
      {fencing: 1, strength: 1, speed: 1, accuracy: 1});
    this.hero.levelUp();
    this.hero.addEquip(new Item('feet', 'socks', {armor: 1}));
    this.hero.addEquip(new Item('weapon', 'spoon', {damage: 1, speed: 1}));

    this.enemies = {};
    for (const [name, characterInfo] of Object.entries(Constants.enemies)) {
      const level = Object.values(characterInfo.attribs).reduce((sum, x) => sum + x);
      this.enemies[name] = new Character(name, level, characterInfo.attribs);
      for (const [slot, weaponInfo] of Object.entries(characterInfo.equips)) {
        this.enemies[name].addEquip(new Item(slot, weaponInfo.name, weaponInfo.attribs));
      }
    }

    this.views = {};
    this.views['header'] = new HeaderView(this, document.querySelector('.content-header'));
    this.views['attribs'] = new AttribsView(this, document.querySelector('.content-attribs'));
    this.views['equips'] = new EquipsView(this, document.querySelector('.content-equips'));
    this.views['inventory'] = new InventoryView(this, document.querySelector('.content-inventory'));
    this.views['enemySelect'] = new EnemySelectView(this, document.querySelector('.content-enemy-select'));
    for (const [key, view] of Object.entries(this.views)) {
      view.render();
    }

    this.sim = null;
  }
  fight(enemy) {
    this.blur();
    this.sim = new CombatSim(this, enemy);
  }
  endFight(won) {
    this.unblur();
    this.sim.end();
    this.sim = null;
  }
  blur() {
    const overlayDiv = document.createElement('div');
    overlayDiv.classList.add('overlay');
    const contentDiv = document.querySelector('.content');
    overlayDiv.style.width = `${contentDiv.clientWidth}px`;
    overlayDiv.style.height = `${contentDiv.clientHeight}px`;
    document.querySelector('.container').appendChild(overlayDiv);
  }
  unblur() {
    document.querySelector('.overlay').remove();
  }
}

const game = new Game();

function scalePage() {
  const scale = window.innerWidth / Constants.screenWidth;
  const container = document.querySelector('.container');
  if (scale < 1) {
    container.style.transform = 'scale(' + scale + ')';
  }
}
window.onresize = scalePage;
scalePage();
