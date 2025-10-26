import * as Const from '../consts.js';
import * as Util from './util.js';

export class EventLog {
  constructor() {
    this.eventLogDiv = document.querySelector('.game .event-log-inner');
    this.numericEventLineMap = {};
    this.numericEventMap = {};
    this.emojiEventLineMap = {};
    this.emojiEventMap = {};
  }
  reset() {
    this.eventLogDiv.replaceChildren();
    this.numericEventLineMap = {};
    this.numericEventMap = {};
    this.emojiEventLineMap = {};
    this.emojiEventMap = {};
  }
  async showResourceChange(key, value, source=Const.UNKNOWN, arrow='→') {
    let realValue = value;

    // If value is number
    if (typeof value === 'number') {
      const eventKey = `${source}-${key}-${arrow}`;
      if (!(eventKey in this.numericEventMap)) {
        this.numericEventMap[eventKey] = 0;
      }
      this.numericEventMap[eventKey] += value;
      realValue = this.numericEventMap[eventKey];

      // Find line in numeric line map
      const lineId = this.numericEventLineMap[source];
      if (lineId) {
        const lineDiv = document.getElementById(lineId);
        if (lineDiv) {
          lineDiv.innerText = `${source}${arrow}${key}${Util.formatBigNumber(this.numericEventMap[eventKey])}`;
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
      const eventKey = `${source}-${key}-${arrow}-${value}`;
      if (!(eventKey in this.emojiEventMap)) {
        this.emojiEventMap[eventKey] = 0;
      }
      this.emojiEventMap[eventKey] += 1;
      realValue = this.emojiEventMap[eventKey];

      // Find line in emoji line map
      const lineId = this.emojiEventLineMap[source];
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

    const text = `${source}${arrow}${key}${Util.formatBigNumber(realValue)}`;
    const logLines = document.querySelector('.event-log-inner');
    const logLine = Util.createDiv(text, 'event-log-line');
    logLine.id = `event-log-line-${source}-${key}`;
    logLines.insertBefore(logLine, logLines.firstChild);
    
    if (typeof value === 'number') {
      this.numericEventLineMap[source] = logLine.id;
    } else {
      this.emojiEventLineMap[source] = logLine.id;
    }

    if (logLines.children.length > 20) {
      // Hide visibility of all lines past 20 with CSS
      for (let i = 20; i < logLines.children.length; i++) {
        logLines.children[i].classList.add('hidden');
      }
    }

    await Util.animate(logLines, 'eventLogScroll', 0.2);

  }
  async showResourceEarned(key, value, source=Const.UNKNOWN) {
    this.showResourceChange(key, value, source, '→');
  }
  async showResourceLost(key, value, source=Const.UNKNOWN) {
    this.showResourceChange(key, value, source, '←');
  }
}
