import { createDiv, createSpan } from './animations.js';

// Achievements panel DOM (see ACHIEVEMENTS_DESIGN.md, section 10). Locked
// rows show a 🔒 icon plus the "how to earn" text; unlocked rows show the
// real icon plus the earned text.
export class AchievementsView {
  constructor() {
    this.root = document.querySelector('.achievements-list');
  }
  renderAchievements(model) {
    this.root.replaceChildren();
    for (const a of model) {
      const row = createDiv(
        '',
        'achievement-entry',
        a.unlocked ? 'unlocked' : 'locked'
      );
      row.appendChild(
        createSpan(a.unlocked ? a.icon : '🔒', 'achievement-icon')
      );
      const body = createDiv('', 'achievement-body');
      body.appendChild(createDiv(a.name, 'achievement-name'));
      body.appendChild(createDiv(a.description, 'achievement-desc'));
      row.appendChild(body);
      this.root.appendChild(row);
    }
  }
  notifyAchievement(_) {
    // Optional: transient toast on unlock. No-op for now.
  }
}
