import * as Util from '../util.js';
import * as Rng from '../core/rng.js';
import { GameSettings } from '../game_settings.js';
import { Catalog } from '../catalog.js';
import { Game } from '../game.js';
import { Progression } from '../progression.js';
import { DomRenderer } from '../render/DomRenderer.js';
import { ProgressionView } from '../render/ProgressionView.js';
import { SettingsView } from '../render/SettingsView.js';
import { initGridScaling } from '../render/layout.js';
import { CATEGORY_UNBUYABLE } from '../symbol.js';
import { KEYWORDS } from '../keywords.js';
import { exportSave, importSave } from '../save_state.js';
import { ReplayRecorder, runReplay } from '../replay.js';
import { FULL_ROSTER, BAGS } from '../progression-roster.js';
import { renderProgressionBar } from '../render/progressionBar.js';
import * as Const from '../consts.js';

// The composition root: seeds the RNG, builds Progression/GameSettings and
// their views, and loads the first game. main.js is just "on DOM ready,
// bootstrap()".
export async function bootstrap() {
  // Seed the RNG before anything else runs (in particular, before the first
  // catalog load dynamically imports symbol sources -- some, like Santa,
  // draw from the RNG at import time). core/rng.js itself has no DOM access;
  // this is the one place that reads the seed from the URL and reflects it
  // into the UI.
  let seedPhrase = window.location.hash.slice(1);
  if (seedPhrase) {
    await Rng.setSeed(seedPhrase);
  } else {
    seedPhrase = await Rng.setRandomSeed();
  }
  window.seedPhrase = seedPhrase;
  document.querySelector('#seed-phrase').textContent = seedPhrase;
  document.querySelector('#seed-link').href = `#${seedPhrase}`;

  // Tracks whichever Game is currently live, so sidebar actions triggered
  // after a restart (achievements/save/replay panels) act on the game
  // actually being played rather than a stale reference to the first one
  // (see initSidebar, which reads this via the getGame accessor instead of
  // closing over a single Game).
  let currentGame = null;
  // Set once initSidebar runs (see below); lets loadSettings tell an
  // already-open symbol-list panel to refresh after a bag-draft pick, since
  // opening the panel is otherwise the only thing that rebuilds it.
  let sidebarApi = null;

  // loadSettings/loadListener close over PROGRESSION, which is fine since
  // neither is invoked until after PROGRESSION is constructed below.
  const loadSettings = async (settings = GameSettings.instance()) => {
    const template = document.querySelector('.template');
    const gameDiv = document.querySelector('.game');
    gameDiv.replaceChildren();
    const templateClone = template.cloneNode(true);
    templateClone.classList.remove('hidden');
    gameDiv.appendChild(templateClone.children[0]);
    const catalog = new Catalog(settings.symbolSources);
    await catalog.updateSymbols();
    // Progression mode's only mechanical difference from Sandbox: narrow the
    // buyable pool to what's unlocked so far (PROGRESSION_DESIGN.md sections
    // 1, 7). A pure Map-delete pass -- no RNG draws, so it doesn't touch
    // draw order. Sandbox (and mode === null, before the first-run overlay
    // has run) never restricts, matching "today's game unchanged".
    if (PROGRESSION.mode === 'progression') {
      catalog.restrictTo(PROGRESSION.unlockedEmoji());
    }
    // In-game progression bar, underneath the board: visible for the whole
    // round (covers "game start" -- it's on screen from the moment this
    // round's board appears), hidden entirely outside Progression mode. The
    // game-over screen (game.js's over()) mounts the same shared component.
    const statusBarMount = document.querySelector('.game .progression-bar');
    if (PROGRESSION.mode === 'progression') {
      renderProgressionBar(statusBarMount, PROGRESSION.unlockedBags);
      statusBarMount.classList.remove('hidden');
    } else {
      statusBarMount.replaceChildren();
      statusBarMount.classList.add('hidden');
    }
    // Snapshot the RNG position immediately before constructing Game (i.e.
    // before the starting-set Egg draws and the first Board construction),
    // so a replay recorded from here can restore exactly this position --
    // the RNG is seeded once per page load, not per game, so the seed
    // phrase alone wouldn't reproduce anything past the first game of the
    // session (see core/rng.js, replay.js).
    const rngState = Rng.exportState();
    const game = new Game(
      PROGRESSION,
      settings,
      catalog,
      new DomRenderer(),
      loadListener
    );
    game.recorder = new ReplayRecorder({ seedPhrase, rngState, settings });
    currentGame = game;

    // Post-win unlock draft (PROGRESSION_DESIGN.md section 6.4). Checked on
    // every game load (not just right after the game-over that rolled it)
    // so a pending offer left unpicked across a reload still gets shown --
    // the offer itself is already reload-safe (Progression persists it and
    // never rerolls), this is what actually surfaces that guarantee in the
    // UI. Not awaited, same reasoning as the mode-select overlay: a human
    // may take any amount of time to pick, and the new game underneath must
    // stay playable/inspectable (window.game, simulate, tests) regardless.
    if (
      PROGRESSION.mode === 'progression' &&
      PROGRESSION.pendingBagOffer.length > 0
    ) {
      showBagDraftOverlay(PROGRESSION).then(() => {
        // If the symbol list happens to already be open (from earlier in
        // the session -- opening the sidebar again doesn't re-trigger a
        // rebuild on its own), refresh it now that the pick's reload above
        // has landed. sidebarApi is only null on the very first loadSettings
        // call, before initSidebar has run -- impossible to have a pending
        // offer that early (no game has been won yet), so the guard is just
        // defensive.
        sidebarApi?.refreshSymbolListIfVisible();
      });
    }

    document.body.addEventListener('click', (e) => {
      if (e.target.classList.contains('interactive-emoji')) {
        const emoji = e.target.dataset.emoji;
        const symbol = game.catalog.symbol(emoji);
        if (symbol) {
          const interactiveDescription = Util.createInteractiveDescription(
            symbol.description(),
            /*emoji=*/ symbol.emoji()
          );
          Util.drawText(game.info, interactiveDescription, true);
        }
      } else if (e.target.classList.contains('keyword')) {
        const entry = KEYWORDS[e.target.dataset.keyword];
        if (entry) {
          const interactiveDescription = Util.createInteractiveDescription(
            entry.description,
            /*emoji=*/ entry.title
          );
          Util.drawText(game.info, interactiveDescription, true);
        }
      }
    });
    return game;
  };

  const loadListener = async (e) => {
    if (e?.target?.closest?.('#sidebar-menu, .top-right')) {
      return;
    }
    document.querySelector('body').removeEventListener('click', loadListener);
    const scoreContainer = document.querySelector('.game .scoreContainer');
    const scoreDiv = document.querySelector('.game .scoreContainer .score');
    await Util.animate(scoreDiv, 'scoreOut', 0.65);
    document.querySelector('.game').removeChild(scoreContainer);
    loadSettings(PROGRESSION.levelData[PROGRESSION.activeLevel]);

    // On reload, re-apply scaling (and re-observe the fresh
    // .grid-scaler-content node loadSettings just created).
    initGridScaling();
  };

  // TODO: someday, we may want to support "multiple tracks" of progression
  // aka different packs of levels. For now, hardcode a single default
  // progression.
  const PROGRESSION = new Progression(
    new ProgressionView(),
    new SettingsView(),
    loadSettings
  );
  PROGRESSION.load();

  if (window.location.hash === '#dev') {
    document.querySelectorAll('.dev-hidden').forEach((e) => {
      e.classList.remove('dev-hidden');
    });
  }

  // First-run mode pick (PROGRESSION_DESIGN.md section 6.1). Deliberately
  // NOT awaited: the first game below always loads immediately with
  // whatever mode is already persisted (null reads as unrestricted, same as
  // Sandbox), so window.game/window.simulate are available right away no
  // matter how long the overlay sits waiting for a human -- this is what
  // keeps the golden-trace harness (which never touches the overlay) from
  // hanging. The overlay is purely a full-screen visual in front of that
  // first game until a real player picks one; picking Progression reloads
  // to actually narrow the catalog. Skipped entirely once ProgressionMode
  // is persisted from a previous run.
  if (PROGRESSION.mode === null) {
    showModeSelectOverlay(PROGRESSION).then(async (mode) => {
      if (mode === 'progression') {
        await PROGRESSION.reload(
          PROGRESSION.levelData[PROGRESSION.activeLevel]
        );
        initGridScaling();
      }
      sidebarApi?.refreshSymbolListIfVisible();
    });
  }

  const game = await loadSettings(
    PROGRESSION.levelData[PROGRESSION.activeLevel]
  );
  // Debug
  window.game = game;

  sidebarApi = initSidebar(() => currentGame, PROGRESSION, loadListener);
  initGridScaling();

  return game;
}

