// Backward-compatible facade: util.js's contents have moved to core/rng.js
// (Phase 1), core/util.js, and render/animations.js (Phase 2 -- see
// REFACTOR_PLAN.md). Re-exported here so the many existing `Util.*` call sites
// keep working unchanged until each owning file is revisited by its own
// dedicated phase (Board, Shop, Inventory, symbols, ...), at which point that
// file switches to importing directly from the new location.
export * from './core/rng.js';
export * from './core/util.js';
export * from './render/animations.js';
