const MAP = {
  // Attributes
  hp: '❤️',
  fencing: '🤺',
  strength: '🏋️',
  speed: '🏃',
  accuracy: '🎯',
  armor: '🛡️',
  damage: '⚔️',

  // Statuses
  fear: '😱',
  weak: '🤕',
  slow: '🥱',
  dizzy: '😵‍💫',
  sleep: '😴',
  poison: '🧪',
  bleed: '🩸',

  // Characters
  hero: '🦸',

  slime: '💩',
  ghost: '👻',
  robot: '🤖',
  clown: '🤡',
  goblin: '👺',
  ogre: '👹',
  alien: '👽',
  skeleton: '☠️',
  troll: '🧌',
  zombie: '🧟',
  djinn: '🧞',
  elf: '🧝',
  mermaid: '🧜‍♀️',
  vampire: '🧛',
  fairy: '🧚',
  mage: '🧙',
  villain: '🦹',

  // Items
  cap: '🧢',
  helmet: '🪖',
  tophat: '🎩',
  crown: '👑',
  coat: '🥼',
  robe: '🥋',
  glove: '🧤',
  boxing_glove: '🥊',
  sneaker: '👟',
  boot: '🥾',
  ring: '💍',

  // Weapons
  spoon: '🥄',
  screwdriver: '🪛',
  wrench: '🔧',
  saw: '🪚',
  hammer: '🔨',
  axe: '🪓',
  pickaxe: '⛏️',
  knife: '🔪',
  dagger: '🗡️',
  bow: '🏹',
  wand: '🪄',
  trident: '🔱',

  // Combat log
  miss: '🚫',
  crit: '💥',

  // Misc
  minus: '➖',
  multi: '✖️',
  book_open: '📖',
  book_closed: '📕',
};

const NUM = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class Emoji {
  static map(char) {
    return MAP[char];
  }
  static convertInt(num) {
    if (num === 0) {
      return NUM[0];
    }
    const sign = num < 0 ? Emoji.map('minus') : '';
    num = Math.abs(num);
    num = num | 0;
    const digits = [];
    while (num > 0) {
      digits.push(NUM[num % 10]);
      num = (num / 10) | 0;
    }
    return sign + digits.reverse().join('');
  }
}