// Resolves with the picked mode ('progression'|'sandbox') once the player
// clicks, having already persisted it. Not awaited by its caller (see
// bootstrap() above) -- a real player may take any amount of time to click.
function showModeSelectOverlay(progression) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('mode-select-overlay');
    overlay.classList.remove('hidden');
    const pick = (mode) => {
      progression.setMode(mode);
      overlay.classList.add('hidden');
      resolve(mode);
    };
    document
      .getElementById('mode-select-progression')
      .addEventListener('click', () => pick('progression'), { once: true });
    document
      .getElementById('mode-select-sandbox')
      .addEventListener('click', () => pick('sandbox'), { once: true });
  });
}

// Post-win unlock draft (PROGRESSION_DESIGN.md section 6.4): up to three
// cards, one per still-locked bag in the pending offer, each showing that
// bag's own emoji glyphs -- no effect text, just the glyphs, so the pick is
// informed without spelling out mechanics. Resolves (unawaited by its
// caller) once the player taps one; the other offered bags simply return to
// the pool by virtue of never being removed from it (see
// Progression.commitBagChoice).
function showBagDraftOverlay(progression) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('bag-draft-overlay');
    const cardsDiv = overlay.querySelector('.bag-draft-cards');
    cardsDiv.replaceChildren();
    const cards = [];
    const pick = async (bagIndex, card) => {
      try {
        progression.commitBagChoice(bagIndex);
      } catch {
        // Already committed by a near-simultaneous click on another card --
        // the first one wins, this one is a no-op.
        return;
      }
      for (const c of cards) {
        c.style.pointerEvents = 'none';
      }
      card.classList.add('picked');
      card.textContent = `${BAGS[bagIndex].join('')} Unlocked!`;
      await Util.animate(card, 'achievementPopIn', 0.5);
      // The game already running underneath (built when this round started,
      // before the pick) has a catalog restricted to the *pre-pick* pool --
      // reload so the newly unlocked bag is actually buyable this round,
      // instead of only from the round after next. Same reasoning as the
      // mode toggle/mode-select-overlay reloads. This also refreshes
      // getGame() for the sidebar's symbol list, which otherwise throws
      // trying to look up a symbol the stale catalog doesn't have yet.
      await progression.reload(progression.levelData[progression.activeLevel]);
      initGridScaling();
      overlay.classList.add('hidden');
      resolve(bagIndex);
    };
    for (const bagIndex of progression.pendingBagOffer) {
      const card = Util.createDiv(BAGS[bagIndex].join(''), 'bag-draft-card');
      card.addEventListener('click', () => pick(bagIndex, card), {
        once: true,
      });
      cards.push(card);
      cardsDiv.appendChild(card);
    }
    overlay.classList.remove('hidden');
  });
}

