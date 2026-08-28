// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DailyView } from '../../src/render/DailyView.js';

function setUpScoreContainer() {
  document.body.innerHTML =
    '<div class="game"><div class="scoreContainer"></div></div>';
}

describe('DailyView.renderDailyLeaderboard', () => {
  beforeEach(() => {
    setUpScoreContainer();
  });

  it('renders a top-emoji badge per row, joined with no separator', async () => {
    const view = new DailyView();
    await view.renderDailyLeaderboard(
      [
        {
          rank: 1,
          name: 'dan',
          score: 100,
          topEmoji: [
            { emoji: '💎', money: 50 },
            { emoji: '🎁', money: 30 },
            { emoji: '🐔', money: 20 },
          ],
        },
      ],
      null
    );
    const badge = document.querySelector('.daily-leaderboard-top-emoji');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe('💎🎁🐔');
  });

  it('omits the badge for a row with no topEmoji (rows submitted before this existed)', async () => {
    const view = new DailyView();
    await view.renderDailyLeaderboard(
      [{ rank: 1, name: 'dan', score: 100 }],
      null
    );
    expect(document.querySelector('.daily-leaderboard-top-emoji')).toBeNull();
  });

  it('omits the badge for a row with an empty topEmoji array', async () => {
    const view = new DailyView();
    await view.renderDailyLeaderboard(
      [{ rank: 1, name: 'dan', score: 100, topEmoji: [] }],
      null
    );
    expect(document.querySelector('.daily-leaderboard-top-emoji')).toBeNull();
  });

  it('shows the time left until the next seed under the entries', async () => {
    const view = new DailyView();
    await view.renderDailyLeaderboard(
      [{ rank: 1, name: 'dan', score: 100 }],
      null
    );
    const note = document.querySelector('.daily-leaderboard-countdown');
    expect(note).not.toBeNull();
    expect(note.textContent).toMatch(/^Next challenge in \d+h \d+m$/);
  });
});
