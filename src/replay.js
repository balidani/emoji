// Replay recording + playback. A replay is fully specified by the starting
// RNG state, a gameplay-affecting settings snapshot, and the ordered list of
// player actions -- see core/rng.js for why the RNG *state* (not just the
// seed phrase) has to be captured.

import { toBase64Utf8, fromBase64Utf8 } from './core/util.js';
import { CURRENT_VERSION } from './progression.js';
import { unlockedEmoji } from './progression-roster.js';
import * as Rng from './core/rng.js';
import * as Const from './consts.js';
import { Catalog } from './catalog.js';
import { Game } from './game.js';
import { GameSettings } from './game_settings.js';
import { ReplayRenderer } from './render/ReplayRenderer.js';
import { SimRenderer } from './render/SimRenderer.js';
import { ReplayDivergenceError } from './replay-errors.js';
import { animationOff, animationOn } from './render/animations.js';
import { renderProgressionBar } from './render/progressionBar.js';
import { SAVE_MAGIC, REPLAY_MAGIC as MAGIC } from './serialization-magic.js';
import { dailyAllowedEmoji, DAILY_SETTINGS } from './daily.js';

export { ReplayDivergenceError };

// Passive observer attached to a live Game (see game.js's `recorder` field
// and the `stats?.`/`achievements?.` idiom it mirrors). Hard invariant:
// no DOM access, no RNG draws, no game-state mutation -- it only reads
// existing values and appends to a plain array. This is what keeps
// `npm test`'s golden traces byte-identical with the hooks wired in.
export class ReplayRecorder {
  // `progression` is the live Progression instance (optional -- tests that
  // only care about GameSettings-level determinism can omit it, same as
  // before this field existed). Progression mode is gameplay-affecting: in
  // Progression mode the shop's catalog is narrowed to the unlocked bags
  // (Catalog.restrictTo(), wired in bootstrap.js's loadSettings), and that
  // narrowing changes which symbols generateShop()'s RNG draws even
  // consider -- see catalog.js's isOffered()/generateShop(). Replaying
  // without reproducing that same restriction draws a different shop than
  // the one that was actually played, which runReplay() surfaces as a
  // divergence (or worse, silently plays out differently).
  constructor({
    seedPhrase,
    rngState,
    settings,
    progression = null,
    events = [],
  }) {
    this.seedPhrase = seedPhrase;
    this.rngState = rngState;
    // Only gameplay-affecting fields -- resultLookup/textLookup are
    // presentational and can default on replay without changing outcomes.
    // symbolSources is copied, not aliased: Catalog.updateSymbols() mutates
    // whatever array it's given (unshifts './symbol.js' onto it) on every
    // game load, including future ones sharing the same GameSettings
    // instance -- a copy keeps this snapshot frozen at record time.
    this.settings = {
      boardX: settings.boardX,
      boardY: settings.boardY,
      gameLength: settings.gameLength,
      startingSet: settings.startingSet,
      symbolSources: [...settings.symbolSources],
      initiallyLockedCells: settings.initiallyLockedCells,
    };
    // Snapshot, not a live reference -- unlockedBags keeps growing on the
    // same Progression instance as the player unlocks more bags, and this
    // replay must keep reproducing the pool as it stood when recorded.
    this.mode = progression?.mode ?? null;
    this.unlockedBags = progression?.unlockedBags
      ? [...progression.unlockedBags]
      : [];
    // Seeded with a replay's already-recorded prefix when a game continued
    // past the end of its tape (see runReplay) gets its own recorder, so
    // exporting from there yields one replay covering the whole run, not
    // just the part played live after control was handed back.
    this.events = [...events];
  }
  recordRoll() {
    this.events.push(['r']);
  }
  recordBuy(offerId, emoji) {
    this.events.push(['b', offerId, emoji]);
  }
  // Folds the tool's cell target into the most recent buy event (which must
  // be that same buy -- tools.js calls this synchronously from within the
  // onBuy the recorded purchase triggered). `x === null` records that the
  // tool buy resolved with no target at all (the player cancelled, or no
  // cell could ever satisfy the tool's predicate) -- distinct from a buy
  // that was never a tool purchase in the first place (no trailing entries).
  recordToolTarget(x, y) {
    const last = this.events[this.events.length - 1];
    if (x === null) {
      last.push(null);
    } else {
      last.push(x, y);
    }
  }
  recordRefresh() {
    this.events.push(['f']);
  }
  serialize() {
    const payload = JSON.stringify({
      magic: MAGIC,
      appVersion: CURRENT_VERSION,
      seed: this.seedPhrase,
      rng: this.rngState,
      settings: this.settings,
      mode: this.mode,
      unlockedBags: this.unlockedBags,
      events: this.events,
    });
    return toBase64Utf8(payload);
  }
}

