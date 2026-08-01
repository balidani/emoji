// Global Vitest setup, run before each test file's own imports resolve.
//
// Santa's `static emoji` (symbols/things.js) is chosen via `Util.randomChoose`
// at class-load time -- a genuine, pre-existing quirk in the game itself (see
// UNIT_TEST_PLAN.md section 7.7 / 11), not something introduced by testing.
// In the real app this never crashes because bootstrap.js seeds the RNG
// before Catalog dynamically `import()`s any symbol module. Our test files
// statically import symbol modules instead, so we need the RNG seeded before
// any of them load -- otherwise `sfc32Instance` is still null the first time
// `things.js` is evaluated. Every test that cares about a specific draw
// reseeds explicitly in its own `beforeEach`; this is only here to make the
// module-load-time draw not throw.
import { setSeed } from '../../src/core/rng.js';

await setSeed('vitest-global-setup');
