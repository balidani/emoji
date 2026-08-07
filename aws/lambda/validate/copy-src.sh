#!/usr/bin/env bash
# Path B (SAM) equivalent of build.sh's copy step, minus the zip/npm install
# -- `sam build` does its own per-function `npm install` from package.json.
# Run before `sam build` (see DAILY_CHALLENGE_AWS_SETUP.md #12).
set -euo pipefail
cd "$(dirname "$0")"
REPO_ROOT="$(cd ../../.. && pwd)"

rm -rf src index.html
cp -R "$REPO_ROOT/src" ./src
cp "$REPO_ROOT/index.html" ./index.html
echo "Copied src/ and index.html into $(pwd)"
