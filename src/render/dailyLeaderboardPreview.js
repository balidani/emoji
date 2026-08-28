import { createDiv } from './animations.js';
import { buildDailyLeaderboardList } from './dailyLeaderboardList.js';

// Daily Challenge: shows today's leaderboard by default, before the day's
// first roll -- mounted underneath the board (app/bootstrap.js's
// loadSettings), same slot pattern as the Progression-mode status bar
// (progressionBar.js), and faded out the same way once play starts (see
// game.js's roll()). Read-only: no run has been submitted yet this round,
// so there's no "you" row to highlight (unlike DailyView's game-over
// leaderboard, which reuses the same row-rendering via
// dailyLeaderboardList.js).
export function renderDailyLeaderboardPreview(container, rows) {
  container.replaceChildren();
  const panel = createDiv('', 'daily-leaderboard-panel');
  panel.appendChild(
    createDiv("Today's leaderboard", 'daily-leaderboard-title')
  );
  if (rows.length === 0) {
    panel.appendChild(
      createDiv(
        'No scores yet today -- be the first!',
        'daily-leaderboard-empty'
      )
    );
  } else {
    panel.appendChild(buildDailyLeaderboardList(rows, null));
  }
  container.appendChild(panel);
}
