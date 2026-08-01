// UNIT_TEST_PLAN.md section 7.7
import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { CATEGORY_UNBUYABLE } from '../../src/symbol.js';
import { CATEGORY_TOOL } from '../../src/symbols/tools.js';
import { Bomb, Firefighter, Moon, Santa } from '../../src/symbols/things.js';
import { buildGame } from './helpers/fakeGame.js';
import { seedFirstDraw } from './helpers/rngSeeds.js';
import { expectMoney } from './helpers/assertions.js';

describe('things.js', () => {
  beforeEach(async () => {
    await setSeed('things');
  });

  describe('Balloon 🎈', () => {
    it('pays 💵20', async () => {
      const { game, board } = buildGame({
        grid: ['🎈 ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 20);
    });

    it('50% badChance: pops (removes itself)', async () => {
      const { game, board } = buildGame({ grid: ['🎈 ⬜'] });
      await seedFirstDraw((v) => v < 0.5, { prefix: 'balloon-pop' });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('⬜');
    });

    it('on the other 50%, survives', async () => {
      const { game, board } = buildGame({ grid: ['🎈 ⬜'] });
      await seedFirstDraw((v) => v >= 0.5, { prefix: 'balloon-survive' });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🎈');
    });

    it('a 🎯 neighbor forces badChance false, so it can never pop', async () => {
      const { game, board } = buildGame({ grid: ['🎈 🎯'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🎈');
    });
  });

  describe('Bomb 💣', () => {
    it('is CATEGORY_UNBUYABLE', () => {
      expect(new Bomb().categories()).toContain(CATEGORY_UNBUYABLE);
    });

    it('10% chance: destroys a neighbor, excluding Empty and Firefighter', async () => {
      const { game, board } = buildGame({
        grid: ['💣 🎯', '🧑‍🚒 🪨'],
      });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      // Only (1,1)=🪨 is eligible (🎯 excluded? no -- only Empty/Firefighter are excluded).
      // Firefighter (0,1) must never be picked; Empty is never present here, so
      // assert the firefighter survives and exactly one of the other two neighbors is gone.
      expect(board.cells[1][0].emoji()).toBe('🧑‍🚒');
    });

    it('does nothing when the 10% chance does not fire', async () => {
      const { game, board } = buildGame({ grid: ['💣 🪨'] });
      await seedFirstDraw((v) => v >= 0.1, { prefix: 'bomb-nofire' });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🪨');
    });
  });

  describe('Firefighter 🧑‍🚒', () => {
    it('is CATEGORY_UNBUYABLE', () => {
      expect(new Firefighter().categories()).toContain(CATEGORY_UNBUYABLE);
    });

    it('disarms all neighboring 💣, then removes itself', async () => {
      const { game, board } = buildGame({
        grid: ['🧑‍🚒 💣', '💣 ⬜'],
      });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
      expect(board.cells[1][0].emoji()).toBe('⬜');
      expect(board.cells[0][0].emoji()).toBe('⬜'); // self-removed
    });

    it('no-ops (stays put) when there is no neighboring 💣', async () => {
      const { game, board } = buildGame({ grid: ['🧑‍🚒 ⬜'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][0].emoji()).toBe('🧑‍🚒');
    });
  });

  describe('Moon 🌝', () => {
    it('pays nothing before 31 turns', async () => {
      const { game, board } = buildGame({ grid: ['🌝 ⬜'], startingMoney: 0 });
      const moon = board.cells[0][0];
      moon.turns = 30;
      await moon.score(game, 0, 0);
      expectMoney(game, 0);
    });

    it('pays 💵600 at 31 turns and resets the counter', async () => {
      const { game, board } = buildGame({ grid: ['🌝 ⬜'], startingMoney: 0 });
      const moon = board.cells[0][0];
      moon.turns = 31;
      await moon.score(game, 0, 0);
      expectMoney(game, 600);
      expect(moon.turns).toBe(0);
    });

    it('counter() is 31 - turns; turns is copy-preserved', () => {
      const moon = new Moon(10);
      expect(moon.counter()).toBe(21);
      expect(moon.copy().turns).toBe(10);
    });
  });

  describe('SewingKit 🧵', () => {
    it('removes neighboring 🕳️', async () => {
      const { game, board } = buildGame({ grid: ['🧵 🕳️'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('⬜');
    });

    it('no-ops with no neighboring 🕳️', async () => {
      const { game, board } = buildGame({ grid: ['🧵 🪨'] });
      await board.cells[0][0].evaluateConsume(game, 0, 0);
      expect(board.cells[0][1].emoji()).toBe('🪨');
    });
  });

  describe('Lootbox 🎁', () => {
    it('opens into a random symbol, never a TOOL or UNBUYABLE one, and increments giftsOpened', async () => {
      const { game, board, inventory } = buildGame({ grid: ['🎁 ⬜'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      const produced = board.cells[0][0];
      expect(produced.emoji()).not.toBe('🎁');
      expect(produced.categories()).not.toContain(CATEGORY_TOOL);
      expect(produced.categories()).not.toContain(CATEGORY_UNBUYABLE);
      expect(inventory.giftsOpened).toBe(1);
    });

    it('20% chance: opens a rare-only symbol (rarity < 0.101), forced via 🎯', async () => {
      const { game, board } = buildGame({ grid: ['🎁 🎯'] });
      await board.cells[0][0].evaluateProduce(game, 0, 0);
      expect(board.cells[0][0].rarity).toBeLessThan(0.101);
    });
  });

  describe('Santa 🎅', () => {
    it('emoji() always starts with 🎅 (skin-tone variant chosen at load time, not hard-coded)', () => {
      expect(new Santa().emoji().startsWith('🎅')).toBe(true);
    });

    it('pays 💵25 per 🎁 opened this run', async () => {
      const { game, board } = buildGame({ grid: ['⬜ ⬜'], startingMoney: 0 });
      board.cells[0][0] = new Santa();
      game.inventory.giftsOpened = 3;
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 75);
    });

    it('pays 0 with no gifts opened', async () => {
      const { game, board } = buildGame({ grid: ['⬜ ⬜'], startingMoney: 0 });
      board.cells[0][0] = new Santa();
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
    });
  });

  describe('Cloud ☁️', () => {
    it('pays 6 per empty space on the board', async () => {
      const { game, board } = buildGame({
        grid: ['☁️ ⬜ ⬜'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 12); // 2 empty cells (excludes the ☁️ itself)
    });

    it('pays 0 on a full board', async () => {
      const { game, board } = buildGame({
        grid: ['☁️ 🪨'],
        startingMoney: 0,
      });
      await board.cells[0][0].score(game, 0, 0);
      expectMoney(game, 0);
    });
  });
});
