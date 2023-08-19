export class Constants {
  static statusOrder = ['fear', 'weak', 'slow', 'dizzy', 'sleep', 'poison', 'bleed'];
  static enemyOrder = ['slime', 'ghost', 'robot', 'clown', 'goblin', 'ogre', 'alien', 'skeleton', 
    'troll', 'zombie', 'djinn', 'elf', 'mermaid', 'vampire', 'fairy', 'mage', 'villain'];
  static attribOrder = ['hp', 'fencing', 'strength', 'speed', 'accuracy'];
  static levelableAttribs = ['hp', 'fencing', 'strength', 'speed', 'accuracy'];
  static equipOrder = ['head', 'body', 'hands', 'feet', 'finger', 'weapon'];

  static enemies = {
    'slime': {'fencing': 1, 'strength': 1, 'speed': 1, 'accuracy': 1},
    'ghost': {'fencing': 1, 'strength': 2, 'speed': 2, 'accuracy': 2},
    'robot': {'fencing': 2, 'strength': 4, 'speed': 3, 'accuracy': 2},
    'clown': {'fencing': 4, 'strength': 3, 'speed': 4, 'accuracy': 3},
    'goblin': {'fencing': 4, 'strength': 7, 'speed': 3, 'accuracy': 4},
    'ogre': {'fencing': 4, 'strength': 8, 'speed': 4, 'accuracy': 5},
    'alien': {'fencing': 4, 'strength': 10, 'speed':  5, 'accuracy': 5},
    'skeleton': {'fencing': 7, 'strength': 14, 'speed':  5, 'accuracy': 5},
    'troll': {'fencing': 7, 'strength': 12, 'speed':  9, 'accuracy': 8},
    'zombie': {'fencing': 10, 'strength':  14, 'speed':  11, 'accuracy':  9},
    'djinn': {'fencing': 10, 'strength':  16, 'speed':  12, 'accuracy':  12},
    'elf': {'fencing': 13, 'strength':  13, 'speed':  13, 'accuracy':  13},
    'mermaid': {'fencing': 15, 'strength':  15, 'speed':  15, 'accuracy':  14},
    'vampire': {'fencing': 17, 'strength':  17, 'speed':  16, 'accuracy':  15},
    'fairy': {'fencing': 18, 'strength':  17, 'speed':  19, 'accuracy':  18},
    'mage': {'fencing': 19, 'strength':  19, 'speed':  17, 'accuracy':  19},
    'villain': {'fencing': 20, 'strength':  20, 'speed':  20, 'accuracy':  20},
  };
}
