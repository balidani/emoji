import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Emoji } from './emoji.js';
import { Item } from './item.js';
import { AttribsView, EnemySelectView, EquipsView, InventoryView } from './view.js';

// Hero starts with lvl 5 and one free skill point.
const hero = new Character('hero', 4,
  {fencing: 1, strength: 1, speed: 1, accuracy: 1});
hero.levelUp();

hero.addEquip(new Item('feet', 'socks', {armor: 1}));
hero.addEquip(new Item('weapon', 'spoon', {damage: 1, speed: 1}));
hero.inventory.push(new Item('finger', 'ring', {armor: 1}));

// Main menu
const contentDiv = document.querySelector('.main-content');
const attribsView = new AttribsView(contentDiv);
const equipsView = new EquipsView(contentDiv);
const inventoryView = new InventoryView(contentDiv);
const enemySelectView = new EnemySelectView(contentDiv);

const attribsButton = document.querySelector('.menu-attribs-button');
attribsButton.addEventListener('click', () => {
	attribsView.render(hero);
});

const equipsButton = document.querySelector('.menu-equips-button');
equipsButton.addEventListener('click', () => {
	equipsView.render(hero);
});

const inventoryButton = document.querySelector('.menu-inventory-button');
inventoryButton.addEventListener('click', () => {
	inventoryView.render(hero);
});

const enemySelectButton = document.querySelector('.menu-enemy-select-button');
enemySelectButton.addEventListener('click', () => {
	enemySelectView.render(hero);
});

attribsView.render(hero);

// const enemy = new Character('troll', 36, 
//   {fencing: 7, strength: 12, speed: 9, accuracy: 8});
// enemy.addEquip(new Item('head', 'helmet', {armor: 4}));
// enemy.addEquip(new Item('weapon', 'screwdriver', {damage: 2}));

// const sim = new CombatSim(hero, enemy);
// // sim.model.hero.applyStatus('bleed', 3);

// document.querySelector('.next-button').addEventListener('click', () => {
//   const res = sim.step();
// });
// document.querySelector('.log-button').addEventListener('click', () => {
//   const button = document.querySelector('.log-button');
//   let visible = false;
//   const nodes = document.querySelectorAll('.combat-grid-item.log');
//   for (const node of Object.values(nodes)) {
//     node.classList.toggle('hidden');
//     visible = !node.classList.contains('hidden');
//   }
//   if (visible) {
//     button.innerText = Emoji.map('book_open');
//   } else {
//     button.innerText = Emoji.map('book_closed');
//   }
// });
// document.querySelector('.play-button').addEventListener('click', () => {
//   const timer = setInterval(() => {
//     sim.step();
//     if (sim.isDone()) {
//       clearInterval(timer);
//     }
//   }, 300);
// });
