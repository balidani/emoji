export class Constants {
  static screenWidth = 950;
  static combatSpeed = 300;

  static statusOrder = ['fear', 'weak', 'slow', 'dizzy', 'sleep', 'poison', 'bleed'];
  static enemyOrder = ['slime', 'ghost', 'robot', 'clown', 'goblin', 'ogre', 'alien', 'skeleton', 
    'troll', 'zombie', 'elf', 'djinn', 'mermaid', 'vampire', 'fairy', 'mage', 'villain'];
  static attribOrder = ['hp', 'fencing', 'strength', 'speed', 'accuracy'];
  static levelableAttribs = ['fencing', 'strength', 'speed', 'accuracy'];
  static equipOrder = ['head', 'body', 'hands', 'feet', 'finger', 'weapon'];

  static enemies = {
    'slime': {
      attribs: {fencing: 1, strength: 1, speed: 1, accuracy: 1},
      equips: {'weapon': {name: 'spoon', attribs: {damage: 1}}},
    },
    'ghost': {
      attribs: {fencing: 1, strength: 2, speed: 2, accuracy: 2},
      equips: {'weapon': {name: 'spoon', attribs: {damage: 2}}},
    },
    'robot': {
      attribs: {fencing: 2, strength: 4, speed: 3, accuracy: 2},
      equips: {'weapon': {name: 'screwdriver', attribs: {damage: 3}}},
    },
    'clown': {
      attribs: {fencing: 4, strength: 3, speed: 4, accuracy: 3},
      equips: {'weapon': {name: 'wrench', attribs: {damage: 3}}},
    },
    'goblin': {
      attribs: {fencing: 4, strength: 7, speed: 3, accuracy: 4},
      equips: {'weapon': {name: 'axe', attribs: {damage: 4}}},
    },
    'ogre': {
      attribs: {fencing: 4, strength: 8, speed: 4, accuracy: 5},
      equips: {'weapon': {name: 'pickaxe', attribs: {damage: 5}}},
    },
    'alien': {
      attribs: {fencing: 4, strength: 10, speed:  5, accuracy: 5},
      equips: {'weapon': {name: 'screwdriver', attribs: {damage: 6}}},
    },
    'skeleton': {
      attribs: {fencing: 7, strength: 14, speed:  5, accuracy: 5},
      equips: {'weapon': {name: 'knife', attribs: {damage: 7}}},
    },
    'troll': {
      attribs: {fencing: 7, strength: 12, speed:  9, accuracy: 8},
      equips: {'weapon': {name: 'hammer', attribs: {damage: 8}}},
    },
    'zombie': {
      attribs: {fencing: 10, strength:  14, speed:  11, accuracy:  9},
      equips: {'weapon': {name: 'saw', attribs: {damage: 9}}},
    },
    'elf': {
      attribs: {fencing: 10, strength:  16, speed:  12, accuracy:  12},
      equips: {'weapon': {name: 'bow', attribs: {damage: 11}}},
    },
    'djinn': {
      attribs: {fencing: 13, strength:  13, speed:  13, accuracy:  13},
      equips: {'weapon': {name: 'wand', attribs: {damage: 13}}},
    },
    'mermaid': {
      attribs: {fencing: 15, strength:  15, speed:  15, accuracy:  14},
      equips: {'weapon': {name: 'trident', attribs: {damage: 14}}},
    },
    'vampire': {
      attribs: {fencing: 17, strength:  17, speed:  16, accuracy:  15},
      equips: {'weapon': {name: 'dagger', attribs: {damage: 15}}},
    },
    'fairy': {
      attribs: {fencing: 18, strength:  17, speed:  19, accuracy:  18},
      equips: {'weapon': {name: 'wand', attribs: {damage: 16}}},
    },
    'mage': {
      attribs: {fencing: 19, strength:  19, speed:  17, accuracy:  19},
      equips: {'weapon': {name: 'wand', attribs: {damage: 18}}},
    },
    'villain': {
      attribs: {fencing: 20, strength:  20, speed:  20, accuracy:  20},
      equips: {'weapon': {name: 'dagger', attribs: {damage: 20}}},
    },
  };
}
