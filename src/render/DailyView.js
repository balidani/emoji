import { createDiv, createSpan, createButton } from './animations.js';

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
    const list = createDiv('', 'daily-leaderboard-list');
    for (const row of rows) {
      const entry = createDiv('', 'daily-leaderboard-entry');
      if (you && row.rank === you.rank && row.name === you.name) {
        entry.classList.add('you');
      }
      entry.appendChild(createSpan(`#${row.rank}`, 'daily-leaderboard-rank'));
      entry.appendChild(createSpan(row.name, 'daily-leaderboard-name'));
      entry.appendChild(
        createSpan(String(row.score), 'daily-leaderboard-score')
      );
      list.appendChild(entry);
    }
    panel.appendChild(list);
    container.appendChild(panel);
  }
}