// TODO: extract to ui.js
function initSidebar(getGame, progression, onGameOver) {
  const hamburgerButton = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar-menu');
  const closeButton = document.getElementById('close-sidebar');

  hamburgerButton.addEventListener('click', () => {
    sidebar.classList.toggle('active');
  });

  closeButton.addEventListener('click', () => {
    sidebar.classList.remove('active');
  });

  const viewSymbolsButton = document.getElementById('view-symbols');
  const symbolListDiv = document.querySelector('.sidebar-content .symbol-list');
  // Rebuilt on every open (not cached from sidebar-init time) so it always
  // reflects the *current* mode/unlocks -- mode can change at runtime now
  // (the first-run overlay resolves asynchronously, and the sidebar toggle
  // below switches it directly), same lazy-render pattern as achievements/
  // save/replay just below.
  const renderSymbolList = () => {
    symbolListDiv.replaceChildren();
    if (progression.mode === 'progression') {
      renderProgressionSymbolList(symbolListDiv, getGame(), progression);
    } else {
      renderSandboxSymbolList(symbolListDiv, getGame());
    }
  };
  // Opening the panel is the only thing that normally rebuilds it -- this
  // is for callers outside the click handler below (the bag-draft pick, the
  // mode-select overlay, and the mode toggle) whose reload can invalidate an
  // *already-open* panel that nothing else would otherwise tell to refresh.
  const refreshSymbolListIfVisible = () => {
    if (!symbolListDiv.classList.contains('hidden')) {
      renderSymbolList();
    }
  };
  viewSymbolsButton.addEventListener('click', () => {
    symbolListDiv.classList.toggle('hidden');
    viewSymbolsButton.innerText = symbolListDiv.classList.contains('hidden')
      ? 'view symbols'
      : 'hide symbols';
    refreshSymbolListIfVisible();
  });

  const achBtn = document.getElementById('view-achievements');
  const achievementsListDiv = document.querySelector(
    '.sidebar-content .achievements-list'
  );
  achBtn.addEventListener('click', () => {
    achievementsListDiv.classList.toggle('hidden');
    getGame().achievements.renderPanel();
  });

  const saveBtn = document.getElementById('view-save');
  const savePanelDiv = document.querySelector(
    '.sidebar-content .save-state-panel'
  );
  saveBtn.addEventListener('click', () => {
    savePanelDiv.classList.toggle('hidden');
    getGame().view.renderSaveState({
      code: exportSave(),
      onImport: (code) => importSave(code),
    });
  });

  const replayBtn = document.getElementById('view-replay');
  const replayPanelDiv = document.querySelector(
    '.sidebar-content .replay-panel'
  );
  replayBtn.addEventListener('click', () => {
    replayPanelDiv.classList.toggle('hidden');
    getGame().view.renderReplay({
      code: getGame().recorder?.serialize() ?? '',
      onRun: (code) => {
        // Close the sidebar so the player is actually looking at the board
        // the replay is about to redraw, instead of the (now motionless)
        // panel they just clicked "Run replay" in.
        sidebar.classList.remove('active');
        return runReplay(code, { progression, onGameOver });
      },
    });
  });

  // Mode toggle (PROGRESSION_DESIGN.md section 1): switching does not wipe
  // unlock progress, just restarts the current game under the new mode's
  // catalog. Reuses the same `reload` callback (loadSettings) Progression
  // was constructed with, matching how level-select (jumpTo) reloads.
  const modeToggle = document.getElementById('mode-toggle');
  const modeToggleTarget = document.getElementById('mode-toggle-target');
  const otherMode = () =>
    progression.mode === 'progression' ? 'sandbox' : 'progression';
  const updateModeToggleLabel = () => {
    modeToggleTarget.textContent =
      otherMode() === 'progression' ? '▶️ progression' : '🧪 sandbox';
  };
  updateModeToggleLabel();
  modeToggle.addEventListener('click', async (e) => {
    e.preventDefault();
    progression.setMode(otherMode());
    updateModeToggleLabel();
    await progression.reload(progression.levelData[progression.activeLevel]);
    initGridScaling();
    refreshSymbolListIfVisible();
  });

  return { refreshSymbolListIfVisible };
}

