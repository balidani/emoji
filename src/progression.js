import { GameSettings } from './game_settings.js';
import {
  GATES,
  remainingBags,
  unlockedEmoji,
  isProgressionComplete,
} from './progression-roster.js';
import { randomRemove } from './core/rng.js';

const tutorialLevelSettings = new GameSettings(
  'Tutorial #1',
  4,
  4,
  15,
  '🍒🍒🪙',
  ['./symbols/tutorial.js'],
  { 100: '🥇' },
  { 50: 'Welcome to the Tutorial!' }
);
const standardGameSettings = new GameSettings();

export const CURRENT_VERSION = '1.0.4';
const CURRENT_VERSION_KEY = 'CurrentVersion';
const PROGRESSION_LEVEL_DATA = 'ProgressionLevelData';
const PROGRESSION_ACTIVE_LEVEL = 'ProgressionActiveLevel';
const PROGRESSION_LEVEL_RESULTS = 'ProgressionLevelResults';
// `mode` is null until the first-run overlay (showModeSelectOverlay in
// app/bootstrap.js) sets it; `unlockedBags`/`pendingBagOffer` are only
// meaningful once mode === 'progression'.
// Exported so app/bootstrap.js can check the persisted mode straight from
// localStorage before a Progression instance exists yet -- it needs to know
// whether to trust the URL hash for RNG seeding before anything else runs.
export const PROGRESSION_MODE = 'ProgressionMode';
const UNLOCKED_BAGS = 'UnlockedBags';
const PENDING_BAG_OFFER = 'PendingBagOffer';
// Sandbox's player-chosen turn count (app/bootstrap.js's game settings
// panel), independent of a level's own gameLength/defaultGameLength -- null
// until the player customizes it, meaning "use the level's default".
const SANDBOX_GAME_LENGTH = 'SandboxGameLength';
// Unset (absent from localStorage) until the player has been shown the
// mode-select overlay at least once. bootstrap.js shows that overlay again
// on load whenever this is false -- even for a returning player who
// already has a mode picked from before Daily Challenge existed -- so
// everyone gets one look at it, then switches modes via the sidebar's
// "game mode" menu from then on.
const HAS_SEEN_DAILY_CHALLENGE = 'HasSeenDailyChallenge';

// Achievements/profile stats survive both a version-bump wipe and the manual
// "wipe progress" button.
const PRESERVE_ON_WIPE = ['Achievements', 'ProfileStats'];

function selectiveWipe() {
  const saved = {};
  for (const k of PRESERVE_ON_WIPE) {
    const v = window.localStorage.getItem(k);
    if (v !== null) saved[k] = v;
  }
  window.localStorage.clear();
  for (const [k, v] of Object.entries(saved)) {
    window.localStorage.setItem(k, v);
  }
}

export class LevelResult {
  constructor(highScore, reward) {
    this.highScore = highScore || Number.MIN_SAFE_INTEGER;
    this.reward = reward || '';
  }
}

