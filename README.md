# Emoji Slot Machine Game
Slot machine game using emojis, https://unicode.fun/

**Play this fork:** https://babakoban.github.io/emoji-slots/

## Discord
https://discord.com/invite/wyCDHsuk


# Changelog (fork of balidani/emoji)

### New Items

| Item | Description |
|------|-------------|
| Gambler 🤑 | -2% Luck. Triples neighboring 🎲 payouts. Removes adjacent 💳 |

### Changes to Existing Items

| Item | Change |
|------|--------|
| Ticket 🎟️ | Now costs 💵100, +💵100 per ticket bought this run (was a flat cost) |
| Eye 🧿 | Passived symbols no longer count as removed, so Grave 🪦 won't spawn them back |

### Other Changes
- Added a dark mode toggle (⚙️ game settings)

---

# Development

## Linter
Finds unused vars and code syntax issues:

`npm run lint`

## Formatter
Enforces code style rules like semicolons, line spacing, etc:

`npm run format`

## Setup

> **Note**
> Some browsers will cache the JS files. Disable caching in the network tab of your developer tools to make life easier.

### WSL (Windows Subsystem for Linux)
- Install [Node.js](https://nodejs.org/en)
- `npm install -g http-server`
- Navigate to repository in WSL console
- `http-server`
- Open browser and navigate to http://127.0.0.1:8080/

### VS Code
- Install Live Server extension, https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer
- CMD + L, CMD + O to open browser to http://127.0.0.1:5500/

<!-- GitHub integration test line -->
