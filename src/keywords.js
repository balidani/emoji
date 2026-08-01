// id -> { title, description }. Descriptions may themselves use emoji and
// [Display](id) tokens; they get linkified too, so keyword pages cross-link.
export const KEYWORDS = {
  pays: {
    title: 'Pays',
    description:
      'Gives you 💵. Amounts can be raised by a [Multiplier](multiplier), lowered by losses, or scaled by the board — each symbol says how.',
  },
  spawn: {
    title: 'Spawn',
    description: 'Creates a brand-new symbol on a nearby empty space.',
  },
  duplicate: {
    title: 'Duplicate',
    description: 'Copies an existing neighboring symbol onto empty space.',
  },
  transform: {
    title: 'Transform',
    description: 'Turns itself into a different symbol.',
  },
  consume: {
    title: 'Consume',
    description: 'Removes neighboring symbols and profits from them.',
  },
  stockpile: {
    title: 'Stockpile',
    description:
      'Permanently banks value from what it consumes, paying out a total that grows every turn.',
  },
  multiplier: {
    title: 'Multiplier',
    description: 'Multiplies the 💵 of nearby symbols.',
  },
  luck: {
    title: 'Luck',
    description:
      'Your luck stat: raises good [Chance](chance) rolls, lowers bad ones, and makes rare shop symbols more common.',
  },
  chance: {
    title: 'Chance',
    description:
      'The effect only fires on a random roll. [Luck](luck) tips the odds.',
  },
  risk: {
    title: 'Risk',
    description: 'A downside — this can cost you 💵 or destroy your symbols.',
  },
  tool: {
    title: 'Tool',
    description:
      'Acts once when bought (you pick a target); never appears on the board.',
  },
};
