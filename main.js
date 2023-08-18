import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Emoji } from './emoji.js';
import { Item } from './item.js';
import { AttribsView, EquipsView } from './view.js';

// Hero starts with lvl 5 and one free skill point.
const hero = new Character('hero', 4,
  {fencing: 1, strength: 1, speed: 1, accuracy: 1});
hero.levelUp();

hero.equip(new Item('feet', 'socks', {armor: 1}));
hero.equip(new Item('weapon', 'spoon', {damage: 1, speed: 1}));

console.log(hero.combatCopy());

const contentDiv = document.querySelector('.main-content');

const attribsView = new AttribsView(contentDiv);
const equipsView = new EquipsView(contentDiv);
// attribsView.render(hero);
equipsView.render(hero);

// const enemy = new Character('troll', 36, 
//   {fencing: 7, strength: 12, speed: 9, accuracy: 8});
// enemy.equip(new Item('head', 'helmet', {armor: 4}));
// enemy.equip(new Item('weapon', 'screwdriver', {damage: 2}));

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
