// Export/import of the whole localStorage save state as base64. No
// encryption, no obfuscation.

import { toBase64Utf8, fromBase64Utf8 } from './core/util.js';
import { SAVE_MAGIC, REPLAY_MAGIC } from './serialization-magic.js';

const SAVE_KEYS = [
  'CurrentVersion',
  'ProgressionLevelData',
  'ProgressionActiveLevel',
  'ProgressionLevelResults',
  'ProgressionMode',
  'UnlockedBags',
  'PendingBagOffer',
  'SandboxGameLength',
  'Achievements',
  'ProfileStats',
];

export function exportSave() {
  const blob = {};
  for (const k of SAVE_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) blob[k] = v;
  }
  const payload = JSON.stringify({ magic: SAVE_MAGIC, data: blob });
  return toBase64Utf8(payload);
}

export function importSave(base64) {
  let parsed;
  try {
    const json = fromBase64Utf8(base64.trim());
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a valid save code.');
  }
  if (parsed.magic === REPLAY_MAGIC) {
    throw new Error(
      "That's a replay code -- paste it into the replay panel instead."
    );
  }
  if (parsed.magic !== SAVE_MAGIC || typeof parsed.data !== 'object') {
    throw new Error('Unrecognized save format.');
  }
  for (const k of SAVE_KEYS) {
    // Fully overwrite: a key absent from the imported data means that save
    // didn't have it set (e.g. no achievements unlocked yet), so it must
    // clear any existing value here too, not leave it untouched.
    if (parsed.data[k] !== undefined) {
      localStorage.setItem(k, parsed.data[k]);
    } else {
      localStorage.removeItem(k);
    }
  }
  window.location.reload(); // simplest correct way to re-init all subsystems
}
