// Thin fetch wrapper for the three Daily Challenge endpoints (see
// DAILY_CHALLENGE_AWS_SETUP.md #6-7). No trust logic lives here -- the
// server is the trust boundary (src/replay.js's validateReplay); this module
// just shapes requests/responses.

import { DAILY_API_BASE } from './config.js';

export class DailyApiError extends Error {}

function requireApiBase() {
  if (!DAILY_API_BASE) {
    throw new DailyApiError('Daily Challenge backend is not configured.');
  }
}

async function readErrorReason(response) {
  try {
    const body = await response.json();
    return body.reason;
  } catch {
    return undefined;
  }
}

// -> { date, seed }
export async function fetchDailySeed() {
  requireApiBase();
  const response = await fetch(`${DAILY_API_BASE}/daily/seed`);
  if (!response.ok) {
    throw new DailyApiError(
      (await readErrorReason(response)) ||
        `Failed to fetch today's seed (${response.status}).`
    );
  }
  return response.json();
}

// replay: the base64 EMOJIRPLY1 code from recorder.serialize().
// -> { score, rank, top: [{ name, score, rank }, ...], dryRun }
// dryRun: true from a testing origin the server never persists submissions
// from -- validated and scored for real, but this run was never saved.
export async function submitDailyRun(date, name, replay) {
  requireApiBase();
  const response = await fetch(`${DAILY_API_BASE}/daily/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date, name, replay }),
  });
  if (!response.ok) {
    throw new DailyApiError(
      (await readErrorReason(response)) ||
        `Submission was rejected (${response.status}).`
    );
  }
  return response.json();
}

// -> { date, top: [{ name, score, rank }, ...] }
export async function fetchDailyLeaderboard(date) {
  requireApiBase();
  const url = `${DAILY_API_BASE}/daily/leaderboard?date=${encodeURIComponent(date)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new DailyApiError(
      (await readErrorReason(response)) ||
        `Failed to fetch the leaderboard (${response.status}).`
    );
  }
  return response.json();
}
