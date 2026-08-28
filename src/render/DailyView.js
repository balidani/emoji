import { createDiv, createButton } from './animations.js';
import {
  buildDailyLeaderboardList,
  buildDailyCountdownNote,
} from './dailyLeaderboardList.js';

// Daily Challenge name-entry + leaderboard, appended into the game-over
// screen's .scoreContainer (built entirely in JS by Game.over() -- there's
// no static markup for it in index.html, same as the achievement popup it
// sits alongside). .scoreContainer itself is `pointer-events: none` (a tap
// anywhere on it advances to the next game -- see Game.over()'s onGameOver
// listener), so every interactive element here opts back in explicitly (see
// style.css's .daily-submit-panel/.daily-leaderboard-panel rules) --
// otherwise the name field and buttons below would be unclickable.
export class DailyView {
  async promptDailyName() {
    const container = document.querySelector('.game .scoreContainer');
    if (!container) {
      return null;
    }
    return new Promise((resolve) => {
      const panel = createDiv('', 'daily-submit-panel');
      panel.appendChild(
        createDiv(
          'Submit to the Daily Challenge leaderboard?',
          'daily-submit-title'
        )
      );
      const row = createDiv('', 'daily-submit-row');
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 20;
      input.placeholder = 'name';
      input.classList.add('daily-submit-input');
      row.appendChild(input);

      const finish = (name) => {
        panel.remove();
        resolve(name);
      };
      const submitButton = createButton('submit', () => {
        const name = input.value.trim();
        if (!name) {
          return;
        }
        finish(name);
      });
      const skipButton = createButton('skip', () => finish(null));
      row.appendChild(submitButton);
      row.appendChild(skipButton);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          submitButton.click();
        }
      });
      panel.appendChild(row);
      container.appendChild(panel);
      input.focus();
    });
  }

  // Shown while the replay is in flight to the validate Lambda (which
  // reconstructs and replays the whole run server-side, so this can take a
  // few seconds -- see DAILY_CHALLENGE_AWS_SETUP.md #9). Removed by
  // hideDailySubmitting() once the response (or a failure) comes back and
  // Game.over() moves on to rendering the leaderboard.
  async showDailySubmitting() {
    const container = document.querySelector('.game .scoreContainer');
    if (!container) {
      return;
    }
    this.submittingPanel = createDiv('Validating…', 'daily-validating-panel');
    container.appendChild(this.submittingPanel);
  }
  async hideDailySubmitting() {
    this.submittingPanel?.remove();
    this.submittingPanel = null;
  }

  async renderDailyLeaderboard(rows, you) {
    const container = document.querySelector('.game .scoreContainer');
    if (!container) {
      return;
    }
    const panel = createDiv('', 'daily-leaderboard-panel');
    panel.appendChild(
      createDiv("Today's leaderboard", 'daily-leaderboard-title')
    );
    if (you?.dryRun) {
      panel.appendChild(
        createDiv(
          '🧪 Test mode -- this run was scored but not saved.',
          'daily-dry-run-note'
        )
      );
    }
    panel.appendChild(buildDailyLeaderboardList(rows, you));
    panel.appendChild(buildDailyCountdownNote());
    container.appendChild(panel);
  }
}