// Decodes + shape-validates a replay code. Throws a friendly Error on
// anything malformed (surfaced in the replay panel, same as importSave).
export function parseReplay(base64) {
  let parsed;
  try {
    const json = fromBase64Utf8(base64.trim());
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a valid replay code.');
  }
  if (parsed.magic === SAVE_MAGIC) {
    throw new Error(
      "That's a save code -- paste it into the save/load panel instead."
    );
  }
  if (parsed.magic !== MAGIC) {
    throw new Error('Unrecognized replay format.');
  }
  if (
    typeof parsed.rng !== 'object' ||
    typeof parsed.settings !== 'object' ||
    !Array.isArray(parsed.events)
  ) {
    throw new Error('Malformed replay data.');
  }
  return parsed;
}

// Runs one recorded event against a live replay Game, verifying recorded
// and live state agree at every step -- any mismatch stops the replay
// immediately with a ReplayDivergenceError, expected only if the code was
// tampered with or came from a different game version.
export async function playEvent(game, event) {
  const shop = game.shop;
  switch (event[0]) {
    case 'r': {
      if (game.isOver) {
        throw new ReplayDivergenceError(
          'Recorded a roll after the game was already over.'
        );
      }
      await game.roll();
      return;
    }
    case 'f': {
      const offered =
        shop.allowRefresh &&
        (shop.haveRefreshSymbol || shop.refreshCount === 0);
      if (!offered) {
        throw new ReplayDivergenceError(
          'Recorded a shop refresh, but no refresh was offered.'
        );
      }
      if (
        !shop.canAfford(game, { [shop.refreshCostResource]: shop.refreshCost })
      ) {
        throw new ReplayDivergenceError(
          'Recorded a shop refresh that is not affordable.'
        );
      }
      await shop.attemptRefresh(game);
      return;
    }
    case 'b': {
      const [, offerId, emoji, ...rest] = event;
      const offer = shop.currentOffers[offerId];
      if (!offer) {
        throw new ReplayDivergenceError(
          `Recorded a buy at offer ${offerId}, but no such offer exists.`
        );
      }
      if (offer.symbol.emoji() !== emoji) {
        throw new ReplayDivergenceError(
          `Recorded buy expected ${emoji} at offer ${offerId}, but the shop offers ${offer.symbol.emoji()}.`
        );
      }
      if (rest.length > 0) {
        game.view.primeToolTarget(rest[0] === null ? null : [rest[0], rest[1]]);
      }
      // buyCount is not a reliable before/after signal: a purchase that
      // brings it to 0 immediately closes the shop, which resets it right
      // back to 1 (see Shop.close/reset) -- indistinguishable from "nothing
      // happened". stats.run.totalBought only increments on an actually
      // applied purchase, so use that instead.
      const totalBoughtBefore = game.stats.run.totalBought;
      await shop.attemptPurchase(game, offerId);
      if (game.stats.run.totalBought === totalBoughtBefore) {
        throw new ReplayDivergenceError(
          `Recorded buy at offer ${offerId} did not apply (insufficient funds?).`
        );
      }
      return;
    }
    default:
      throw new ReplayDivergenceError(`Unrecognized replay event: ${event[0]}`);
  }
}

