import { createDiv, createSpan } from './animations.js';
import { GATES, progressionStatusText } from '../progression-roster.js';

// The progression-mode status bar mounted underneath the board during play
// (app/bootstrap.js): a thick green fill (unlockedBags length / GATES.length
// full), each gate's required medal marked along the top, and the shared
// status text overlaid on the bar itself. Caller decides when to mount/hide
// it (only meaningful in Progression mode).
export function renderProgressionBar(container, unlockedBags) {
  container.replaceChildren();

  const steps = createDiv('', 'progression-bar-steps');
  GATES.forEach((gate, i) => {
    const step = createSpan(gate.emoji, 'progression-bar-step');
    step.style.left = `${((i + 1) / GATES.length) * 100}%`;
    if (i < unlockedBags.length) {
      step.classList.add('cleared');
    }
    steps.appendChild(step);
  });
  container.appendChild(steps);

  const track = createDiv('', 'progression-bar-track');
  const fill = createDiv('', 'progression-bar-fill');
  fill.style.width = `${(unlockedBags.length / GATES.length) * 100}%`;
  track.appendChild(fill);
  track.appendChild(
    createDiv(progressionStatusText(unlockedBags), 'progression-bar-text')
  );
  container.appendChild(track);
}
