# Daily Challenge & Server-Validated Runs — Design

Status: design complete, implementation not started.
Grounded against `dev` @ `c57d6ed`. App version at time of writing: `1.0.4`
(`progression.js`'s `CURRENT_VERSION`).

## 1. Goal

A new game mode, **Daily Challenge**, in which every player plays the same
board:

- The RNG seed for the day is **randomly generated once by the server** and
  handed to the client.
- When the run finishes, the client's **replay** is sent to the server for
  **validation**. The server re-derives the canonical daily game from the
  seed, replays the submitted events, and — only if they validate — computes
  the score itself.
- A valid score is stored in a database with a **player-provided name**.
- The **top 100** scores for the day are returned and shown on the game-over
  screen.
- The 🎟️ **Free Turn** ("ticket") symbol is removed from Daily Challenge: not
  offered in the shop, not produced by 🎁 Gift, and not reachable via 🃏 Joker.

Hosting constraint: the site is a static app on **AWS Amplify**. The backend
should be the smallest pile of managed AWS pieces that can be created and
wired together directly (API Gateway + Lambda + DynamoDB), scaling to zero
when idle.

## 2. What already exists (and is reused wholesale)

This feature is mostly *wiring*, not new engine work, because the two hard
parts already exist and are tested.

- **Deterministic replays.** `src/replay.js` already records a run as
  `{ seed, rng, settings, mode, unlockedBags, events }` and can replay it
  event-for-event, throwing `ReplayDivergenceError` on the first mismatch
  (`playEvent`). The events are the only free variable: `['r']` roll,
  `['b', offerId, emoji, ...toolTarget]` buy, `['f']` refresh. Every buy is
  checked against live shop state (offer exists, emoji matches, purchase
  actually applied via `stats.run.totalBought`), so a tampered event stream
  fails closed.
- **RNG state, not just seed.** `src/core/rng.js` exposes
  `setSeed`/`exportState`/`importState`. The RNG is seeded once per page load
  and never re-seeded between games, which is exactly why a replay captures
  the *state*. For Daily Challenge we lean on the simpler special case: the
  daily run is the **first and only** game after a load seeded with the daily
  phrase, so its start state is `setSeed(dailySeed)`'s state — fully
  reconstructable from the seed alone, server-side.
- **Buyable-pool narrowing.** `Catalog.restrictTo(allowedSet)` sets
  `shopAllowed`, which `generateShop`'s `isOffered()` consults. This is the
  same lever Progression mode already uses (`bootstrap.js` `loadSettings`,
  `restrictTo(PROGRESSION.unlockedEmoji())`). Crucially, `generateShop` only
  draws `randomFloat(shop=true)` for symbols that pass `isOffered()`
  (`catalog.js`), so excluding a symbol *removes its draw* — see §5.
- **Headless replay under Node.** `test/unit/replay-roundtrip.test.js` already
  plays a game and drives its replay through `runReplay()` under jsdom, then
  asserts the two RNG traces are byte-identical. The server validator is the
  same loop with a server-derived start state and a headless renderer.
- **A mode system with a UI slot.** `Progression.setMode` +
  `showModeSelectOverlay` (`bootstrap.js`) + the sidebar "game mode" picker
  already switch modes and reload. Daily Challenge is a third mode.

## 3. Trust model (the crux)

The server **reconstructs the canonical daily game from data it owns** and
**trusts only the client's event list**. Everything else in a submitted
replay (`seed`, `rng`, `settings`, `mode`) is ignored for scoring and used at
most as a cross-check.

Concretely, for a submission tagged with date `D`:

1. Look up (or derive) the day's seed `S_D` — server-owned, §7.3.
2. `setSeed(S_D)`, build the **canonical** catalog from the canonical daily
   `symbolSources`, `updateSymbols()`, `restrictTo(dailyAllowed)`. This
   reproduces the exact RNG start state and buyable pool a legitimate client
   had, because the client did the identical sequence from the identical
   seed as its first game.
3. Construct the daily `Game` with the **canonical** settings (board size,
   `gameLength`, `startingSet`) and replay `events` through the shared
   `playEvent` loop.
4. Any `ReplayDivergenceError`, or a run that doesn't reach `game.isOver`,
   → **reject**. Otherwise the score is `inventory.getResource(Const.MONEY)`
   read from the server's own game object — never from the client.

The only thing a malicious client can vary is the event list, and the event
list is validated against canonical state at every step. There is no score
field in the request; a forged score requires a genuinely valid event
sequence, which *is* a genuine run.

Version pinning: the validator Lambda is built from a specific commit and
knows its own `CURRENT_VERSION`. A submission whose `appVersion` differs is
rejected with "replay from a different game version" — cross-version
determinism is not guaranteed and must not be silently accepted.

## 4. Daily seed, day boundary, and the client entry flow

- **Day boundary is UTC.** The challenge id is the UTC date `YYYY-MM-DD`. The
  client may show it in local time, but the seed lookup and leaderboard
  partition key are the UTC date, so every player worldwide shares one board
  per calendar-UTC day and validation is unambiguous.
- **Entry flow** (reuses the existing seed-from-hash + reload-on-mode-switch
  machinery, so it adds no new seeding path):
  1. Player picks **Daily Challenge** in the mode overlay / sidebar picker.
  2. Client `GET`s today's seed from the server (§7.3).
  3. Client sets the seed for the run and reloads into daily mode (see the
     note below on *how* — hash vs. explicit seed), so `bootstrap.js` seeds
     the page from `S_D` and the daily game is the **first** game of the
     session. This makes the recorded start state `= setSeed(S_D)`, which is
     what §3 relies on.
  4. `loadSettings` sees `mode === 'daily'`, applies `restrictTo(dailyAllowed)`
     and the canonical daily settings, and constructs the game with a
     `ReplayRecorder` tagged `mode: 'daily'` (§6).
- **Settings are locked in daily mode.** The settings panel (board size,
  turns) must be disabled while in daily mode, because any deviation from
  canonical settings changes the shop/board and would fail validation. The
  server enforces canonical settings regardless (it reconstructs them), so
  this is a UX guard, not the security boundary.

Note on seeding mechanics: the existing hash path (`window.location.hash`,
`bootstrap.js`) is the least-invasive way to seed from `S_D`. A user could of
course type any hash and "play a fake daily," but such a run simply won't
validate (its events won't match the canonical stream, or its seed won't be
today's), so no trust is placed in the hash. If we'd rather not expose the
seed in the URL, store `S_D` in `sessionStorage` and have `bootstrap.js`
prefer it over the hash when `mode === 'daily'` — a one-line addition to the
seed-selection block. Either is fine; the hash reuses more existing code.

## 5. Removing the 🎟️ ticket from Daily Challenge

The ticket is `FreeTurn` (`src/extra-symbols/beta.js`, `static emoji = '🎟️'`,
`rarity = 0.03`), loaded by default via `ALL_TESTED_SYMBOL_FILES`
(`game_settings.js`). It grants a bonus ⏰ and already "voids all
achievements," so it's a natural thing to drop from a competitive board.

**One lever covers all three spawn vectors: a catalog restriction.**

- **Shop.** `generateShop`'s `isOffered()` returns false for anything outside
  `shopAllowed`, so the ticket is never offered.
- **🎁 Gift.** `Lootbox.evaluateProduce` (`symbols/things.js`) calls
  `game.catalog.generateShop(...)` and picks from the result — it inherits the
  same `shopAllowed` gate, so it can't roll a ticket (including its `rareOnly`
  branch: the ticket at rarity 0.03 would otherwise be in the rare pool).
- **🃏 Joker.** `Wildcard.rollDisguise` draws from the frozen `JOKER_DISGUISES`
  constant (`symbols/wildcard.js`), which **does not contain 🎟️** — verified.
  A Joker can disguise as 🎁 Gift (which *is* in the pool), but that Gift then
  routes through `generateShop` and hits the same gate, so even the
  Joker→Gift chain can't yield a ticket.

So the entire requirement reduces to: in daily mode,
`catalog.restrictTo(<all catalog emoji> \ {🎟️})`, applied identically at
record, playback, and validation time.

**Empirical check (spike, run against `dev`):** seeded `generateShop` over
several passes, comparing the full catalog vs. the ticket-excluded catalog:

```
ticket present in catalog: true
full  shop draws: 167
excl  shop draws: 163          # exactly the ticket's per-pass draws removed
ticket appears in any excl shop: false
exclude-path reproducible (record==replay parity): true
```

This confirms the load-bearing property: excluding the ticket **perturbs the
shop RNG stream** (removes its draws), so the exclusion *must* be applied on
both sides — and it is deterministic, so record and replay produce identical
streams. Because the ticket is only excluded when `mode === 'daily'`, Sandbox
(the only mode the golden traces exercise) is untouched — **no trace
re-baseline** (§8).

Defense-in-depth (recommended, cheap): a unit test asserting
`dailyExcluded ∩ JOKER_DISGUISES === ∅`, so a future edit that adds 🎟️ to the
disguise pool trips a red test instead of silently leaking it into daily runs.

Where the allowed set lives: a small shared helper, e.g.
`dailyAllowedEmoji(catalog)` returning
`new Set([...catalog.symbols.keys()].filter(e => e !== '🎟️'))`, with the
excluded set as an exported constant `DAILY_EXCLUDED = new Set(['🎟️'])`.
Client and server import the *same* helper, so they can never disagree.

## 6. Client changes

1. **Mode.** Add `'daily'` to `Progression`'s mode handling and a third
   option in `#mode-select-overlay` (`index.html`) + the sidebar picker. Daily
   mode does not touch `unlockedBags`/`levelData`.
2. **`loadSettings` branch** (`bootstrap.js`): when `mode === 'daily'`, apply
   canonical daily `GameSettings`, `catalog.restrictTo(dailyAllowedEmoji(...))`,
   hide the progression bar (as Sandbox does), and lock the settings panel.
3. **Recorder.** `ReplayRecorder` already snapshots `mode`; tag daily runs
   `mode: 'daily'`. No new fields — the daily allowed set is derivable from
   `mode` + canonical sources + pinned version.
4. **`runReplay` branch** (`replay.js`): mirror the existing
   `mode === 'progression'` restriction with a `mode === 'daily'` branch
   applying `restrictTo(dailyAllowedEmoji(...))`, so *shared* daily replays
   (not just server validation) reproduce correctly in-browser.
5. **Game-over: name entry, submit, leaderboard.** Add renderer-port methods
   (see §8 for the port rule): e.g. `promptDailyName()` →
   `renderDailyLeaderboard(rows, { you })`. `DomRenderer`/`ReplayRenderer`
   implement the real DOM (a name field + the top-100 list appended to the
   existing `.scoreContainer` in `game.over()`); **`NullRenderer` and
   `SimRenderer` no-op them**, so headless play and traces are unaffected. In
   daily mode, `game.over()` (or the `onGameOver` flow) serializes
   `recorder.serialize()`, `POST`s it with the name, and renders the returned
   rows. A completed daily run that the player declines to submit still shows
   a read-only leaderboard via a plain `GET` (§7.4).

## 7. Backend (AWS)

### 7.1 Shape

```
[ Amplify static site ]  --HTTPS-->  [ API Gateway (HTTP API) ]
                                          |            |            |
                                     GET  |      POST  |       GET  |
                                     seed |     submit |  leaderboard
                                          v            v            v
                                     [ Lambda:    [ Lambda:     [ Lambda:
                                       seed ]       validate ]    board ]
                                          |            |  |          |
                                          v            v  v          v
                              DynamoDB DailySeeds   validate  DynamoDB DailyScores
                                                    reuses src/ + jsdom
                                                    (optional S3 replay archive)
```

Everything is serverless and scales to zero. HTTP API (not REST API) is the
cheaper/simpler API Gateway flavor and is sufficient.

### 7.2 Endpoints

- `GET /daily/seed?date=YYYY-MM-DD` → `{ date, seed }`. Defaults `date` to the
  current UTC date; refuses non-current dates to keep the seed unpredictable
  until its day.
- `POST /daily/submit` → body `{ date, name, replay }` (`replay` is the
  base64 `EMOJIRPLY1` code from `recorder.serialize()`). Validates (§7.5) and
  on success returns
  `{ score, rank, top: [ { name, score, topEmoji, rank }, ... ] }`
  (`topEmoji`: up to 3 `{emoji, money}`, descending by money earned that run,
  computed server-side from the same reconstructed game as `score` -- see
  §7.5).
- `GET /daily/leaderboard?date=YYYY-MM-DD` → `{ date, top: [...] }` (top 100),
  for viewing without submitting.

CORS on the HTTP API allows the Amplify domain(s) only. The client reads the
API base URL from a small `config.js` (or an Amplify build-time env var); no
secrets on the client.

### 7.3 Daily seed generation

Primary (matches "randomly generated by the server"): the `seed` Lambda does
an **idempotent, race-free create-then-read** in DynamoDB `DailySeeds`:

- `PutItem` with `ConditionExpression: attribute_not_exists(date)` and a
  freshly generated cryptographically random phrase (e.g. 8 lowercase letters
  to match `setRandomSeed`'s alphabet, or any string — `setSeed` SHA-1s it).
- On the conditional-check failure (another request already created it), just
  `GetItem`. Either way the first writer's value wins and every subsequent
  reader — including the validator — sees the same `S_D`.

Alternative (stateless, zero storage): derive `S_D = HMAC(secret, date)`.
Reproducible by the validator without a table, unpredictable to clients until
the date is current (the seed endpoint gates on date). Either works; the
stored-random version matches the phrasing and keeps the seed independent of
any secret.

### 7.4 DynamoDB schema

- **`DailySeeds`**: `PK = date` (string `YYYY-MM-DD`), attr `seed`. (Omit
  entirely if using the HMAC derivation.)
- **`DailyScores`**: single-partition-per-day, sorted for a one-query top-100.
  - `PK = "DATE#" + date`
  - `SK = "SCORE#" + pad(score) + "#" + submissionId` — `pad(score)` is the
    integer score as a **fixed-width, zero-padded decimal string** so
    lexicographic SK order == numeric score order; `submissionId` (a uuid)
    breaks ties and keeps rows unique.
  - Attributes: `name`, `score` (numeric, for display), `topEmoji` (up to 3
    `{emoji, money}`, descending by money earned that run -- server-computed,
    same trust boundary as `score`), `ts`, `appVersion`, optional `replayKey`
    (S3) for audit.
  - Top-100 query: `Query(PK = "DATE#"+date, ScanIndexForward=false,
    Limit=100)`. Rank is the row index.
  - Money can grow large (`formatBigNumber`); store `score` as a string too if
    it can exceed `Number.MAX_SAFE_INTEGER`, and pad to a width that covers
    the largest plausible score.
  - Option: keep only a player's best score per day by making the row key
    name-scoped and conditionally overwriting on improvement. Default: accept
    all submissions; the leaderboard is just the top 100 rows. Decide per
    product taste (§10).

### 7.5 Validator Lambda

- Node Lambda that **bundles the game's `src/` modules and `jsdom`**. jsdom is
  already a devDependency; the validator needs only a minimal DOM
  (`.game .shop`) because `NullRenderer`/`SimRenderer` build a real `ShopView`
  (see `test/unit/helpers/realGame.js`'s `ensureShopDom`). It does **not** need
  a browser.
- Steps, per §3: `parseReplay` (shape check) → reject on version mismatch →
  `setSeed(S_D)` → build canonical catalog → `updateSymbols()` →
  `restrictTo(dailyAllowedEmoji(...))` → construct daily `Game` with
  `SimRenderer`, `isReplay = true`, a no-op `onGameOver`, and a stub
  progression → run each event through the shared `playEvent` → require
  `game.isOver` afterward → read score and topEmoji
  (`game.stats.run.topMoneyEmoji(3)`).
- Refactor `replay.js` to **export the shared drive loop** (`playEvent`, or a
  `driveEvents(game, events)` helper) and add a headless
  `validateReplay(base64, { deriveStart })`. `runReplay` (browser) and
  `validateReplay` (server) then share one code path — the same one
  `replay-roundtrip.test.js` already proves deterministic. The only
  difference is `validateReplay` derives the start state from the seed instead
  of `importState`-ing the client's `rng`.
- On success write the `DailyScores` row (and optionally archive the raw
  replay to S3 under `replayKey`), then query and return the top 100.

### 7.6 Anti-abuse & ops

- **Name**: trim, cap length (~20 graphemes), strip control chars; optional
  profanity filter. Names are display-only.
- **No client score**: score is server-computed; there is nothing to forge but
  a valid run.
- **Rate limiting**: API Gateway throttling + a per-IP cap on `submit` (the
  validator is the only non-trivial-cost path). A completed genuine run is
  minutes of play, so aggressive limits don't hurt real players.
- **Payload**: replays are small (a few KB–tens of KB of base64 JSON); well
  under API Gateway/Lambda limits. Store only the leaderboard row in DynamoDB
  (400 KB item limit); archive full replays to S3 if audit is wanted, rather
  than inline.
- **IAM least-privilege**: seed Lambda → `PutItem`/`GetItem` on `DailySeeds`;
  validator → `GetItem` on `DailySeeds`, `PutItem`+`Query` on `DailyScores`,
  optional `PutObject` on the archive bucket; board Lambda → `Query` on
  `DailyScores`.

## 8. Determinism & golden-trace impact

- **No trace re-baseline.** The ticket exclusion and every daily branch are
  gated on `mode === 'daily'`; Sandbox (the only mode the golden suite
  exercises) draws exactly as before (spike-confirmed, §5).
- **Renderer-port rule.** The name-entry/leaderboard UI is new renderer
  surface. Per `ARCHITECTURE.md`, every new port method needs an implementation
  in the abstract `Renderer`, a real one in `DomRenderer`/`ReplayRenderer`, and
  **no-ops in `NullRenderer` and `SimRenderer`**, so headless play and traces
  see nothing new. Game logic must not touch the leaderboard DOM directly.
- **New mode ≠ new draws in existing modes.** Adding `'daily'` handling to
  `restrictTo`, `loadSettings`, `runReplay`, and the recorder introduces no
  RNG draws on the Sandbox/Progression paths.

## 9. Phased implementation

Each phase leaves the game playable and `npm test` green.

1. **Ticket exclusion + daily config, client-only.** `DAILY_EXCLUDED` +
   `dailyAllowedEmoji` helper; `'daily'` mode plumbing in `Progression`,
   `loadSettings`, `runReplay`, recorder; canonical daily `GameSettings`;
   locked settings panel; seed comes from a hardcoded/local phrase for now
   (no server). Add unit tests: ticket never offered/gift-spawned; daily
   replay round-trips in-browser; `DAILY_EXCLUDED ∩ JOKER_DISGUISES === ∅`.
2. **Headless `validateReplay`.** Refactor `replay.js` to share the drive
   loop; add `validateReplay` deriving start state from a seed. Add a Vitest
   round-trip: record a daily run → `validateReplay` → assert valid + score
   matches the live final score; plus tampered-events, wrong-settings, and
   truncated-run rejections.
3. **AWS backend.** DynamoDB tables; seed/validate/board Lambdas (validator
   bundles `src/` + jsdom); HTTP API + CORS; version pin. Wire the client
   entry flow to `GET /daily/seed` and game-over to `POST /daily/submit` +
   leaderboard render (new renderer-port methods, `NullRenderer`/`SimRenderer`
   no-ops).
4. **Polish.** Read-only leaderboard view, name persistence
   (`localStorage`), rate limiting, optional S3 replay archive, optional
   best-per-name dedup.

## 10. Open questions

- **Multiple submissions per day**: accept all (top-100 rows may repeat a
  name) vs. keep best-per-name (conditional overwrite). Leaning best-per-name
  for a cleaner board, but it adds a name→row lookup; defer to phase 4.
- **Seed exposure**: URL hash (reuses more code) vs. `sessionStorage`
  (keeps the seed out of the address bar). Both validate identically; §4.
- **Seed source**: stored-random (matches the brief, needs `DailySeeds`) vs.
  HMAC-derived (stateless). §7.3.
- **Score width for the SK**: pick a zero-pad width that safely exceeds the
  largest reachable daily score; revisit if balance work raises the ceiling.

## 11. Security summary

The server accepts exactly one untrusted input per submission — the event
list — and validates it against a game it reconstructs entirely from
server-owned data (the day's seed, the pinned game version, the canonical
settings, and the daily exclusion). Score, seed, settings, and RNG state are
never trusted from the client. Forging a high score is equivalent to
producing a valid sequence of rolls/buys/refreshes for the day's board, which
is indistinguishable from actually playing it.
