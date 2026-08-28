// Run + lifetime action counters. No DOM, no RNG -- these hooks only read
// existing state and increment plain counters, so they can never desync the
// golden-master trace suite.

const transformKey = (from, to) => `${from}>${to}`; // `>` never appears in an emoji

// Per-run counters. Reset every `new Game`.
export class RunStats {
  constructor() {
    this.boughtByEmoji = {}; // emoji -> count bought this run
    this.generatedByEmoji = {}; // emoji -> count spawned onto the board this run
    this.moneyByEmoji = {}; // emoji -> summed 💵 earned by that emoji this run
    this.transforms = {}; // 'from>to' -> count this run
    this.moneyEarned = 0; // sum of positive 💵 deltas this run
    this.turnsPlayed = 0; // turns actually consumed this run
    this.maxInventorySize = 0; // high-water mark of inventory.symbols.length
    this.maxLuck = 0; // high-water mark of the 💫 resource reached this run
    this.maxUniqueSymbols = 0; // high-water mark of distinct symbol types held at once
    this.maxRows = 0; // high-water mark of board rows reached this run
    this.refreshesUsed = 0; // successful shop refreshes this run
    this.freeTurnsGranted = 0; // extra ⏰ granted by 🎟️ FreeTurn this run -- voids all achievements, see Achievements.evaluate
    this.chickenFarmAchieved = false; // sticky: board was ever 25+ 🐔 and nothing else this run
  }
  get totalBought() {
    return Object.values(this.boughtByEmoji).reduce((a, b) => a + b, 0);
  }
  // Descending by money earned this run, ties broken by whichever emoji
  // earned first (Object.entries preserves insertion order for string keys,
  // and Array.prototype.sort is stable) -- deterministic, though nothing
  // here is RNG-sensitive, so it wouldn't matter for replay validation
  // either way. Returns fewer than n entries if fewer than n distinct
  // emoji ever earned money this run.
  topMoneyEmoji(n = 3) {
    return Object.entries(this.moneyByEmoji)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([emoji, money]) => ({ emoji, money }));
  }
}

// Cross-run counters. Serialized to localStorage (see achievements-store.js).
export class ProfileStats {
  constructor(data = {}) {
    this.dragonsHatched = data.dragonsHatched ?? 0; // legacy field, kept for import compat
    this.gamesPlayed = data.gamesPlayed ?? 0;
    this.lifetimeMoneyEarned = data.lifetimeMoneyEarned ?? 0;
    this.lifetimeBought = data.lifetimeBought ?? 0;
    this.transforms = data.transforms ?? {}; // 'from>to' -> lifetime count
  }
  toJSON() {
    return {
      dragonsHatched: this.dragonsHatched,
      gamesPlayed: this.gamesPlayed,
      lifetimeMoneyEarned: this.lifetimeMoneyEarned,
      lifetimeBought: this.lifetimeBought,
      transforms: this.transforms,
    };
  }
}

// Facade the game holds as `game.stats`. Records go here; both scopes update
// together so callers don't care which bucket a stat lives in.
export class Stats {
  constructor(profile) {
    this.run = new RunStats();
    this.profile = profile; // shared ProfileStats instance (persisted)
  }
  recordBought(emoji) {
    this.run.boughtByEmoji[emoji] = (this.run.boughtByEmoji[emoji] ?? 0) + 1;
    this.profile.lifetimeBought += 1;
  }
  recordGenerated(emoji) {
    this.run.generatedByEmoji[emoji] =
      (this.run.generatedByEmoji[emoji] ?? 0) + 1;
  }
  // Generic: any symbol that turns into another calls this with the two emoji.
  recordTransform(from, to) {
    const k = transformKey(from, to);
    this.run.transforms[k] = (this.run.transforms[k] ?? 0) + 1;
    this.profile.transforms[k] = (this.profile.transforms[k] ?? 0) + 1;
  }
  runTransforms(from, to) {
    return this.run.transforms[transformKey(from, to)] ?? 0;
  }
  lifetimeTransforms(from, to) {
    return this.profile.transforms[transformKey(from, to)] ?? 0;
  }
  recordMoneyEarned(amount) {
    if (amount <= 0) return;
    this.run.moneyEarned += amount;
    this.profile.lifetimeMoneyEarned += amount;
  }
  recordMoneySourced(emoji, amount) {
    this.run.moneyByEmoji[emoji] = (this.run.moneyByEmoji[emoji] ?? 0) + amount;
  }
  recordTurn() {
    this.run.turnsPlayed += 1;
  }
  recordInventorySize(size) {
    if (size > this.run.maxInventorySize) this.run.maxInventorySize = size;
  }
  recordLuck(value) {
    if (value > this.run.maxLuck) this.run.maxLuck = value;
  }
  recordUniqueSymbols(count) {
    if (count > this.run.maxUniqueSymbols) this.run.maxUniqueSymbols = count;
  }
  recordRows(count) {
    if (count > this.run.maxRows) this.run.maxRows = count;
  }
  recordRefresh() {
    this.run.refreshesUsed += 1;
  }
  recordFreeTurn() {
    this.run.freeTurnsGranted += 1;
  }
  recordChickenFarm(achieved) {
    if (achieved) this.run.chickenFarmAchieved = true;
  }
}
