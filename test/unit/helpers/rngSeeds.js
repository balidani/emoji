// Deterministic "seed steering" (UNIT_TEST_PLAN.md section 6, technique 1).
//
// `chance`/`badChance`-gated symbols need both branches pinned down. The
// game itself gives us a lever for the *positive* chance / *negative*
// badChance branch (a 🎯 BullsEye neighbor forces it, see symbol.js), but
// there is no in-game "always fail" token for the opposite direction. So
// for that direction we brute-force search short seed phrases (the RNG is
// a deterministic function of the seed, so this search itself is fully
// reproducible -- it is not flaky randomness) until the *next* draw
// satisfies `predicate`, then reseed so the draw is fresh for the test.
import { setSeed, randomFloat } from '../../../src/core/rng.js';

export async function seedFirstDraw(
  predicate,
  { prefix = 'seed', tries = 2000 } = {}
) {
  for (let i = 0; i < tries; ++i) {
    const candidate = `${prefix}-${i}`;
    await setSeed(candidate);
    if (predicate(randomFloat())) {
      await setSeed(candidate); // reseed: replay the same draw fresh
      return candidate;
    }
  }
  throw new Error(
    `seedFirstDraw: no seed found matching predicate within ${tries} tries (prefix=${prefix})`
  );
}
