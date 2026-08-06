// @vitest-environment jsdom
// render/progressionBar.js -- the progress-bar component mounted underneath
// the board (app/bootstrap.js). DOM-only, no game/RNG involved.
import { describe, it, expect } from 'vitest';
import { renderProgressionBar } from '../../src/render/progressionBar.js';
import { GATES } from '../../src/progression-roster.js';

describe('renderProgressionBar', () => {
  it('fills a given container with steps + track, replacing prior content', () => {
    const container = document.createElement('div');
    container.appendChild(document.createElement('span')); // stale content
    renderProgressionBar(container, [0, 1]);

    expect(container.children).toHaveLength(2); // .steps + .track
    expect(container.querySelector('.progression-bar-steps')).not.toBeNull();
    expect(container.querySelector('.progression-bar-track')).not.toBeNull();
  });

  it('renders one step per gate, in order, positioned evenly along the bar', () => {
    const container = document.createElement('div');
    renderProgressionBar(container, []);
    const steps = container.querySelectorAll('.progression-bar-step');
    expect(steps).toHaveLength(GATES.length);
    steps.forEach((step, i) => {
      expect(step.textContent).toBe(GATES[i].emoji);
      expect(step.style.left).toBe(`${((i + 1) / GATES.length) * 100}%`);
    });
  });

  it('marks steps up to unlockedBags.length as cleared, no more', () => {
    const container = document.createElement('div');
    renderProgressionBar(container, [0, 1, 2]);
    const steps = container.querySelectorAll('.progression-bar-step');
    steps.forEach((step, i) => {
      expect(step.classList.contains('cleared')).toBe(i < 3);
    });
  });

  it('sets the fill width proportional to unlocked bags', () => {
    const container = document.createElement('div');
    renderProgressionBar(container, [0, 1, 2]);
    const fill = container.querySelector('.progression-bar-fill');
    expect(fill.style.width).toBe(`${(3 / GATES.length) * 100}%`);
  });

  it('is 0% filled and 100% filled at the extremes', () => {
    const empty = document.createElement('div');
    renderProgressionBar(empty, []);
    expect(empty.querySelector('.progression-bar-fill').style.width).toBe('0%');

    const full = document.createElement('div');
    renderProgressionBar(full, [0, 1, 2, 3, 4, 5]);
    expect(full.querySelector('.progression-bar-fill').style.width).toBe(
      '100%'
    );
  });

  it('overlays the shared status text on the bar', () => {
    const container = document.createElement('div');
    renderProgressionBar(container, [0]);
    expect(container.querySelector('.progression-bar-text').textContent).toBe(
      '1/6, next 🥉 (💵10000)'
    );
  });
});
