// Golden-master fixtures for the RNG-trace harness.
// Each fixture drives window.simulate(buyAlways, buyOnce, rounds) against a fixed
// seed phrase (set via the URL hash), producing a deterministic play-through.
// Strategies are taken from the pre-existing balancing runs commented out in main.js,
// chosen to spread coverage across as many symbol files as possible.

const ALL_EMOJI =
  '🎈🏦🔔💼🐛🎯🧈🍾🍒🐣🐔🍀🍹🪙🌽💳🔮💃💎🎲🐉🥁🥚💸🥠🦊🧊🫙🪄💰🌝❎🍍🍿📀🔀🪨🚀🎰🧵🌳🌋👷📮🎟️🪦';

export const fixtures = [
  {
    name: 'basic-mult-coin',
    seed: 'golden-basic-mult-coin',
    buyAlways: '❎🪙',
    buyOnce: '🐛💰🔮🪄🏦🏦🏦',
  },
  {
    name: 'gems-rocks',
    seed: 'golden-gems-rocks',
    buyAlways: '❎💎🪨',
    buyOnce: '🐛👷🌋🔮🪄🎯',
  },
  {
    name: 'champagne-cocktail',
    seed: 'golden-champagne-cocktail',
    buyAlways: '🍾❎',
    buyOnce: '🍹🔮🔮🧊🧊🧊🍍🍍🍍🌳🌳',
  },
  {
    name: 'dragon-dice',
    seed: 'golden-dragon-dice',
    buyAlways: '❎🐉🎲',
    buyOnce: '🐛🪄🪄🎯🎯🔮🔮',
  },
  {
    name: 'record-drums-bell',
    seed: 'golden-record-drums-bell',
    buyAlways: '❎',
    buyOnce: '📀🐛🎯🪄🔮🔮🥁🥁🔔🔔🚀',
  },
  {
    name: 'card-hole-wand',
    seed: 'golden-card-hole-wand',
    buyAlways: '❎💳🕳️🪄',
    buyOnce: '🐛🎯🎯🎯🔮🔮🔮',
  },
  {
    name: 'egg-dragon-fox',
    seed: 'golden-egg-dragon-fox',
    buyAlways: '❎🥚🐉🦊',
    buyOnce: '🐛🪄🎯🎯🎯🔮🔮',
  },
  {
    name: 'briefcase-hole-wand',
    seed: 'golden-briefcase-hole-wand',
    buyAlways: '❎💼🕳️🪄🎯🔮',
    buyOnce: '🐛🐉🐉🐉',
  },
  {
    name: 'moon-rocket',
    seed: 'golden-moon-rocket',
    buyAlways: '❎🌝🚀',
    buyOnce: '🐛🔮🪄🎯',
  },
  {
    name: 'butter-popcorn',
    seed: 'golden-butter-popcorn',
    buyAlways: '❎🧈🍿',
    buyOnce: '🔮🔮🪄🌽🌽🌽🧊🧊🧊🎯🎯',
  },
  {
    name: 'broad-coverage',
    seed: 'golden-broad-coverage',
    buyAlways: '🔮🎰',
    buyOnce: ALL_EMOJI,
    rounds: 1,
  },
  {
    name: 'fixed-seed-olibvcin',
    seed: 'olibvcin',
    buyAlways: '❎🪙',
    buyOnce: '🐛💰🔮🪄🏦🏦🏦',
  },
  {
    // JOKER_DESIGN.md: locks in transform + survival (disguise removed) +
    // egg-hatch (disguise produces a replacement) + revert, across several
    // Jokers bought over the run.
    name: 'joker-wildcard',
    seed: 'golden-joker-wildcard',
    buyAlways: '❎🃏',
    buyOnce: '🐛🎯🎯🥚🥚🎈🎈',
  },
  {
    // PIRATE_DESIGN.md §8.2: ramps luck (🍀/🔮/🥠) so 🏴‍☠️ (rarity -0.1) gets
    // offered and bought, then locks in a 🏴‍☠️→📀 "earned" duplication next
    // to a 📀 on the board.
    name: 'pirate-records',
    seed: 'golden-pirate-records-3',
    buyAlways: '❎🍀🔮🥠📀🏴‍☠️',
    buyOnce: '',
  },
];
