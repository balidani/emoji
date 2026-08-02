// Split out from replay.js so render/ReplayRenderer.js can throw this
// without a circular import (replay.js's runReplay driver constructs a
// ReplayRenderer; ReplayRenderer needs this error type). Thrown whenever
// recorded and live state disagree during a replay -- expected only if the
// replay was tampered with or was produced by a different game version.
export class ReplayDivergenceError extends Error {}
