// @vitest-environment jsdom
// PROGRESSION_DESIGN.md sections 3, 5, 7 -- gate evaluation + the
// choose-1-of-3 draft, on the real Progression class backed by real
// localStorage (jsdom). No DOM rendering is exercised here.
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { Progression } from '../../src/progression.js';
import { BAGS, GATES } from '../../src/progression-roster.js';

const fakeSettingsView = { registerOpener() {} };
const noop = () => {};

function buildProgression() {
  const p = new Progression({}, fakeSettingsView, noop);
  // Mirrors bootstrap.js: load() is always called right after construction.
  // It also stamps CURRENT_VERSION_KEY on first run, which matters for the
  // persistence test below -- without it, a second instance's load() would
  // see no version key and selectively wipe localStorage before reading.
  p.load();
  return p;
}

describe('Progression gate evaluation + draft', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setSeed('progression-gates');
  });

  it('is a no-op outside Progression mode', () => {
    const p = buildProgression();
    p.mode = 'sandbox';
    p.checkGateAndRollOffer(999999);
    expect(p.pendingBagOffer).toEqual([]);
    expect(p.unlockedBags).toEqual([]);
  });

  it('is a no-op when the score falls short of the gate', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.checkGateAndRollOffer(GATES[0].threshold - 1);
    expect(p.pendingBagOffer).toEqual([]);
  });

  it('rolls an offer of min(3, remaining) bags once the gate clears', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.checkGateAndRollOffer(GATES[0].threshold);
    expect(p.pendingBagOffer).toHaveLength(3);
    expect(new Set(p.pendingBagOffer).size).toBe(3); // no duplicates
    for (const bagIndex of p.pendingBagOffer) {
      expect(bagIndex).toBeGreaterThanOrEqual(0);
      expect(bagIndex).toBeLessThan(BAGS.length);
    }
  });

  it('does not reroll an already-pending offer (reload-safe)', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.checkGateAndRollOffer(GATES[0].threshold);
    const firstOffer = [...p.pendingBagOffer];
    p.checkGateAndRollOffer(GATES[0].threshold); // called again, e.g. after a reload
    expect(p.pendingBagOffer).toEqual(firstOffer);
  });

  it('shrinks the offer to the remaining bag count late in progression', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.unlockedBags = [0, 1, 2, 3]; // 2 bags remain
    p.checkGateAndRollOffer(GATES[4].threshold);
    expect(p.pendingBagOffer).toHaveLength(2);
  });

  it('is a no-op once every bag is unlocked', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.unlockedBags = [0, 1, 2, 3, 4, 5];
    p.checkGateAndRollOffer(Number.MAX_SAFE_INTEGER);
    expect(p.pendingBagOffer).toEqual([]);
  });

  it('commitBagChoice moves the pick into unlockedBags and clears the offer', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.checkGateAndRollOffer(GATES[0].threshold);
    const [chosen] = p.pendingBagOffer;
    p.commitBagChoice(chosen);
    expect(p.unlockedBags).toEqual([chosen]);
    expect(p.pendingBagOffer).toEqual([]);
  });

  it('commitBagChoice rejects a bag that was not offered', () => {
    const p = buildProgression();
    p.mode = 'progression';
    p.checkGateAndRollOffer(GATES[0].threshold);
    const notOffered = BAGS.map((_, i) => i).find(
      (i) => !p.pendingBagOffer.includes(i)
    );
    expect(() => p.commitBagChoice(notOffered)).toThrow();
  });

  it('all six bags are reachable across six clears', () => {
    const p = buildProgression();
    p.mode = 'progression';
    for (let step = 0; step < GATES.length; step++) {
      p.checkGateAndRollOffer(GATES[step].threshold);
      expect(p.pendingBagOffer.length).toBeGreaterThan(0);
      p.commitBagChoice(p.pendingBagOffer[0]);
    }
    expect(new Set(p.unlockedBags)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(p.unlockedEmoji().size).toBe(54);
  });

  it('isComplete is false until every bag is unlocked', () => {
    const p = buildProgression();
    p.unlockedBags = [0, 1, 2, 3, 4];
    expect(p.isComplete()).toBe(false);
    p.unlockedBags = [0, 1, 2, 3, 4, 5];
    expect(p.isComplete()).toBe(true);
  });

  it('isComplete stays true after switching to Sandbox', () => {
    const p = buildProgression();
    p.unlockedBags = [0, 1, 2, 3, 4, 5];
    p.setMode('sandbox');
    expect(p.isComplete()).toBe(true);
  });

  it('persists mode/unlockedBags/pendingBagOffer across load()', () => {
    const p = buildProgression();
    p.setMode('progression');
    p.checkGateAndRollOffer(GATES[0].threshold);
    p.commitBagChoice(p.pendingBagOffer[0] ?? 0);

    const reloaded = buildProgression();
    reloaded.load();
    expect(reloaded.mode).toBe('progression');
    expect(reloaded.unlockedBags).toEqual(p.unlockedBags);
    expect(reloaded.pendingBagOffer).toEqual(p.pendingBagOffer);
  });
});