export class Progression {
  constructor(progressionView, settingsView, reload) {
    this.view = progressionView;
    this.reload = reload;
    this.levelData = [tutorialLevelSettings, standardGameSettings];
    for (const settings of this.levelData) {
      settings.attachView(settingsView, this.reload);
    }
    this.activeLevel = 1;
    this.levelResults = new Map();
    // Progression-mode state. `mode` is null until a mode is chosen;
    // `unlockedBags` is draw order, not bag index order; `pendingBagOffer`
    // is the up-to-3 offer awaiting a pick, or empty when none is pending.
    this.mode = null;
    this.unlockedBags = [];
    this.pendingBagOffer = [];
    this.sandboxGameLength = null;
    this.hasSeenDailyChallenge = false;
  }
  load() {
    if (!window.localStorage.getItem(CURRENT_VERSION_KEY)) {
      selectiveWipe();
      window.localStorage.setItem(CURRENT_VERSION_KEY, CURRENT_VERSION);
    }
    if (window.localStorage.getItem(CURRENT_VERSION_KEY) !== CURRENT_VERSION) {
      selectiveWipe();
    }
    const levelData = window.localStorage.getItem(PROGRESSION_LEVEL_DATA);
    if (levelData !== null) {
      this.levelData = JSON.parse(levelData);
    }
    const activeLevel = window.localStorage.getItem(PROGRESSION_ACTIVE_LEVEL);
    if (activeLevel !== null) {
      this.activeLevel = Number(activeLevel);
    }
    const levelResults = window.localStorage.getItem(PROGRESSION_LEVEL_RESULTS);
    if (levelResults !== null) {
      this.levelResults = new Map(JSON.parse(levelResults));
    }
    const mode = window.localStorage.getItem(PROGRESSION_MODE);
    if (mode !== null) {
      this.mode = mode;
    }
    const unlockedBags = window.localStorage.getItem(UNLOCKED_BAGS);
    if (unlockedBags !== null) {
      this.unlockedBags = JSON.parse(unlockedBags);
    }
    const pendingBagOffer = window.localStorage.getItem(PENDING_BAG_OFFER);
    if (pendingBagOffer !== null) {
      this.pendingBagOffer = JSON.parse(pendingBagOffer);
    }
    const sandboxGameLength = window.localStorage.getItem(SANDBOX_GAME_LENGTH);
    if (sandboxGameLength !== null) {
      this.sandboxGameLength = JSON.parse(sandboxGameLength);
    }
    this.hasSeenDailyChallenge =
      window.localStorage.getItem(HAS_SEEN_DAILY_CHALLENGE) === 'true';
  }
  save() {
    window.localStorage.setItem(
      PROGRESSION_LEVEL_DATA,
      JSON.stringify(this.levelData)
    );
    window.localStorage.setItem(PROGRESSION_ACTIVE_LEVEL, this.activeLevel);
    window.localStorage.setItem(
      PROGRESSION_LEVEL_RESULTS,
      JSON.stringify(Array.from(this.levelResults))
    );
    if (this.mode !== null) {
      window.localStorage.setItem(PROGRESSION_MODE, this.mode);
    }
    window.localStorage.setItem(
      UNLOCKED_BAGS,
      JSON.stringify(this.unlockedBags)
    );
    window.localStorage.setItem(
      PENDING_BAG_OFFER,
      JSON.stringify(this.pendingBagOffer)
    );
    window.localStorage.setItem(
      SANDBOX_GAME_LENGTH,
      JSON.stringify(this.sandboxGameLength)
    );
    // Only ever written once true -- stays genuinely absent (not just
    // 'false') until then, matching "unset by default".
    if (this.hasSeenDailyChallenge) {
      window.localStorage.setItem(HAS_SEEN_DAILY_CHALLENGE, 'true');
    }
  }
  // Switching into Progression always lands on each level's designed turn
  // count, discarding any Sandbox turn customization for the session --
  // switching back into Sandbox restores it. Keeps the two modes' turn
  // counts independent despite sharing the same GameSettings instances.
  // Daily Challenge touches neither -- it plays from its own fixed
  // GameSettings instance (src/daily.js's DAILY_SETTINGS), never
  // this.levelData.
  setMode(mode) {
    if (mode === 'progression') {
      for (const settings of this.levelData) {
        settings.gameLength = settings.defaultGameLength;
      }
    } else if (mode === 'sandbox' && this.sandboxGameLength !== null) {
      this.levelData[this.activeLevel].gameLength = this.sandboxGameLength;
    }
    this.mode = mode;
    this.save();
  }
  // Sandbox-only turn override (app/bootstrap.js's game settings panel).
  // Persisted separately from the level's own gameLength so it survives a
  // round-trip through Progression mode -- see setMode().
  setSandboxTurns(gameLength) {
    this.levelData[this.activeLevel].gameLength = gameLength;
    this.sandboxGameLength = gameLength;
    this.save();
  }
  // Called once, the moment app/bootstrap.js decides to show the
  // mode-select overlay -- whether that's a true first run or a returning
  // player who's never seen Daily Challenge -- so it never shows again
  // after this session.
  markDailyChallengeSeen() {
    this.hasSeenDailyChallenge = true;
    this.save();
  }
  // Manual "reset progression" (game settings menu + the dev-only level
  // strip's Wipe Progress button both call this). Same selective wipe as a
  // version bump -- achievements/profile stats survive, everything else
  // (including the chosen mode) is cleared, so the next load lands back on
  // the first-run mode-select overlay.
  resetProgression() {
    selectiveWipe();
    window.location.reload();
  }
  // The unlocked buyable pool for Progression mode -- Sandbox never calls
  // this (its catalog is never restricted). Pure passthrough to
  // progression-roster.js's data.
  unlockedEmoji() {
    return unlockedEmoji(this.unlockedBags);
  }
  // True once every bag has been unlocked, regardless of which mode is
  // currently active -- unlockedBags persists across Sandbox/Progression
  // switches (see setMode()), so this reflects "has Progression ever been
  // completed", not "is Progression currently maxed out". Gates the
  // Simulator link in the game settings panel (app/bootstrap.js).
  isComplete() {
    return isProgressionComplete(this.unlockedBags);
  }
  // Called on game over with the final score (Game.over(), real games only
  // -- see game.js's `!isReplay` guard). No-op outside Progression mode,
  // once fully unlocked, or while an offer is already pending (a reload
  // before choosing must not reroll it).
  checkGateAndRollOffer(score) {
    if (this.mode !== 'progression') {
      return;
    }
    if (this.pendingBagOffer.length > 0) {
      return;
    }
    if (this.unlockedBags.length >= GATES.length) {
      return;
    }
    const gate = GATES[this.unlockedBags.length];
    if (score < gate.threshold) {
      return;
    }
    const pool = remainingBags(this.unlockedBags);
    const offer = [];
    const offerSize = Math.min(3, pool.length);
    for (let i = 0; i < offerSize; i++) {
      offer.push(randomRemove(pool));
    }
    this.pendingBagOffer = offer;
    this.save();
  }
  // Commits a pick from the pending offer: the chosen bag joins
  // unlockedBags, the rest of the offer returns to the pool (simply by
  // clearing pendingBagOffer -- it was never removed from `pool` above).
  commitBagChoice(bagIndex) {
    if (!this.pendingBagOffer.includes(bagIndex)) {
      throw new Error(`${bagIndex} is not part of the current bag offer.`);
    }
    this.unlockedBags.push(bagIndex);
    this.pendingBagOffer = [];
    this.save();
  }
  postResultAndAdvance(score, result) {
    const aLD = this.levelData[this.activeLevel];
    let existingRecord = this.levelResults.get(aLD.name);
    if (!existingRecord || score > existingRecord.highScore) {
      this.levelResults.set(aLD.name, new LevelResult(score, result));
    }
    existingRecord = this.levelResults.get(aLD.name);
    if (existingRecord.reward && this.activeLevel + 1 < this.levelData.length) {
      this.activeLevel++;
    }
    this.save();
  }
  jumpTo(index) {
    this.activeLevel = index;
    this.save();
    this.reload(this.levelData[index]);
  }
  updateUi() {
    const levels = this.levelData.map((data, i) => {
      const record = this.levelResults.get(data.name);
      return {
        name: data.name,
        beaten: record != null,
        reward: record ? record.reward : undefined,
        highScore: record ? record.highScore : undefined,
        active: i === this.activeLevel,
      };
    });
    this.view.render(levels, {
      onJumpTo: (i) => this.jumpTo(i),
      onWipe: () => this.resetProgression(),
    });
  }
}
