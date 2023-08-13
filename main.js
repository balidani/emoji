import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Item } from './item.js';

const hero = new Character('hero', 
  {hp: 12, fencing: 3, strength: 4, speed: 2, accuracy: 3});
hero.applyStatus('poison', 3);
hero.equip('head', new Item('cap', {armor: 2, accuracy: -1}));
hero.equip('weapon', new Item('spoon', {damage: 1}));

const enemy = new Character('troll', 
  {hp: 8, fencing: 2, strength: 5, speed: 1, accuracy: 2});
enemy.equip('head', new Item('helmet', {armor: 4}));
enemy.equip('weapon', new Item('screwdriver', {damage: 2}));


const sim = new CombatSim(hero, enemy);

document.querySelector('.next-button').addEventListener('click', () => {
  const res = sim.step();
});

// const timer = setInterval(() => {
//   sim.step();
//   if (sim.done()) {
//     clearInterval(timer);
//   }
// }, 50);
