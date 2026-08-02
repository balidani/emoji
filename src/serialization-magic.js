// Shared magic-tag constants for the two base64 export/import formats (save
// state vs. replay -- see save_state.js and replay.js). Factored out to a
// tiny dependency-free module so each format's parser can recognize *the
// other's* code and point the player at the right panel, instead of a
// generic "unrecognized format" error when they paste into the wrong one
// (the two panels sit right next to each other in the sidebar with nearly
// identical layouts, so this mix-up is easy to make).
export const SAVE_MAGIC = 'EMOJI1';
export const REPLAY_MAGIC = 'EMOJIRPLY1';
