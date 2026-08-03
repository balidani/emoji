// Seeded RNG (sfc32). No DOM access here -- seeding is driven explicitly by
// the caller (bootstrap.js), which is also responsible for reflecting the
// seed phrase into the UI.

// Returns a callable next() function (arithmetic unchanged from the original
// closure-based version) that also carries getState()/setState() so a
// stream's position can be snapshotted and restored (see replay.js, which
// relies on this to reproduce a game's exact RNG position without
// re-seeding from the phrase).
const sfc32 = (a, b, c, d) => {
  const state = { a: a | 0, b: b | 0, c: c | 0, d: d | 0 };
  const next = () => {
    let { a, b, c, d } = state;
    let t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    state.a = a;
    state.b = b;
    state.c = c;
    state.d = d;
    return (t >>> 0) / 4294967296;
  };
  next.getState = () => [state.a, state.b, state.c, state.d];
  next.setState = ([a, b, c, d]) => {
    state.a = a | 0;
    state.b = b | 0;
    state.c = c | 0;
    state.d = d | 0;
  };
  return next;
};

let sfc32Instance = null;
let sfc32ShopInstance = null;

const sha1 = (str) => {
  const buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-1', buffer);
};

const convertSeed = async (phrase, shop = false) => {
  const buf = await sha1(phrase);
  const arr = new Uint32Array(buf);
  if (shop) {
    sfc32ShopInstance = sfc32(...arr);
  } else {
    sfc32Instance = sfc32(...arr);
  }
};

export const setSeed = async (phrase) => {
  await convertSeed(phrase);
  await convertSeed(phrase + 'shop', /* shop= */ true);
};

// Snapshot/restore both streams' internal sfc32 state (see replay.js). The
// RNG is seeded once per page load and never re-seeded between games, so the
// seed phrase alone only reproduces the first game of a session -- this is
// the source of truth for reproducing any later one.
export const exportState = () => ({
  main: sfc32Instance.getState(),
  shop: sfc32ShopInstance.getState(),
});

export const importState = (state) => {
  sfc32Instance.setState(state.main);
  sfc32ShopInstance.setState(state.shop);
};

export const setRandomSeed = async () => {
  const seedPhrase = Array.from({ length: 8 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  await setSeed(seedPhrase);
  return seedPhrase;
};

export const randomFloat = (shop = false) => {
  const value = shop ? sfc32ShopInstance() : sfc32Instance();
  // Test-only instrumentation for the golden-master trace harness (see test/).
  // No-op (and zero overhead) unless a trace run has installed the hook.
  if (globalThis.__RNG_TRACE__) {
    globalThis.__RNG_TRACE__.push(value);
  }
  return value;
};
export const random = (lim, shop = false) => (randomFloat(shop) * lim) | 0;
export const randomChoose = (arr, shop = false) =>
  arr[random(arr.length, shop)];
export const randomRemove = (arr, shop = false) =>
  arr.splice(random(arr.length, shop), 1)[0];
