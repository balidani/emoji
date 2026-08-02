// Pure serialization/parsing tests for ReplayRecorder (see REPLAY_PLAN.md
// section 5-6). No DOM, no live Game -- see replay-roundtrip.test.js for the
// end-to-end determinism check under a real Game/renderer.
import { describe, it, expect } from 'vitest';
import { ReplayRecorder, parseReplay } from '../../src/replay.js';

const makeRecorder = (overrides = {}) =>
  new ReplayRecorder({
    seedPhrase: 'my-seed',
    rngState: { main: [1, 2, 3, 4], shop: [5, 6, 7, 8] },
    settings: {
      boardX: 5,
      boardY: 5,
      gameLength: 50,
      startingSet: '🍒🍒🍒',
      symbolSources: ['./symbols/money.js'],
      initiallyLockedCells: {},
      // Presentational fields a real GameSettings carries but the recorder
      // must not snapshot (see REPLAY_PLAN.md section 6).
      resultLookup: { 100: '🥇' },
      textLookup: { greeting: 'hi' },
      ...overrides,
    },
  });

describe('ReplayRecorder', () => {
  it('records roll/refresh/buy events as compact tuples, in order', () => {
    const rec = makeRecorder();
    rec.recordRoll();
    rec.recordRefresh();
    rec.recordBuy(2, '🔮');
    rec.recordRoll();

    expect(rec.events).toEqual([['r'], ['f'], ['b', 2, '🔮'], ['r']]);
  });

  it('folds a tool target into the most recent buy event', () => {
    const rec = makeRecorder();
    rec.recordBuy(0, '📌');
    rec.recordToolTarget(2, 3);

    expect(rec.events).toEqual([['b', 0, '📌', 2, 3]]);
  });

  it('records a null tool target distinctly from "not a tool buy" (no trailing entries)', () => {
    const rec = makeRecorder();
    rec.recordBuy(0, '📌'); // e.g. cancelled, or no cell could ever match
    rec.recordToolTarget(null);
    rec.recordBuy(1, '🔮'); // an ordinary, non-tool buy right after

    expect(rec.events).toEqual([
      ['b', 0, '📌', null],
      ['b', 1, '🔮'],
    ]);
  });

  it('serialize() drops presentational settings fields (resultLookup/textLookup)', () => {
    const rec = makeRecorder();
    const parsed = parseReplay(rec.serialize());

    expect(parsed.settings).toEqual({
      boardX: 5,
      boardY: 5,
      gameLength: 50,
      startingSet: '🍒🍒🍒',
      symbolSources: ['./symbols/money.js'],
      initiallyLockedCells: {},
    });
  });

  it('serialize()/parseReplay() round-trips the seed, RNG state, and events exactly, and survives emoji through base64', () => {
    const rec = makeRecorder();
    rec.recordRoll();
    rec.recordBuy(0, '📌', undefined);
    rec.recordToolTarget(1, 1);

    const parsed = parseReplay(rec.serialize());

    expect(parsed.seed).toBe('my-seed');
    expect(parsed.rng).toEqual({ main: [1, 2, 3, 4], shop: [5, 6, 7, 8] });
    expect(parsed.events).toEqual([['r'], ['b', 0, '📌', 1, 1]]);
  });
});

describe('parseReplay', () => {
  it('rejects garbage input with a friendly error', () => {
    expect(() => parseReplay('not base64 at all!!')).toThrow(
      'Not a valid replay code.'
    );
  });

  it('rejects a base64 payload with the wrong magic tag', () => {
    const wrongMagic = btoa(
      unescape(encodeURIComponent(JSON.stringify({ magic: 'NOPE' })))
    );
    expect(() => parseReplay(wrongMagic)).toThrow(
      'Unrecognized replay format.'
    );
  });

  it('rejects a payload missing required fields', () => {
    const rec = makeRecorder();
    const parsed = JSON.parse(
      decodeURIComponent(escape(atob(rec.serialize())))
    );
    delete parsed.events;
    const malformed = btoa(
      unescape(encodeURIComponent(JSON.stringify(parsed)))
    );
    expect(() => parseReplay(malformed)).toThrow('Malformed replay data.');
  });

  it('tolerates surrounding whitespace (a pasted code)', () => {
    const rec = makeRecorder();
    const parsed = parseReplay(`  \n${rec.serialize()}\n  `);
    expect(parsed.seed).toBe('my-seed');
  });
});
