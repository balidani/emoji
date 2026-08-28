#!/usr/bin/env bash
# Packages the leaderboard Lambda -- no third-party deps, just the AWS SDK
# v3 already present in the Node 22 runtime (see
# DAILY_CHALLENGE_AWS_SETUP.md #4). Run from anywhere; always operates
# relative to this script.
set -euo pipefail
cd "$(dirname "$0")"
rm -f function.zip
zip -qr function.zip index.mjs package.json
echo "Wrote $(pwd)/function.zip"
