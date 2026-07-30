// Seeded RNG (sfc32), extracted from util.js (see REFACTOR_PLAN.md, Phase 1).
// No DOM access here -- seeding is driven explicitly by the caller (main.js today,
// bootstrap.js eventually), which is also responsible for reflecting the seed
// phrase into the UI.

const sfc32 = (a, b, c, d) => {
  return function () {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    let t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
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
