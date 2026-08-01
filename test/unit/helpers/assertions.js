import { expect } from 'vitest';
import * as Const from '../../../src/consts.js';

export function expectMoney(game, n) {
  expect(game.inventory.getResource(Const.MONEY)).toBe(n);
}

export function expectResource(game, key, n) {
  expect(game.inventory.getResource(key)).toBe(n);
}

export function expectBoardEmoji(board, x, y, emoji) {
  expect(board.cells[y][x].emoji()).toBe(emoji);
}

// Counts how many recorded spy calls match `method` (and, if given, further
// per-argument predicates in `where`, e.g. { name: 'flip' } matches
// animateCell's 3rd positional arg by the names used in this harness).
const ARG_NAMES = {
  animateCell: ['x', 'y', 'name', 'duration', 'repeat', 'cssVars'],
  animateCellOverlay: ['x', 'y', 'name', 'duration', 'repeat', 'cssVars'],
};

export function matchingCalls(spy, method, where = {}) {
  const argNames = ARG_NAMES[method] || [];
  return spy.calls.filter((call) => {
    if (call.method !== method) return false;
    return Object.entries(where).every(([key, value]) => {
      const idx = argNames.indexOf(key);
      if (idx < 0) return false;
      return call.args[idx] === value;
    });
  });
}

export function expectAnimated(spy, method, where = {}, times) {
  const matches = matchingCalls(spy, method, where);
  if (times === undefined) {
    expect(matches.length).toBeGreaterThan(0);
  } else {
    expect(matches.length).toBe(times);
  }
}

export function expectNotAnimated(spy, method, where = {}) {
  expect(matchingCalls(spy, method, where).length).toBe(0);
}

export function expectCallCount(spy, method, times) {
  expect(spy.calls.filter((c) => c.method === method).length).toBe(times);
}
