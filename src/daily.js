// Daily Challenge shared config: the buyable pool excluded from Daily
// Challenge boards, and the canonical settings every Daily Challenge game --
// client and server validator alike -- constructs from. Pure data + pure
// functions only (no DOM, no network) so the AWS validate Lambda can import
// this file unmodified from its bundled copy of src/ (see
// DAILY_CHALLENGE_AWS_SETUP.md #4) and never disagree with the client about
// what's allowed.

import { GameSettings } from './game_settings.js';
import { FreeTurn } from './extra-symbols/beta.js';

// The 🎟️ ticket grants a bonus turn and voids achievements -- a poor fit for
// a competitive shared board. Referencing FreeTurn.emoji (rather than
// retyping the glyph) keeps this in lockstep with the symbol it excludes.
export const DAILY_EXCLUDED = new Set([FreeTurn.emoji]);

// The Daily Challenge buyable pool: every symbol the catalog knows about,
// minus DAILY_EXCLUDED. Excluding a symbol removes its shop draw entirely --
// generateShop() only rolls for isOffered() symbols (catalog.js) -- so this
// must be applied identically wherever a daily board is built (client record,
// client playback, server validation) or the RNG streams diverge. Every call
// site imports this exact function so they can never disagree.
export function dailyAllowedEmoji(catalog) {
  return new Set(
    [...catalog.symbols.keys()].filter((emoji) => !DAILY_EXCLUDED.has(emoji))
  );
}

// The canonical Daily Challenge board: same shape as the standard game
// (progression.js's standardGameSettings) -- fixed for every player, so a
// submitted replay's start state can be reconstructed from the day's seed
// alone. A single shared instance, same pattern as standardGameSettings;
// callers that hand its symbolSources to a Catalog should copy the array
// first (Catalog.updateSymbols() mutates whatever it's given -- see
// catalog.js and replay.js's ReplayRecorder for why).
export const DAILY_SETTINGS = new GameSettings('Daily Challenge');

// The day's challenge id is the UTC calendar date, so every player worldwide
// shares one board per day regardless of local time zone (see
// DAILY_CHALLENGE_DESIGN.md #4).
export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// The instant the next seed takes effect: the next UTC midnight after `now`
// -- the Daily Challenge day boundary todayUTC() itself is derived from.
export function nextSeedTime(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

// Player-facing "time left" label shown under the leaderboard
// (render/dailyLeaderboardList.js) -- takes `now` as a parameter (rather
// than reading Date.now() itself) so it's trivial to test at a fixed
// instant without faking the global clock.
export function formatTimeUntilNextSeed(now = new Date()) {
  const totalSeconds = Math.max(
    0,
    Math.floor((nextSeedTime(now).getTime() - now.getTime()) / 1000)
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `Next challenge in ${hours}h ${minutes}m`;
}
