import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Constants } from './constants.js';
import { Emoji } from './emoji.js';
import { Item } from './item.js';
import { AttribsView, EnemySelectView, EquipsView, HeaderView, InventoryView } from './view.js';

// Hero starts with lvl 5 and one free skill point.
const hero = new Character('hero', 4,
  {fencing: 1, strength: 1, speed: 1, accuracy: 1});
hero.levelUp();

hero.addEquip(new Item('feet', 'socks', {armor: 1}));
hero.addEquip(new Item('weapon', 'spoon', {damage: 1, speed: 1}));

const enemies = {};
for (const [name, characterInfo] of Object.entries(Constants.enemies)) {
	const level = Object.values(characterInfo.attribs).reduce((sum, x) => sum + x);
	enemies[name] = new Character(name, level, characterInfo.attribs);
	for (const [slot, weaponInfo] of Object.entries(characterInfo.equips)) {
		enemies[name].addEquip(new Item(slot, weaponInfo.name, weaponInfo.attribs));
	}
}

const headerView = new HeaderView(document.querySelector('.content-header'));
headerView.render(hero);

const attribsView = new AttribsView(document.querySelector('.content-attribs'));
attribsView.render(hero);

const equipsView = new EquipsView(document.querySelector('.content-equips'));
const inventoryView = new InventoryView(document.querySelector('.content-inventory'));

equipsView.render(hero, inventoryView);
inventoryView.render(hero, equipsView);

const enemySelectView = new EnemySelectView(document.querySelector('.content-enemy-select'));
enemySelectView.render(hero, enemies);

const enemy = new Character('troll', 36, 
  {fencing: 7, strength: 12, speed: 9, accuracy: 8});
enemy.addEquip(new Item('head', 'helmet', {armor: 4}));
enemy.addEquip(new Item('weapon', 'screwdriver', {damage: 2}));

const sim = new CombatSim(hero, enemy);
// sim.model.hero.applyStatus('bleed', 3);

document.querySelector('.next-button').addEventListener('click', () => {
  const res = sim.step();
});
document.querySelector('.log-button').addEventListener('click', () => {
  const button = document.querySelector('.log-button');
  let visible = false;
  const nodes = document.querySelectorAll('.combat-grid-item.log');
  for (const node of Object.values(nodes)) {
    node.classList.toggle('hidden');
    visible = !node.classList.contains('hidden');
  }
  if (visible) {
    button.innerText = Emoji.map('book_open');
  } else {
    button.innerText = Emoji.map('book_closed');
  }
});
document.querySelector('.play-button').addEventListener('click', () => {
  const timer = setInterval(() => {
    sim.step();
    if (sim.isDone()) {
      clearInterval(timer);
    }
  }, 300);
});

function scalePage() {
  const scale = window.innerWidth / 960;
  const container = document.querySelector('.container');
  container.style.transform = 'scale(' + scale + ')';
}

window.onresize = scalePage;
scalePage();
