// save_state.js's importSave -- see replay.test.js for the reverse
// direction (a save code pasted into the replay panel).
import { describe, it, expect } from 'vitest';
import { importSave } from '../../src/save_state.js';

describe('importSave', () => {
  it('rejects garbage input with a friendly error', () => {
    expect(() => importSave('not base64 at all!!')).toThrow(
      'Not a valid save code.'
    );
  });

  it('gives a pointer to the right panel when a replay code is pasted in by mistake', () => {
    const replayCode = btoa(
      unescape(
        encodeURIComponent(JSON.stringify({ magic: 'EMOJIRPLY1', events: [] }))
      )
    );
    expect(() => importSave(replayCode)).toThrow(
      "That's a replay code -- paste it into the replay panel instead."
    );
  });

  it('rejects a payload with an unrecognized magic tag', () => {
    const garbage = btoa(
      unescape(encodeURIComponent(JSON.stringify({ magic: 'NOPE' })))
    );
    expect(() => importSave(garbage)).toThrow('Unrecognized save format.');
  });
});
