import * as Const from '../consts.js';
import { formatBigNumber } from '../core/util.js';
import { createDiv, animate } from './animations.js';

// The event-log ticker DOM, extracted from eventlog.js (see REFACTOR_PLAN.md,
// Phase 4). Driven by DomRenderer.logResourceChange. The map bookkeeping below
// (aggregating repeated same-source/same-key events into a single updating
// line instead of spamming the log) is purely a presentation concern, so it
// lives here rather than in core/logic.
export class EventLogView {
  constructor() {
    this.eventLogDiv = document.querySelector('.game .event-log-inner');
    this.numericEventLineMap = {};
    this.numericEventMap = {};
    this.emojiEventLineMap = {};
    this.emojiEventMap = {};
  }
  async logResourceChange(
    key,
    value,
    source = Const.UNKNOWN,
    direction = 'earned'
  ) {
    const arrow = direction === 'lost' ? '←' : '→';
    let realValue = value;
    let eventKey;

    // If value is number
    if (typeof value === 'number') {
      eventKey = `${source}-${key}-${arrow}`;
      if (!(eventKey in this.numericEventMap)) {
        this.numericEventMap[eventKey] = 0;
      }
      this.numericEventMap[eventKey] += value;
      realValue = this.numericEventMap[eventKey];

      // Find line in numeric line map
      const lineId = this.numericEventLineMap[eventKey];
      if (lineId) {
        const lineDiv = document.getElementById(lineId);
        if (lineDiv) {
          lineDiv.innerText = `${source}${arrow}${key}${formatBigNumber(this.numericEventMap[eventKey])}`;
          lineDiv.classList.remove('hidden');
          // When line is updated, move it to top
          // Take the original out
          this.eventLogDiv.removeChild(lineDiv);
          // Re-insert at top
          this.eventLogDiv.insertBefore(lineDiv, this.eventLogDiv.firstChild);
          return;
        }
      }
    } else {
      eventKey = `${source}-${key}-${arrow}-${value}`;
      if (!(eventKey in this.emojiEventMap)) {
        this.emojiEventMap[eventKey] = 0;
      }
      this.emojiEventMap[eventKey] += 1;
      realValue = this.emojiEventMap[eventKey];

      // Find line in emoji line map
      const lineId = this.emojiEventLineMap[eventKey];
      if (lineId) {
        const lineDiv = document.getElementById(lineId);
        if (lineDiv) {
          lineDiv.innerText = `${source}${arrow}${key}${this.emojiEventMap[eventKey]}`;
          lineDiv.classList.remove('hidden');
          // When line is updated, move it to top
          // Take the original out
          this.eventLogDiv.removeChild(lineDiv);
          // Re-insert at top
          this.eventLogDiv.insertBefore(lineDiv, this.eventLogDiv.firstChild);
          return;
        }
      }
    }

    const text = `${source}${arrow}${key}${formatBigNumber(realValue)}`;
    const logLines = document.querySelector('.event-log-inner');
    const logLine = createDiv(text, 'event-log-line');
    logLine.id = `event-log-line-${source}-${key}`;
    logLines.insertBefore(logLine, logLines.firstChild);

    if (typeof value === 'number') {
      this.numericEventLineMap[eventKey] = logLine.id;
    } else {
      this.emojiEventLineMap[eventKey] = logLine.id;
    }

    if (logLines.children.length > 20) {
      // Hide visibility of all lines past 20 with CSS
      for (let i = 20; i < logLines.children.length; i++) {
        logLines.children[i].classList.add('hidden');
      }
    }

    await animate(logLines, 'eventLogScroll', 0.2);
  }
}
