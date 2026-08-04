// UNIT_TEST_PLAN.md section 7.4
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { MusicalNote, Pirate } from '../../src/symbols/music.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney } from './helpers/assertions.js';

describe('music.js', () => {
  beforeEach(async () => {
    await setSeed('music');
  });

  describe('MusicalNote 🎵', () => {
    it('pays 💵4 and is CATEGORY_UNBUYABLE', async () => {
      const { game, board } = buildGame({ grid: ['🎵 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 4);
      expect(new MusicalNote().categories()).toContain(CATEGORY_UNBUYABLE);
    });

    it('disappears after 3 turns', async () => {
      const { game, board } = buildGame({ grid: ['🎵 ⬜'] });
      const note = board.cells[0][0];
      note.turns = 2;
      await note.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🎵');

      note.turns = 3;
      await note.evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });
  });

  describe('Bell 🔔', () => {
    it('pays 💵9', async () => {
      const { game, board } = buildGame({ grid: ['🔔 ⬜'], startingMoney: 0 });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 9);
    });

    it('20% chance: makes one 🎵 on a random empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['🔔 🎯', '⬜ ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      let noteCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '🎵') noteCount++;
        }
      }
      expect(noteCount).toBe(1);
    });

    it('does nothing when the 20% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['🔔 ⬜'] });
      await seedFirstDraw((v) => v >= 0.2, { prefix: 'bell-nofire' });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });
  });

  describe('Drums 🥁', () => {
    it('every 3rd turn, makes a 🎵 on a nearby empty space; counter() tracks it', async () => {
      const { game, board } = buildGame({ grid: ['🥁 ⬜'] });
      const drums = board.cells[0][0];
      drums.turns = 0;
      expect(drums.counter()).toBe(3);
      await drums.evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🎵');
    });

    it('does nothing on turns that are not a multiple of 3', async () => {
      const { game, board } = buildGame({ grid: ['🥁 ⬜'] });
      const drums = board.cells[0][0];
      drums.turns = 1;
      await drums.evaluateProduce(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });
  });

  describe('Record 📀', () => {
    it('evaluateConsume eats neighboring 🎵, +6 to permanent notes each', async () => {
      const { game, board } = buildGame({ grid: ['📀 🎵 🎵'] });
      const record = board.cells[0][0];
      await record.evaluateConsume(game, 0, 0);
      expect(record.notes).toBe(6); // only (1,0) is adjacent to (0,0)
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[0][2].emoji()).toBe('🎵'); // not a neighbor, untouched
    });

    it('score pays notes; counter()/copy() preserve it', async () => {
      const { game, board } = buildGame({
        grid: ['📀 🎵'],
        startingMoney: 0,
      });
      const record = board.cells[0][0];
      await record.evaluateConsume(game, 0, 0);
      await record.score(game, 0, 0);
      expectMoney(game, 6);
      expect(record.counter()).toBe(6);
      expect(record.copy().notes).toBe(6);
    });
  });

  describe('Pirate 🏴‍☠️', () => {
    it('copies a single neighboring Record onto an empty cell', async () => {
      const { game, board } = buildGame({ grid: ['🏴‍☠️ 📀', '⬜ ⬜'] });
      const originalRecord = board.cells[0][1];
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      let recordCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '📀') recordCount++;
        }
      }
      expect(recordCount).toBe(2);
      expect(board.cells[0][1]).toBe(originalRecord); // original untouched
    });

    it('copies every neighboring Record when space allows', async () => {
      const { game, board } = buildGame({
        grid: ['📀 🏴‍☠️ 📀', '⬜ ⬜ ⬜'],
      });
      await board.cells[0][1].evaluateProduce(game, 1, 0);
      let recordCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '📀') recordCount++;
        }
      }
      expect(recordCount).toBe(4);
    });

    it('is bounded by empty space', async () => {
      const { game, board } = buildGame({
        grid: ['📀 🏴‍☠️ 📀', '⬜ 🪨 🪨'],
      });
      await board.cells[0][1].evaluateProduce(game, 1, 0);
      let recordCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '📀') recordCount++;
        }
      }
      expect(recordCount).toBe(3); // 2 originals + 1 copy (only 1 empty neighbor)
    });

    it('does nothing without a neighboring Record (and draws no RNG)', async () => {
      const { game, board } = buildGame({ grid: ['🏴‍☠️ ⬜'] });
      globalThis.__RNG_TRACE__ = [];
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      const trace = globalThis.__RNG_TRACE__;
      delete globalThis.__RNG_TRACE__;
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(trace.length).toBe(0);
    });

    it('does nothing without an empty neighbor', async () => {
      const { game, board } = buildGame({ grid: ['🏴‍☠️ 📀', '🪨 🪨'] });
      const originalRecord = board.cells[0][1];
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][1]).toBe(originalRecord); // untouched
      let recordCount = 0;
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '📀') recordCount++;
        }
      }
      expect(recordCount).toBe(1);
    });

    it('copy preserves the source Record stockpile', async () => {
      const { game, board } = buildGame({ grid: ['🏴‍☠️ 📀', '⬜ ⬜'] });
      const record = board.cells[0][1];
      record.notes = 42;
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      const copies = [];
      for (const row of board.cells) {
        for (const cell of row) {
          if (cell.emoji() === '📀' && cell !== record) copies.push(cell);
        }
      }
      expect(copies.length).toBe(1);
      expect(copies[0].notes).toBe(42);
    });

    it('has rarity -0.1', () => {
      expect(new Pirate().rarity).toBe(-0.1);
    });
  });
});
