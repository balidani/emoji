// @vitest-environment jsdom
//
// Local-only sanity check (not part of the regular suite) -- calls the
// project's own official validateReplay() (src/replay.js) unmodified
// against the pasted replay, to check whether the divergence seen in
// replay-analysis.test.js's hand-rolled reconstruction is a bug in that
// script or the documented, still-open "shop draw order diverges at full
// DAILY_SETTINGS scale" issue flagged in validateReplay()'s own header
// comment.
import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { validateReplay, parseReplay } from '../../src/replay.js';
import { CURRENT_VERSION } from '../../src/progression.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  path.resolve(__dirname, '../../index.html'),
  'utf8'
);
const REPLAY_B64 = readFileSync(
  path.resolve(__dirname, 'replay.b64.txt'),
  'utf8'
).trim();

function loadDom() {
  const bodyMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);
  document.body.innerHTML = bodyMatch[1];
}
function cloneTemplateIntoGame() {
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const clone = template.cloneNode(true);
  clone.classList.remove('hidden');
  gameDiv.appendChild(clone.children[0]);
}

describe('official validateReplay() sanity check (local only)', () => {
  it('reports whether the pasted replay reconstructs cleanly', async () => {
    loadDom();
    cloneTemplateIntoGame();
    const parsed = parseReplay(REPLAY_B64);
    console.log('appVersion in replay:', parsed.appVersion);
    console.log('CURRENT_VERSION:', CURRENT_VERSION);
    const result = await validateReplay(REPLAY_B64, {
      seed: parsed.seed,
      appVersion: parsed.appVersion,
    });
    console.log('validateReplay result:', JSON.stringify(result));
  }, 120000);
});