// Decodes, reproduces, and drives a replay to the end under a real animated
// renderer (ReplayRenderer). `progression`/`onGameOver` are injected by the
// caller (app/bootstrap.js) rather than imported directly, matching how
// Game itself takes onGameOver -- avoids a circular import back to
// bootstrap.js, which is what constructs the ReplayRecorder this consumes.
export async function runReplay(base64, { progression, onGameOver }) {
  const parsed = parseReplay(base64);

  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const templateClone = template.cloneNode(true);
  templateClone.classList.remove('hidden');
  gameDiv.appendChild(templateClone.children[0]);

  // Older replay codes (recorded before mode was captured) have neither
  // field -- treat them as Sandbox, matching what every replay actually did
  // before this existed.
  const mode = parsed.mode ?? null;
  const unlockedBags = parsed.unlockedBags ?? [];

  const catalog = new Catalog(parsed.settings.symbolSources);
  await catalog.updateSymbols();
  // Reproduce the same buyable pool the recording played against -- see
  // ReplayRecorder's constructor comment for why this has to match exactly
  // (it changes generateShop()'s RNG draw sequence, not just what's
  // offered).
  if (mode === 'progression') {
    catalog.restrictTo(unlockedEmoji(unlockedBags));
  } else if (mode === 'daily') {
    // Shared daily replay codes (not just server validation) must reproduce
    // the same excluded pool the recording played against -- see
    // src/daily.js and DAILY_CHALLENGE_DESIGN.md #5.
    catalog.restrictTo(dailyAllowedEmoji(catalog));
  }
  // Mirror the recorded run's progression bar, not the live player's
  // current unlocks -- bootstrap.js's loadSettings does the same
  // mount/hide dance for a fresh game (see the `.progression-bar` div in
  // the template just cloned above).
  const statusBarMount = gameDiv.querySelector('.progression-bar');
  if (mode === 'progression') {
    renderProgressionBar(statusBarMount, unlockedBags);
    statusBarMount.classList.remove('hidden');
  } else {
    statusBarMount.replaceChildren();
    statusBarMount.classList.add('hidden');
  }
  // Pin the RNG to the recorded starting position -- NOT reproduced by
  // re-seeding from the phrase, since the RNG is seeded once per page load
  // and never re-seeded between games (see core/rng.js). Any draws
  // catalog.updateSymbols() just performed are harmless: overwritten here,
  // before Game (and therefore any gameplay-relevant draw) is constructed.
  Rng.importState(parsed.rng);

  const settings = new GameSettings(
    'Replay',
    parsed.settings.boardX,
    parsed.settings.boardY,
    parsed.settings.gameLength,
    parsed.settings.startingSet,
    parsed.settings.symbolSources,
    /* resultLookup= */ undefined,
    /* textLookup= */ undefined,
    parsed.settings.initiallyLockedCells
  );

  const renderer = new ReplayRenderer();
  const game = new Game(
    progression,
    settings,
    catalog,
    renderer,
    onGameOver,
    /* isReplay= */ true
  );

  // The shop's buy/refresh buttons are still real DOM elements the player
  // could otherwise click out of band while the driver is mid-purchase --
  // it's the only thing allowed to act during a replay.
  gameDiv.style.pointerEvents = 'none';
  // Run at full speed: a live game leaves every animation/delay call at
  // its real duration, so a many-turn replay driven at that same pace can
  // take minutes to reach the end -- easily mistaken for "nothing is
  // happening". Every cell/inventory/shop update still happens, just
  // without the wait; this is the same isReplay-aware animationOff() path
  // game.roll() uses (see game.js), reusing the game's own existing
  // skip-animation invariant rather than a new one.
  animationOff();
  // Tracks only the events actually applied to `game` -- on a clean run
  // that's every recorded event, but a divergence thrown mid-drive leaves
  // this shorter than parsed.events (the event that diverged, and anything
  // after it, never took effect). That's what the recorder below needs: it
  // must describe exactly what this game has actually done, not the tape it
  // was handed.
  const appliedEvents = [];
  try {
    for (const event of parsed.events) {
      await playEvent(game, event);
      appliedEvents.push(event);
    }
  } finally {
    gameDiv.style.pointerEvents = 'auto';
    // Hand control back to the player if there are turns left -- either the
    // recorded events ran out short of game over, or a divergence was just
    // thrown mid-drive (still better than leaving the board stuck forever).
    // Restores real animation timing too, so manual play from here on looks
    // like a normal game rather than the instant-skip pace of the replay
    // itself. stopReplayDriving() is what makes that stick: it lets
    // game.roll() go back to resetting animation to "on" at the start of
    // every future roll (game.js), instead of leaving it wherever a
    // mid-drive skip-tap last left it for the rest of this Game's life.
    if (!game.isOver) {
      renderer.stopDriving();
      game.stopReplayDriving();
      animationOn();
      // Pre-seeded with the prefix that actually ran, so exporting from
      // here (see bootstrap.js's replay panel) yields one replay covering
      // the whole run, not just the part played live from this point.
      // `progression` here carries the *recorded* mode/unlockedBags (the
      // pool this run actually played against, computed above), not the
      // live PROGRESSION instance passed into runReplay -- otherwise
      // continuing a Progression-mode replay would silently re-tag its
      // export as Sandbox (or as whatever bags the player has unlocked by
      // now), losing the same information this whole feature exists to
      // keep.
      game.recorder = new ReplayRecorder({
        seedPhrase: parsed.seed,
        rngState: parsed.rng,
        settings: parsed.settings,
        progression: { mode, unlockedBags },
        events: appliedEvents,
      });
    }
  }
  return game;
}