// Sandbox (and mode-not-chosen-yet): today's behavior, unchanged -- every
// buyable symbol the catalog knows about, sorted by name.
function renderSandboxSymbolList(symbolListDiv, game) {
  const allSymbols = [];
  for (const [, symbol] of game.catalog.symbols) {
    if (symbol.categories().includes(CATEGORY_UNBUYABLE)) {
      continue;
    }
    allSymbols.push(symbol);
  }
  allSymbols.sort((a, b) => {
    if (a.constructor.name < b.constructor.name) {
      return -1;
    } else if (a.constructor.name > b.constructor.name) {
      return 1;
    }
    return 0;
  });
  for (const symbol of allSymbols) {
    symbolListDiv.appendChild(buildSymbolEntry(symbol));
  }
}

// Progression mode (PROGRESSION_DESIGN.md section 6.3): the full 53-symbol
// roster, not the (possibly narrowed) catalog -- locked entries render
// greyed out with a ❓ glyph and their description hidden, in roster order
// (starting pool, then each bag in index order).
function renderProgressionSymbolList(symbolListDiv, game, progression) {
  const unlocked = progression.unlockedEmoji();
  for (const emoji of FULL_ROSTER) {
    if (unlocked.has(emoji)) {
      symbolListDiv.appendChild(buildSymbolEntry(game.catalog.symbol(emoji)));
    } else {
      symbolListDiv.appendChild(buildLockedSymbolEntry());
    }
  }
}

function buildSymbolEntry(symbol) {
  const symbolDiv = Util.createDiv('', 'symbol-info-entry');
  symbolDiv.appendChild(Util.createSpan(symbol.emoji(), 'symbol-info-icon'));
  const body = Util.createDiv('', 'symbol-info-body');
  const descSpan = Util.createSpan('', 'symbol-info-desc');
  descSpan.innerHTML = Util.createInteractiveDescription(symbol.description());
  descSpan.appendChild(
    Util.createSpan(
      ` (rarity: ${Util.formatRarity(symbol.rarity)})`,
      'symbol-info-rarity'
    )
  );
  body.appendChild(descSpan);
  symbolDiv.appendChild(body);
  return symbolDiv;
}

function buildLockedSymbolEntry() {
  const symbolDiv = Util.createDiv('', 'symbol-info-entry', 'locked');
  symbolDiv.appendChild(Util.createSpan(Const.UNKNOWN, 'symbol-info-icon'));
  const body = Util.createDiv('', 'symbol-info-body');
  body.appendChild(
    Util.createSpan('Locked -- win more to unlock', 'symbol-info-desc')
  );
  symbolDiv.appendChild(body);
  return symbolDiv;
}
