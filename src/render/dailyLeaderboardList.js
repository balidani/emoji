import { createDiv, createSpan } from './animations.js';
import { formatBigNumber } from '../core/util.js';

// Shared leaderboard-row rendering: used both by the game-over leaderboard
// (render/DailyView.js's renderDailyLeaderboard) and the pre-roll preview
// shown before the day's first roll (render/dailyLeaderboardPreview.js) --
// one place drawing a leaderboard row so the two can never drift apart.
// `you` is null for a read-only view (no run submitted yet this round).
export function buildDailyLeaderboardList(rows, you) {
  const list = createDiv('', 'daily-leaderboard-list');
  for (const row of rows) {
    const entry = createDiv('', 'daily-leaderboard-entry');
    if (you && row.rank === you.rank && row.name === you.name) {
      entry.classList.add('you');
    }
    entry.appendChild(createSpan(`#${row.rank}`, 'daily-leaderboard-rank'));
    entry.appendChild(createSpan(row.name, 'daily-leaderboard-name'));
    entry.appendChild(
      createSpan(formatBigNumber(row.score), 'daily-leaderboard-score')
    );
    // Missing/empty for rows submitted before this existed, or a run that
    // never had a single symbol earn money -- just omit the badge rather
    // than rendering an empty one.
    if (row.topEmoji?.length > 0) {
      entry.appendChild(
        createSpan(
          row.topEmoji.map((e) => e.emoji).join(''),
          'daily-leaderboard-top-emoji'
        )
      );
    }
    list.appendChild(entry);
  }
  return list;
}