// Headless server-side validator for a Daily Challenge submission (see
// DAILY_CHALLENGE_DESIGN.md #3 and DAILY_CHALLENGE_AWS_SETUP.md #7.5). This
// is the trust boundary: unlike runReplay() above (which trusts the whole
// replay -- it's just local playback), validateReplay reconstructs the
// canonical daily game entirely from data the caller owns (the day's
// server-generated `seed` and the server's own `appVersion`) and never
// trusts the replay's own `seed`/`rng`/`settings`/`mode` for anything beyond
// the version cross-check below. The only untrusted input that actually
// drives the outcome is `parsed.events`, and every event is re-validated
// against live canonical state by the same playEvent() runReplay() uses.
//
// Never throws -- every rejection reason (a malformed code, a version
// mismatch, a divergence, an incomplete run) comes back as
// { valid: false, reason }, so a caller (the AWS validate Lambda) can turn
// this straight into a 422 response without its own try/catch.
//
// No DOM setup of its own, unlike runReplay (which clones the live page's
// .template into .game) -- the caller must already have a minimal DOM in
// place with `.game .info`/`.game .shop`/`.game .progression-bar` resolvable
// (see DAILY_CHALLENGE_AWS_SETUP.md #4: the validate Lambda bundles a copy
// of index.html and does the same jsdom template-clone dance
// test/unit/replay-roundtrip.test.js does). That's what lets this run under
// plain jsdom with no browser and no static asset server.
//
// KNOWN OPEN ISSUE, not yet root-caused: test/unit/daily-validate.test.js
// proves this function correct for a small settings/symbol-source scope
// (matching REPLAY_SETTINGS' proven pattern), and freshImports (see
// catalog.js) fixes a confirmed cross-invocation bug where an import-time
// RNG draw (Santa's displayVariant, symbols/things.js) only fired on a warm
// Lambda container's first-ever call. Independently of that fix, ad-hoc
// testing against the *full* canonical DAILY_SETTINGS catalog (all 11
// symbol files, a 50-turn game) has shown validateReplay's own from-seed
// reconstruction occasionally re-deriving a different shop draw order than
// an independently-recorded run of the same seed/events, deep into a long
// game -- observed even with two from-scratch rebuilds in one process (no
// module caching involved), so it isn't (only) about warm-container reuse.
// Root cause not yet found; ruled out so far: Progression.mode,
// DomRenderer/NullRenderer/SimRenderer choice, JOKER_DISGUISES content,
// isReplay, Wildcard purchases. Before relying on this for real production
// submissions at the full catalog's scale, this needs a proper root-cause
// fix (e.g. re-run with a call-site-tagged RNG trace to pinpoint the exact
// divergent draw) -- shipped now with this caveat clearly flagged rather
// than silently, per the phased-implementation spirit of
// DAILY_CHALLENGE_DESIGN.md #9.
export async function validateReplay(base64, { seed, appVersion }) {
  let parsed;
  try {
    parsed = parseReplay(base64);
  } catch (err) {
    return { valid: false, reason: err.message };
  }
  if (parsed.appVersion !== appVersion) {
    return {
      valid: false,
      reason: 'Replay from a different game version.',
    };
  }

  // Re-derive the start state from the server-owned seed -- NOT from
  // parsed.rng/parsed.seed. The RNG is seeded once per process, matching
  // "the daily run is the first and only game after a load seeded with the
  // daily phrase" (DAILY_CHALLENGE_DESIGN.md #4): a fresh Lambda invocation
  // (or a validator that re-seeds before each validation) reproduces exactly
  // the state a legitimate client's first game started from.
  await Rng.setSeed(seed);

  // Canonical settings + pool, never the replay's own -- see this
  // function's header comment. Copy symbolSources before handing it to
  // Catalog: updateSymbols() mutates whatever array it's given (unshifts
  // './symbol.js'), and DAILY_SETTINGS is a shared singleton that may be
  // reused across many invocations in a warm Lambda container.
  // freshImports: true for the same reason -- see Catalog's constructor
  // comment (catalog.js) for why a warm container needs this to reproduce
  // a fresh page load's import-time RNG draws (e.g. Santa's displayVariant)
  // on every single call, not just its first.
  const catalog = new Catalog([...DAILY_SETTINGS.symbolSources], {
    freshImports: true,
  });
  await catalog.updateSymbols();
  catalog.restrictTo(dailyAllowedEmoji(catalog));

  // Minimal stand-in Progression, same shape Game's constructor/over() need
  // (see test/unit/replay-roundtrip.test.js's fakeProgression) -- mode:
  // 'daily' so nothing downstream mistakes this for Sandbox, but
  // checkGateAndRollOffer is unreachable anyway (isReplay guards it in
  // Game.over()).
  const progression = {
    mode: 'daily',
    updateUi() {},
    checkGateAndRollOffer() {},
  };
  const game = new Game(
    progression,
    DAILY_SETTINGS,
    catalog,
    new SimRenderer(),
    /* onGameOver= */ () => {},
    /* isReplay= */ true
  );

  // Under jsdom there's no real CSS animation pipeline -- Util.animate()'s
  // promise only resolves via a real 'animationend' event or its ~timer
  // fallback, so leaving animation "on" would stall every animate() call
  // roll()/over() make (across a whole game, easily seconds of dead time per
  // submission). Restored unconditionally afterward: a warm Lambda container
  // reuses this module's state across invocations, and nothing else here
  // ever turns it back on.
  animationOff();
  try {
    for (const event of parsed.events) {
      await playEvent(game, event);
    }
  } catch (err) {
    if (err instanceof ReplayDivergenceError) {
      return { valid: false, reason: err.message };
    }
    throw err;
  } finally {
    animationOn();
  }

  if (!game.isOver) {
    return {
      valid: false,
      reason: 'Replay ended before the game was over.',
    };
  }

  return { valid: true, score: game.inventory.getResource(Const.MONEY) };
}
