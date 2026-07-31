import { createDiv } from './animations.js';

// The level-select strip, extracted from progression.js (REFACTOR_PLAN.md,
// Phase 9). Progression keeps the level/save/localStorage model; this class
// only builds the chip DOM from plain data and reports clicks back via
// callbacks.
export class ProgressionView {
  constructor() {
    this.uiDiv = document.querySelector('.progression');
  }

  // levels: [{name, beaten, reward, highScore, active}]
  render(levels, { onJumpTo, onWipe }) {
    this.uiDiv.replaceChildren();
    levels.forEach((level, i) => {
      const levelDiv = createDiv(undefined, 'level');
      levelDiv.appendChild(createDiv(level.name, 'level-name'));
      if (!level.beaten) {
        levelDiv.classList.add('unbeaten');
      } else {
        levelDiv.appendChild(createDiv(level.reward, 'level-reward'));
        levelDiv.appendChild(
          createDiv(`${level.highScore}`, 'level-highscore')
        );
        levelDiv.classList.add('beaten');
        levelDiv.addEventListener('click', () => {
          onJumpTo(i);
        });
      }

      if (level.active) {
        levelDiv.classList.add('active');
        levelDiv.addEventListener('click', () => {
          onJumpTo(i);
        });
      }
      this.uiDiv.appendChild(levelDiv);
    });

    const wipeDiv = createDiv('Wipe Progress', 'wipe-button');
    wipeDiv.addEventListener('click', () => {
      onWipe();
    });
    this.uiDiv.appendChild(wipeDiv);
  }
}
