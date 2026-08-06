import * as Const from './src/consts.js';
import * as Util from './src/util.js';
import { Catalog } from './src/catalog.js';
import { CATEGORY_UNBUYABLE } from './src/symbol.js';
import { CATEGORY_TOOL } from './src/symbols/tools.js';
import { GameSettings } from './src/game_settings.js';
import { AutoGame } from './src/sim/harness.js';

// Disable animations for simulation
Util.animationOff();

// Real game settings (board size, starting set, symbol sources, trophy
// thresholds) -- kept in sync with the actual game automatically, instead of
// a hand-copied list that silently falls behind as symbols are added.
const settings = GameSettings.instance();

// Seed the RNG before anything else runs, in particular before the first
// catalog load dynamically imports symbol sources -- some (e.g. Santa in
// things.js) draw from the RNG at import time via a static class field. A
// module that throws during evaluation is permanently unloadable for the
// rest of the page's life (ES modules cache failed evaluations), so seeding
// late doesn't just desync one round -- it silently drops that whole symbol
// file from every round for the entire session. See bootstrap.js for the
// same requirement in the real game.
await Util.setRandomSeed();

// --- Local storage persistence ---
const STORAGE_KEY = 'emoji-sim-strategy';

function saveStrategy() {
  const data = {
    alwaysBuy,
    buyOnce,
    rounds: roundsInput.value,
    refreshTurns: refreshTurnsInput.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadStrategy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- State ---
const alwaysBuy = []; // array of emoji strings
const buyOnce = []; // array of emoji strings (duplicates allowed)
let running = false;
let stopRequested = false;

// --- Load catalog (for the emoji picker only -- each simulated round below
// builds its own catalog so rounds don't share mutable state). ---
const catalog = new Catalog([...settings.symbolSources]);
await catalog.updateSymbols();

// Collect all buyable symbols. Tools (Pin/Axe/Eye) are excluded -- they
// need a board-cell click to resolve (pickCellForTool), which the headless
// NullRenderer can't script, so buying one in a simulated game just spends
// the money for no effect.
const allSymbols = [];
for (const [emoji, symbol] of catalog.symbols) {
  const categories = symbol.categories();
  if (categories.includes(CATEGORY_UNBUYABLE)) continue;
  if (categories.includes(CATEGORY_TOOL)) continue;
  allSymbols.push({ emoji, symbol });
}
const buyableEmoji = new Set(allSymbols.map((s) => s.emoji));
allSymbols.sort((a, b) =>
  a.symbol.constructor.name.localeCompare(b.symbol.constructor.name)
);

// --- DOM refs ---
const pickerDiv = document.getElementById('emoji-picker');
const alwaysBuyList = document.getElementById('always-buy-list');
const buyOnceList = document.getElementById('buy-once-list');
const startBtn = document.getElementById('sim-start');
const stopBtn = document.getElementById('sim-stop');
const roundsInput = document.getElementById('sim-rounds');
const refreshTurnsInput = document.getElementById('sim-refresh-turns');
const progressSpan = document.getElementById('sim-progress');
const resultsBody = document.getElementById('sim-results-body');
const statAvg = document.getElementById('stat-avg');
const statMin = document.getElementById('stat-min');
const statMax = document.getElementById('stat-max');
const statMedian = document.getElementById('stat-median');
const statTrophies = document.getElementById('stat-trophies');

// Restore saved strategy. Filtered against buyableEmoji so a strategy saved
// before tools were excluded from the picker doesn't keep buying them.
const saved = loadStrategy();
if (saved) {
  alwaysBuy.push(...(saved.alwaysBuy || []).filter((e) => buyableEmoji.has(e)));
  buyOnce.push(...(saved.buyOnce || []).filter((e) => buyableEmoji.has(e)));
  if (saved.rounds) roundsInput.value = saved.rounds;
  if (saved.refreshTurns) refreshTurnsInput.value = saved.refreshTurns;
}

// --- Emoji Picker ---
// "Choose" buttons pick which list (Always Buy / Buy Once) clicking an
// emoji tile below adds to -- styled as a two-way toggle like the
// Simulate/Stop button pair, active side green, inactive side faded.
let addTarget = 'always';
const chooseAlwaysBtn = document.getElementById('choose-always');
const chooseOnceBtn = document.getElementById('choose-once');

function renderChooseButtons() {
  chooseAlwaysBtn.classList.toggle('sim-choose-active', addTarget === 'always');
  chooseOnceBtn.classList.toggle('sim-choose-active', addTarget === 'once');
}

chooseAlwaysBtn.addEventListener('click', () => {
  addTarget = 'always';
  renderChooseButtons();
});
chooseOnceBtn.addEventListener('click', () => {
  addTarget = 'once';
  renderChooseButtons();
});

for (const { emoji, symbol } of allSymbols) {
  const tile = document.createElement('div');
  tile.className = 'sim-picker-tile';
  tile.innerHTML = `<span class="sim-picker-emoji">${emoji}</span><span class="sim-picker-name">${symbol.constructor.name}</span>`;
  tile.addEventListener('click', () => {
    if (addTarget === 'always') {
      if (!alwaysBuy.includes(emoji)) {
        alwaysBuy.push(emoji);
      }
    } else {
      buyOnce.push(emoji);
    }
    renderLists();
  });
  pickerDiv.appendChild(tile);
}

// --- Render selected lists ---
function renderLists() {
  renderAlwaysBuy();
  renderBuyOnce();
  saveStrategy();
}

function renderAlwaysBuy() {
  alwaysBuyList.innerHTML = '';
  if (alwaysBuy.length === 0) {
    alwaysBuyList.innerHTML =
      '<span class="sim-empty">Click emoji below to add</span>';
    return;
  }
  for (let i = 0; i < alwaysBuy.length; i++) {
    const chip = document.createElement('span');
    chip.className = 'sim-chip';
    chip.textContent = alwaysBuy[i];
    chip.title = 'Click to remove';
    const idx = i;
    chip.addEventListener('click', () => {
      alwaysBuy.splice(idx, 1);
      renderLists();
    });
    alwaysBuyList.appendChild(chip);
  }
}

function renderBuyOnce() {
  buyOnceList.innerHTML = '';
  if (buyOnce.length === 0) {
    buyOnceList.innerHTML =
      '<span class="sim-empty">Click emoji below to add</span>';
    return;
  }
  // Group by emoji with counts
  const counts = new Map();
  for (const e of buyOnce) {
    counts.set(e, (counts.get(e) || 0) + 1);
  }
  for (const [emoji, count] of counts) {
    const chip = document.createElement('span');
    chip.className = 'sim-chip';
    chip.textContent = emoji;
    if (count > 1) {
      const badge = document.createElement('span');
      badge.className = 'sim-chip-badge';
      badge.textContent = count;
      chip.appendChild(badge);
    }
    chip.title = 'Click to remove one';
    chip.addEventListener('click', () => {
      const idx = buyOnce.indexOf(emoji);
      if (idx !== -1) buyOnce.splice(idx, 1);
      renderLists();
    });
    buyOnceList.appendChild(chip);
  }
}

renderLists();

// --- Trophy calculation (thresholds come from the real game's trophy tiers,
// see GameSettings' resultLookup) ---
const sortedThresholds = Object.keys(settings.resultLookup)
  .map(Number)
  .sort((a, b) => b - a);

function getTrophy(score) {
  for (const threshold of sortedThresholds) {
    if (score >= threshold) return settings.resultLookup[threshold];
  }
  return '💩';
}

// --- Stats ---
function updateStats(scores) {
  if (scores.length === 0) return;
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = Math.round(sum / scores.length);
  const sorted = [...scores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  statAvg.textContent = Util.formatBigNumber(avg);
  statMin.textContent = Util.formatBigNumber(min);
  statMax.textContent = Util.formatBigNumber(max);
  statMedian.textContent = Util.formatBigNumber(median);

  // Trophy distribution
  const trophyCounts = new Map();
  for (const s of scores) {
    const t = getTrophy(s);
    trophyCounts.set(t, (trophyCounts.get(t) || 0) + 1);
  }
  statTrophies.innerHTML = '';
  for (const [trophy, count] of trophyCounts) {
    const pct = ((count / scores.length) * 100).toFixed(0);
    const span = document.createElement('span');
    span.className = 'sim-trophy-stat';
    span.textContent = `${trophy} ${pct}%`;
    statTrophies.appendChild(span);
  }
}

// --- Simulation ---
async function runSimulation() {
  const rounds = parseInt(roundsInput.value) || 100;
  running = true;
  stopRequested = false;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  resultsBody.innerHTML = '';
  statAvg.textContent = '—';
  statMin.textContent = '—';
  statMax.textContent = '—';
  statMedian.textContent = '—';
  statTrophies.innerHTML = '';

  const scores = [];
  const alwaysBuyStr = alwaysBuy.join('');
  const buyOnceStr = buyOnce.join('');
  const refreshTurns = parseInt(refreshTurnsInput.value) || 30;

  for (let i = 0; i < rounds; i++) {
    if (stopRequested) break;

    progressSpan.textContent = `${i + 1} / ${rounds}`;

    // Fresh seed and catalog for each round. Seed first -- see the
    // module-load-order note above the top-level setRandomSeed() call.
    await Util.setRandomSeed();
    const cat = new Catalog([...settings.symbolSources]);
    await cat.updateSymbols();

    const game = new AutoGame(
      settings,
      cat,
      cat.symbolsFromString(alwaysBuyStr),
      cat.symbolsFromString(buyOnceStr),
      refreshTurns
    );
    await game.simulate();

    const score = game.inventory.getResource(Const.MONEY);
    scores.push(score);
    const trophy = getTrophy(score);

    // Build inventory string
    const invMap = new Map();
    for (const sym of game.inventory.symbols) {
      const e = sym.emoji();
      invMap.set(e, (invMap.get(e) || 0) + 1);
    }
    let invStr = '';
    for (const [e, c] of invMap) {
      invStr += c > 1 ? `${e}${c} ` : `${e} `;
    }

    // Add result row
    const row = document.createElement('tr');
    row.innerHTML = `<td>${i + 1}</td><td>${Const.MONEY} ${Util.formatBigNumber(score)}</td><td>${trophy}</td><td class="sim-inv-cell">${invStr}</td>`;
    resultsBody.appendChild(row);

    updateStats(scores);

    // Yield to browser for UI update
    await new Promise((r) => setTimeout(r, 0));
  }

  progressSpan.textContent = stopRequested
    ? `Stopped at ${scores.length}`
    : `Done — ${scores.length} rounds`;
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
}

startBtn.addEventListener('click', () => {
  if (!running) runSimulation();
});

stopBtn.addEventListener('click', () => {
  stopRequested = true;
});

roundsInput.addEventListener('change', saveStrategy);
refreshTurnsInput.addEventListener('change', saveStrategy);
