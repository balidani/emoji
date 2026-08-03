// Grid-scaling math. Keeps the board legible across viewport sizes by
// scaling a wrapper div; purely a DOM-measurement/CSS-variable concern, no
// gameplay logic.

const BASE_VW = 226.67;
const MIN_S = 0.5;
const MAX_S = 3;

const MAX_VW_FRAC = 0.7;
const MAX_VH_FRAC = 0.5;

let baseW0 = 0; // initial unscaled width (frozen)
let baseH0 = 0; // initial unscaled height (frozen)
let sMaxByInitialHeight = Infinity; // computed from baseH0
let currentBaseH = 0; // live unscaled height as rows change
let raf = 0; // rAF debounce handle
let resizeListenerAttached = false;

function measureOnceInitialSize() {
  if (baseW0 && baseH0) return;
  const content = document.querySelector('.grid-scaler-content');
  const prev = content.style.transform;
  content.style.transform = 'none';
  baseW0 = content.offsetWidth;
  baseH0 = content.offsetHeight;
  content.style.transform = prev || '';

  // compute the INITIAL height cap (≤ 50% of current viewport height)
  sMaxByInitialHeight = (window.innerHeight * MAX_VH_FRAC) / baseH0;
}

function measureCurrentHeight() {
  const content = document.querySelector('.grid-scaler-content');
  const prev = content.style.transform;
  content.style.transform = 'none';
  currentBaseH = content.offsetHeight; // can grow as rows are added
  content.style.transform = prev || '';
}

function computeScaleWidthOnlyWithInitialHeightCap() {
  const sDesign = window.innerWidth / BASE_VW;
  const sMaxByWidth = (window.innerWidth * MAX_VW_FRAC) / baseW0;
  return Math.max(
    MIN_S,
    Math.min(sDesign, sMaxByWidth, sMaxByInitialHeight, MAX_S)
  );
}

function applyScale() {
  const wrapper = document.querySelector('.grid-scaler');
  const content = document.querySelector('.grid-scaler-content');

  measureOnceInitialSize();
  measureCurrentHeight();

  const s = computeScaleWidthOnlyWithInitialHeightCap();

  // expose for overlay
  content.style.setProperty('--s', s);

  // reserve layout space so following sections move down
  const scaledH = currentBaseH * s;
  wrapper.style.setProperty('--scaled-h', `${scaledH}px`);

  const scaledW = baseW0 * s;
  wrapper.style.setProperty('--scaled-w', `${scaledW}px`);
}

function scheduleApply() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    applyScale();
  });
}

// Applies the current scale and (re-)observes .grid-scaler-content for size
// changes. Safe to call repeatedly -- each game load replaces
// .grid-scaler-content with a fresh node, so callers (bootstrap.js, on
// startup and after every level/settings reload) re-call this to observe
// the new one. The window resize listener itself is only ever attached
// once, matching the original single top-level main.js listener.
export function initGridScaling() {
  if (!resizeListenerAttached) {
    resizeListenerAttached = true;
    window.addEventListener('resize', () => {
      // Recompute the initial height cap on resize so "≤ 50% of viewport
      // height" stays true for the current viewport, but still based on
      // baseH0 (initial rows).
      if (baseH0) {
        sMaxByInitialHeight = (window.innerHeight * MAX_VH_FRAC) / baseH0;
      }
      scheduleApply();
    });
  }
  applyScale();
  const ro = new ResizeObserver(() => {
    scheduleApply();
  });
  const content = document.querySelector('.grid-scaler-content');
  ro.observe(content);
  // TODO: remove observer on game end?
}
