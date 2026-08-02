// core/rng.js's exportState/importState (see REPLAY_PLAN.md section 3):
// replay reproduces a game by pinning the RNG to a captured mid-session
// position, not by re-seeding from the phrase (the RNG is seeded once per
// page load and never re-seeded between games).
import { describe, it, expect, beforeEach } from 'vitest';
import * as Rng from '../../src/core/rng.js';

describe('core/rng.js RNG state', () => {
  beforeEach(async () => {
    await Rng.setSeed('rng-state-test');
  });

  it('exportState/importState round-trips: restoring a snapshot reproduces the exact same subsequent draws', () => {
    // Advance both streams a bit before snapshotting, so this isn't just
    // testing the state right after setSeed.
    for (let i = 0; i < 5; ++i) {
      Rng.randomFloat();
      Rng.randomFloat(/* shop= */ true);
    }
    const snapshot = Rng.exportState();

    const mainAfterSnapshot = Array.from({ length: 10 }, () =>
      Rng.randomFloat()
    );
    const shopAfterSnapshot = Array.from({ length: 10 }, () =>
      Rng.randomFloat(true)
    );

    Rng.importState(snapshot);

    const mainReplayed = Array.from({ length: 10 }, () => Rng.randomFloat());
    const shopReplayed = Array.from({ length: 10 }, () =>
      Rng.randomFloat(true)
    );

    expect(mainReplayed).toEqual(mainAfterSnapshot);
    expect(shopReplayed).toEqual(shopAfterSnapshot);
  });

  it('the two streams are independent: drawing from one leaves the other snapshot unchanged', () => {
    const before = Rng.exportState();
    Rng.randomFloat(); // advance main only
    const afterMainDraw = Rng.exportState();
    expect(afterMainDraw.shop).toEqual(before.shop);
    expect(afterMainDraw.main).not.toEqual(before.main);

    Rng.randomFloat(true); // advance shop only
    const afterShopDraw = Rng.exportState();
    expect(afterShopDraw.main).toEqual(afterMainDraw.main);
    expect(afterShopDraw.shop).not.toEqual(afterMainDraw.shop);
  });

  it('exportState returns a value snapshot, not a live reference that later draws mutate', () => {
    const snapshot = Rng.exportState();
    const before = JSON.stringify(snapshot);
    Rng.randomFloat();
    Rng.randomFloat(true);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});
