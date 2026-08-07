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
npm install --omit=dev
zip -qr function.zip index.mjs package.json index.html src node_modules
echo "Wrote $(pwd)/function.zip"
echo "APP_VERSION should be: $(grep -oE "CURRENT_VERSION = '[^']+'" src/progression.js)"
