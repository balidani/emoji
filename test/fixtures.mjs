// Golden-master fixtures for the RNG-trace harness (see REFACTOR_PLAN.md, Part D).
// Each fixture drives window.simulate(buyAlways, buyOnce, rounds) against a fixed
// seed phrase (set via the URL hash), producing a deterministic play-through.
// Strategies are taken from the pre-existing balancing runs commented out in main.js,
// chosen to spread coverage across as many symbol files as possible.

const ALL_EMOJI =
  '🎈🏦🔔💼🐛🎯🧈🍾🍒🐣🐔🍀🍹🪙🌽💳🔮💃💎🎲🐉🥁🥚💸🥠🦊🧊🫙🪄💰🌝❎🍍🍿📀🔀🪨🚀🎰🧵🌳🌋👷📮';

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
];
