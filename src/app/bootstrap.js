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

  const game = await loadSettings(
    PROGRESSION.levelData[PROGRESSION.activeLevel]
  );
  // Debug
  window.game = game;

  initSidebar(() => currentGame, PROGRESSION, loadListener);
  initGridScaling();

  return game;
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
  viewSymbolsButton.addEventListener('click', () => {
    symbolListDiv.classList.toggle('hidden');
    viewSymbolsButton.innerText = symbolListDiv.classList.contains('hidden')
      ? 'view symbols'
      : 'hide symbols';
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

  const game = getGame();
  const allSymbols = [];
  for (const [, symbol] of game.catalog.symbols) {
    if (symbol.categories().includes(CATEGORY_UNBUYABLE)) {
      continue;
    }
    allSymbols.push(symbol);
  }
  // Sort by name:
  allSymbols.sort((a, b) => {
    if (a.constructor.name < b.constructor.name) {
      return -1;
    } else if (a.constructor.name > b.constructor.name) {
      return 1;
    }
    return 0;
  });
  for (const symbol of allSymbols) {
    const symbolDiv = Util.createDiv('', 'symbol-info-entry');
    const emojiSpan = Util.createSpan(
      `${symbol.emoji()}: `,
      'symbol-info-emoji'
    );
    const descSpan = Util.createSpan('', 'symbol-info-desc');
    descSpan.innerHTML = Util.createInteractiveDescription(
      symbol.description()
    );
    symbolDiv.appendChild(emojiSpan);
    symbolDiv.appendChild(descSpan);
    symbolListDiv.appendChild(symbolDiv);
  }
}
