// POST /daily/submit -- see DAILY_CHALLENGE_AWS_SETUP.md #4, #7.5 and
// DAILY_CHALLENGE_DESIGN.md #3 (the trust model this function is the
// enforcement point for).
//
// This is the one endpoint that reconstructs and re-plays a full game, so it
// bundles a raw copy of the repo's src/ and index.html (see build.sh) plus
// jsdom -- everything src/replay.js's validateReplay() needs to build a real
// headless Game exactly as test/unit/replay-roundtrip.test.js does.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

import { validateReplay } from './src/replay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const SEEDS_TABLE = process.env.SEEDS_TABLE;
const SCORES_TABLE = process.env.SCORES_TABLE;
const APP_VERSION = process.env.APP_VERSION;
const SCORE_PAD_WIDTH = Number(process.env.SCORE_PAD_WIDTH || '30');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    // API Gateway's own CORS config (§6) already adds this to every
    // response; set explicitly too so it's correct even if this function is
    // ever invoked outside that API (local testing, a future direct
    // invocation), matching the handler contract in
    // DAILY_CHALLENGE_AWS_SETUP.md #4.
    'access-control-allow-origin': ALLOWED_ORIGIN,
  },
  body: JSON.stringify(body),
});

const todayUTC = () => new Date().toISOString().slice(0, 10);

// Trim, strip control characters, cap at 20 graphemes -- names are
// display-only (DAILY_CHALLENGE_AWS_SETUP.md #7.6). Returns null for
// anything that sanitizes down to nothing.
function sanitizeName(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  let stripped = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0);
    if (code >= 32 && code !== 127) {
      stripped += ch;
    }
  }
  stripped = stripped.trim();
  if (stripped.length === 0) {
    return null;
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const graphemes = [...segmenter.segment(stripped)].map((s) => s.segment);
  return graphemes.slice(0, 20).join('');
}

// Fresh jsdom document per invocation (not reused across a warm container's
// invocations) -- cheap relative to the game itself, and avoids any chance
// of DOM/listener state leaking between two players' submissions. Node 20's
// native crypto/TextEncoder/Intl.Segmenter are already global and more
// complete than jsdom's shims, so only `window`/`document` are installed
// (DAILY_CHALLENGE_AWS_SETUP.md #4).
function installDom() {
  const dom = new JSDOM(indexHtml, {
    url: 'https://daily-challenge.invalid/',
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.localStorage = dom.window.localStorage;

  // Mirror test/unit/replay-roundtrip.test.js's cloneTemplateIntoGame(): the
  // engine's DOM touches (`.game .info`, `.game .shop`,
  // `.game .progression-bar`) only resolve once the hidden `.template` is
  // cloned into `.game`, exactly like a real page load.
  const template = document.querySelector('.template');
  const gameDiv = document.querySelector('.game');
  gameDiv.replaceChildren();
  const clone = template.cloneNode(true);
  clone.classList.remove('hidden');
  gameDiv.appendChild(clone.children[0]);
}

async function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '');
  return JSON.parse(raw);
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method !== 'POST') {
    return json(405, { reason: 'Method not allowed.' });
  }

  let body;
  try {
    body = await parseBody(event);
  } catch {
    return json(400, { reason: 'Malformed request body.' });
  }

  const { date, replay } = body;
  if (date !== todayUTC()) {
    return json(400, { reason: 'date must be the current UTC date.' });
  }
  const name = sanitizeName(body.name);
  if (!name) {
    return json(400, { reason: 'name is required.' });
  }
  if (typeof replay !== 'string' || replay.length === 0) {
    return json(400, { reason: 'replay is required.' });
  }

  // The day's seed must already exist -- the client is expected to have
  // called GET /daily/seed first. Missing here means either a very unlucky
  // race with the seed Lambda's first write, or a submission for a day that
  // never got a seed at all.
  const { Item: seedItem } = await dynamo.send(
    new GetCommand({ TableName: SEEDS_TABLE, Key: { date } })
  );
  if (!seedItem) {
    return json(409, {
      reason: "Today's seed has not been generated yet -- fetch /daily/seed first.",
    });
  }

  installDom();
  const result = await validateReplay(replay, {
    seed: seedItem.seed,
    appVersion: APP_VERSION,
  });
  if (!result.valid) {
    return json(422, { reason: result.reason });
  }

  // Score is computed server-side, from the server's own reconstructed game
  // -- never trusted from the client (DAILY_CHALLENGE_DESIGN.md #3).
  const score = result.score;
  const submissionId = randomUUID();
  const pad = String(score).padStart(SCORE_PAD_WIDTH, '0');
  const sk = `SCORE#${pad}#${submissionId}`;
  await dynamo.send(
    new PutCommand({
      TableName: SCORES_TABLE,
      Item: {
        pk: `DATE#${date}`,
        sk,
        name,
        score: String(score),
        ts: new Date().toISOString(),
        appVersion: APP_VERSION,
      },
    })
  );

  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: SCORES_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `DATE#${date}` },
      ScanIndexForward: false,
      Limit: 100,
    })
  );
  // Rank by matching the row's own sk (unique per submission) rather than
  // re-comparing scores -- score can exceed Number.MAX_SAFE_INTEGER
  // (formatBigNumber territory), so it's stored as a string and a
  // string->Number->string round trip isn't guaranteed lossless.
  const rank = (Items ?? []).findIndex((item) => item.sk === sk) + 1;
  const top = (Items ?? []).map((item, i) => ({
    name: item.name,
    score: Number(item.score),
    rank: i + 1,
  }));

  return json(200, { score, rank: rank || null, top });
};
