// Progression-mode roster: the 53-symbol playable catalog, divided into a
// 17-symbol starting pool and six 6-symbol bags unlocked one at a time. Pure
// data -- no DOM, no RNG.
import { BronzeMedal, SilverMedal, GoldMedal, Trophy } from './symbols/ui.js';
import { formatBigNumber } from './core/util.js';

export const STARTING_POOL = [
  '🪙',
  '💰',
  '🏦',
  '🍒',
  '🌳',
  '🌽',
  '🐣',
  '🐔',
  '🔔',
  '🥁',
  '🪨',
  '💎',
  '🍀',
  '🔀',
  '❎',
  '🎈',
  '🌝',
];

export const BAGS = [
  ['🐉', '🌋', '💼', '🥠', '🧵', '📌'], // bag 0
  ['🦊', '👷', '🔮', '🃏', '🚀', '🏴‍☠️'], // bag 1
  ['💳', '🎯', '🧑‍🎄', '☁️', '🎰', '🪓'], // bag 2
  ['🐛', '🍹', '🫙', '🪄', '🎁', '🧿'], // bag 3
  ['🍍', '🎲', '📀', '🧊', '🛍️', '🍾'], // bag 4
  ['🥚', '🧈', '🍿', '💸', '🕳️', '📮'], // bag 5
];

// Step number = unlockedBags.length; GATES[step] is the medal threshold
// needed to unlock the next bag: two clears each of Bronze and Silver, then
// Gold, then Trophy for the sixth and final bag.
export const GATES = [
  BronzeMedal,
  BronzeMedal,
  SilverMedal,
  SilverMedal,
  GoldMedal,
  Trophy,
];

// The full 53-symbol roster in a stable, deterministic order: starting pool
// first, then each bag in index order. Used to drive the sidebar's
// full-roster listing (locked entries greyed out).
export const FULL_ROSTER = [...STARTING_POOL, ...BAGS.flat()];

// unlockedBags: array/iterable of bag indices already unlocked.
export function unlockedEmoji(unlockedBags) {
  const result = new Set(STARTING_POOL);
  for (const bagIndex of unlockedBags) {
    for (const emoji of BAGS[bagIndex]) {
      result.add(emoji);
    }
  }
  return result;
}

// The medal threshold (as an ui.js medal class) required to unlock the next
// bag, given how many bags are already unlocked. `null` once every bag is
// unlocked.
export function nextGate(unlockedBags) {
  const step = unlockedBags.length;
  return step < GATES.length ? GATES[step] : null;
}

// Bag indices not yet unlocked, ascending. The draft offer is always sampled
// from this set (offered-but-unpicked bags return to the pool).
export function remainingBags(unlockedBags) {
  const unlocked = new Set(unlockedBags);
  return BAGS.map((_, i) => i).filter((i) => !unlocked.has(i));
}

// Minimal one-line progression status ("4/6, next 🥇 (💵25000)", or "6/6,
// full roster!" once nothing's left to unlock). Pure text, DOM-free, so
// every surface that shows progression state renders identically from one
// source of truth -- currently just the progression bar
// (render/progressionBar.js).
export function progressionStatusText(unlockedBags) {
  const count = `${unlockedBags.length}/${GATES.length}`;
  const gate = nextGate(unlockedBags);
  if (gate === null) {
    return `${count}, full roster!`;
  }
  return `${count}, next ${gate.emoji} (💵${formatBigNumber(gate.threshold)})`;
}
