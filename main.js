import { Character } from './character.js';
import { CombatSim } from './combat.js';
import { Item } from './item.js';
import { Emoji } from './emoji.js';

const hero = new Character('hero', 
  {hp: 300, fencing: 8, strength: 10, speed: 10, accuracy: 7});
hero.equip('head', new Item('cap', {armor: 4, accuracy: -1}));
hero.equip('weapon', new Item('spoon', {damage: 3}));

const enemy = new Character('troll', 
  {hp: 420, fencing: 7, strength: 12, speed: 9, accuracy: 8});
enemy.equip('head', new Item('helmet', {armor: 4}));
enemy.equip('weapon', new Item('screwdriver', {damage: 2}));

const sim = new CombatSim(hero, enemy);

sim.model.hero.applyStatus('bleed', 3);
sim.model.hero.applyStatus('poison', 5);

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
