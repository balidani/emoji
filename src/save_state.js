// Export/import of the whole localStorage save state as base64 (see
// ACHIEVEMENTS_DESIGN.md, section 9). No encryption, no obfuscation.

const SAVE_KEYS = [
  'CurrentVersion',
  'ProgressionLevelData',
  'ProgressionActiveLevel',
  'ProgressionLevelResults',
  'Achievements',
  'ProfileStats',
];

const MAGIC = 'EMOJI1'; // format tag for forward-compat + import validation

export function exportSave() {
  const blob = {};
  for (const k of SAVE_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) blob[k] = v;
  }
  const payload = JSON.stringify({ magic: MAGIC, data: blob });
  // btoa is Latin1-only; encodeURIComponent+unescape makes it UTF-8 safe
  // (progression JSON and ProfileStats.transforms contain emoji).
  return btoa(unescape(encodeURIComponent(payload)));
}

export function importSave(base64) {
  let parsed;
  try {
    const json = decodeURIComponent(escape(atob(base64.trim())));
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a valid save code.');
  }
  if (parsed.magic !== MAGIC || typeof parsed.data !== 'object') {
    throw new Error('Unrecognized save format.');
  }
  for (const k of SAVE_KEYS) {
    if (parsed.data[k] !== undefined) localStorage.setItem(k, parsed.data[k]);
  }
  window.location.reload(); // simplest correct way to re-init all subsystems
}
