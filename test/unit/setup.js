// Global Vitest setup, run before each test file's own imports resolve.
//
// Harmless safety default: some symbols (e.g. Santa in symbols/things.js,
// see catalog.js's rollCosmetics()) draw a purely cosmetic value from the
// RNG the first time a Catalog builds them, not at module-import time, so
// merely importing a symbol module (as test files do, statically) can never
// throw here even before this runs. Kept anyway so any Catalog built before
// a test's own `beforeEach` seeding still has a non-null RNG to draw from.
// Every test that cares about a specific draw reseeds explicitly in its own
// `beforeEach`.
import { setSeed } from '../../src/core/rng.js';

await setSeed('vitest-global-setup');
