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
const STORAGE_VERSION = 2;

function saveStrategy() {
  const data = {
    v: STORAGE_VERSION,
    strategy,
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

// --- Strategy data model (see SIMULATOR_TOOLS_DESIGN.md §3) ---
// Shopping decides what to buy (tools included); Eye/Axe decide what a
// bought tool acts on. Each slot's `always` is an ordered de-duplicated
// emoji list; `repeat` is an ordered {emoji, count} list.
function emptySlot() {
  return { always: [], repeat: [] };
}
function emptyStrategy() {
  return { shopping: emptySlot(), eye: emptySlot(), axe: emptySlot() };
}

// Merges duplicate {emoji, count} entries (defensive -- the UI never
// creates duplicates, but loaded/migrated data might) and drops non-
// positive counts.
function mergeRepeat(entries) {
  const counts = new Map();
  for (const { emoji, count } of entries) {
    if (count > 0) {
      counts.set(emoji, (counts.get(emoji) || 0) + count);
    }
  }
  return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

function migrateLegacyStrategy(saved) {
  const strategy = emptyStrategy();
  strategy.shopping.always = [...new Set(saved.alwaysBuy || [])];
  const counts = new Map();
  for (const e of saved.buyOnce || []) {
    counts.set(e, (counts.get(e) || 0) + 1);
  }
  strategy.shopping.repeat = [...counts].map(([emoji, count]) => ({
    emoji,
    count,
  }));
  return strategy;
}

function filterSlot(slot, validSet) {
  return {
    always: [...new Set((slot?.always || []).filter((e) => validSet.has(e)))],
    repeat: mergeRepeat(
      (slot?.repeat || []).filter((r) => validSet.has(r.emoji))
    ),
  };
}

let running = false;
let stopRequested = false;

// --- Load catalog (for the emoji picker only -- each simulated round below
// builds its own catalog so rounds don't share mutable state). ---
const catalog = new Catalog([...settings.symbolSources]);
await catalog.updateSymbols();

// Every buyable symbol (shop pickers below further narrow this).
const allBuyable = [];
for (const [emoji, symbol] of catalog.symbols) {
  if (symbol.categories().includes(CATEGORY_UNBUYABLE)) continue;
  allBuyable.push({ emoji, symbol });
}
allBuyable.sort((a, b) =>
  a.symbol.constructor.name.localeCompare(b.symbol.constructor.name)
);

// Shopping picker: every buyable symbol, tools (🧿/🪓) included -- that's
// the only way to acquire a tool. 📌 Pin has no targeting slot in this
// design, so it's left out for now (see design doc §4.4/§7).
const PIN_EMOJI = '📌';
const shoppingTiles = allBuyable.filter(({ emoji }) => emoji !== PIN_EMOJI);
// Eye/Axe picker: sensible tool *targets* -- any ownable symbol, excluding
// the tools themselves.
const targetTiles = allBuyable.filter(
  ({ symbol }) => !symbol.categories().includes(CATEGORY_TOOL)
);

const shoppingEmojiSet = new Set(shoppingTiles.map((t) => t.emoji));
const targetEmojiSet = new Set(targetTiles.map((t) => t.emoji));

const SLOTS = [
  ['shopping', 'always'],
  ['shopping', 'repeat'],
  ['eye', 'always'],
  ['eye', 'repeat'],
  ['axe', 'always'],
  ['axe', 'repeat'],
];
const VALID_SETS = {
  shopping: shoppingEmojiSet,
  eye: targetEmojiSet,
  axe: targetEmojiSet,
};

// --- State ---
const strategy = emptyStrategy();

// --- DOM refs ---
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

const pickerOverlay = document.getElementById('sim-picker-overlay');
const pickerTitle = document.getElementById('sim-picker-title');
const pickerTiles = document.getElementById('sim-picker-tiles');
const pickerClose = document.getElementById('sim-picker-close');

// Restore saved strategy. Every emoji is filtered through the current
// picker's valid set, so a stale emoji from an old save (no longer
// buyable/targetable) is dropped instead of silently mis-buying/targeting.
const saved = loadStrategy();
if (saved) {
  const rawStrategy =
    saved.v === STORAGE_VERSION && saved.strategy
      ? saved.strategy
      : migrateLegacyStrategy(saved);
  for (const category of ['shopping', 'eye', 'axe']) {
    strategy[category] = filterSlot(
      rawStrategy[category],
      VALID_SETS[category]
    );
  }
  if (saved.rounds) roundsInput.value = saved.rounds;
  if (saved.refreshTurns) refreshTurnsInput.value = saved.refreshTurns;
}

// --- Strategy mutation ---
function addToSlot(category, mode, emoji) {
  const slot = strategy[category];
  if (mode === 'always') {
    if (!slot.always.includes(emoji)) {
      slot.always.push(emoji);
    }
  } else {
    const entry = slot.repeat.find((r) => r.emoji === emoji);
    if (entry) {
      entry.count++;
    } else {
      slot.repeat.push({ emoji, count: 1 });
    }
  }
  renderStrategy();
}

function removeAlways(category, emoji) {
  const slot = strategy[category];
  slot.always = slot.always.filter((e) => e !== emoji);
  renderStrategy();
}

function incRepeat(category, emoji) {
  const entry = strategy[category].repeat.find((r) => r.emoji === emoji);
  if (entry) {
    entry.count++;
    renderStrategy();
  }
}

function decRepeat(category, emoji) {
  const slot = strategy[category];
  const entry = slot.repeat.find((r) => r.emoji === emoji);
  if (!entry) return;
  entry.count--;
  if (entry.count <= 0) {
    slot.repeat = slot.repeat.filter((r) => r !== entry);
  }
  renderStrategy();
}

// --- Rendering ---
function makeAlwaysChip(category, emoji) {
  const chip = document.createElement('span');
  chip.className = 'sim-chip sim-chip-always';
  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'sim-chip-emoji';
  emojiSpan.textContent = emoji;
  chip.appendChild(emojiSpan);
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'sim-chip-btn sim-chip-x';
  removeBtn.setAttribute('aria-label', 'Remove');
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => removeAlways(category, emoji));
  chip.appendChild(removeBtn);
  return chip;
}

function makeRepeatChip(category, emoji, count) {
  const chip = document.createElement('span');
  chip.className = 'sim-chip sim-chip-repeat';
  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'sim-chip-emoji';
  emojiSpan.textContent = emoji;
  chip.appendChild(emojiSpan);
  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'sim-chip-btn sim-chip-minus';
  minusBtn.setAttribute('aria-label', 'Decrease');
  minusBtn.textContent = '−';
  minusBtn.addEventListener('click', () => decRepeat(category, emoji));
  chip.appendChild(minusBtn);
  const countSpan = document.createElement('span');
  countSpan.className = 'sim-chip-count';
  countSpan.textContent = count;
  chip.appendChild(countSpan);
  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'sim-chip-btn sim-chip-plus';
  plusBtn.setAttribute('aria-label', 'Increase');
  plusBtn.textContent = '+';
  plusBtn.addEventListener('click', () => incRepeat(category, emoji));
  chip.appendChild(plusBtn);
  return chip;
}

function renderSlot(category, mode) {
  const container = document.querySelector(
    `.sim-slot-chips[data-category="${category}"][data-mode="${mode}"]`
  );
  if (!container) return;
  container.innerHTML = '';
  const slot = strategy[category];
  const entries = mode === 'always' ? slot.always : slot.repeat;
  if (entries.length === 0) {
    container.innerHTML = '<span class="sim-empty">None</span>';
    return;
  }
  if (mode === 'always') {
    for (const emoji of entries) {
      container.appendChild(makeAlwaysChip(category, emoji));
    }
  } else {
    for (const { emoji, count } of entries) {
      container.appendChild(makeRepeatChip(category, emoji, count));
    }
  }
}

function renderStrategy() {
  for (const [category, mode] of SLOTS) {
    renderSlot(category, mode);
  }
  saveStrategy();
}

// --- Emoji picker overlay ---
const CATEGORY_TITLES = { shopping: 'Shopping', eye: 'Eye', axe: 'Axe' };
const MODE_TITLES = { always: 'Always', repeat: 'Repeat' };
let pickerCategory = null;
let pickerMode = null;

function tilesForCategory(category) {
  return category === 'shopping' ? shoppingTiles : targetTiles;
}

function openPicker(category, mode) {
  pickerCategory = category;
  pickerMode = mode;
  pickerTitle.textContent = `Add to ${CATEGORY_TITLES[category]} · ${MODE_TITLES[mode]}`;
  pickerTiles.innerHTML = '';
  for (const { emoji, symbol } of tilesForCategory(category)) {
    const tile = document.createElement('div');
    tile.className = 'sim-picker-tile';
    tile.innerHTML = `<span class="sim-picker-emoji">${emoji}</span><span class="sim-picker-name">${symbol.constructor.name}</span>`;
    tile.addEventListener('click', () => {
      addToSlot(pickerCategory, pickerMode, emoji);
    });
    pickerTiles.appendChild(tile);
  }
  pickerOverlay.classList.remove('hidden');
}

function closePicker() {
  pickerOverlay.classList.add('hidden');
  pickerCategory = null;
  pickerMode = null;
}

pickerClose.addEventListener('click', closePicker);
pickerOverlay.addEventListener('click', (e) => {
  if (e.target === pickerOverlay) closePicker();
});

document.querySelectorAll('.sim-add-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    openPicker(btn.dataset.category, btn.dataset.mode);
  });
});

renderStrategy();

// Bridges the explicit-count Repeat model to the "duplicate emoji in a
// string" contract Catalog.symbolsFromString expects.
function expandRepeat(entries) {
  let result = '';
  for (const { emoji, count } of entries) {
    result += emoji.repeat(count);
  }
  return result;
}

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
  const shoppingAlwaysStr = strategy.shopping.always.join('');
  const shoppingRepeatStr = expandRepeat(strategy.shopping.repeat);
  const refreshTurns = parseInt(refreshTurnsInput.value) || 30;
  const targeting = {
    '🧿': { always: strategy.eye.always, repeat: strategy.eye.repeat },
    '🪓': { always: strategy.axe.always, repeat: strategy.axe.repeat },
  };

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
      cat.symbolsFromString(shoppingAlwaysStr),
      cat.symbolsFromString(shoppingRepeatStr),
      refreshTurns,
      targeting
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
