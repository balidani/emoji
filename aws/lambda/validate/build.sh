#!/usr/bin/env bash
# Packages the validate Lambda: a raw (unbundled, unminified) copy of the
# repo's src/ and index.html, plus jsdom -- see DAILY_CHALLENGE_AWS_SETUP.md
# #4 for why src/ must be copied as-is (catalog.js's dynamic import(source)
# on relative paths only resolves if the files exist on disk in the zip).
# Self-locating, so it can be run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"
REPO_ROOT="$(cd ../../.. && pwd)"

rm -rf src index.html node_modules function.zip
cp -R "$REPO_ROOT/src" ./src
cp "$REPO_ROOT/index.html" ./index.html
# package.json pins jsdom to 24.1.3 (+ an override pinning its cssstyle dep
# to 4.0.1), not the ^30.x the repo's root devDependency uses -- two of
# jsdom's transitive deps ship pure-ESM code that jsdom's own CJS internals
# require() directly: html-encoding-sniffer@6+ (via @exodus/bytes) and
# cssstyle@4.1.0+ (via @asamuzakjp/css-color). Node's CJS loader can't
# require() an ES module (still true on Node 22 -- not a Node-20 quirk), so
# every Lambda invocation crashed at import time with ERR_REQUIRE_ESM.
# jsdom 24.1.3 + cssstyle 4.0.1 predate both.
npm install --omit=dev
zip -qr function.zip index.mjs package.json index.html src node_modules
echo "Wrote $(pwd)/function.zip"
echo "APP_VERSION should be: $(grep -oE "CURRENT_VERSION = '[^']+'" src/progression.js)"
