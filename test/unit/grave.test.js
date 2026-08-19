import { describe, it, expect, beforeEach } from 'vitest';
import { setSeed } from '../../src/core/rng.js';
import { Grave } from '../../src/extra-symbols/beta.js';
import { Rock } from '../../src/symbols/rocks.js';
import { buildGame } from './helpers/fakeGame.js';

describe('Grave 🪦', () => {
  beforeEach(async () => {
    await setSeed('grave');
  });

  it('spawns a copy of a graveyard symbol into an empty neighbor', async () => {
    const { game, board } = buildGame({ grid: ['⬜ ⬜'], luck: 100000 });
    const dead = new Rock();
    game.inventory.graveyard.push(dead);

    await new Grave().evaluateProduce(game, 0, 0);

    expect(board.cells[0][1].emoji()).toBe('🪨');
  });

  it('only draws from the graveyard, so a passived symbol is never resurrected', async () => {
    const { game, board } = buildGame({ grid: ['⬜ ⬜'], luck: 100000 });
    game.inventory.graveyard.push(new Rock());

    await new Grave().evaluateProduce(game, 0, 0);

    expect(board.cells[0][1].emoji()).toBe('🪨');
    expect(board.passiveCells.length).toBe(0);
  });

  it('does nothing when the graveyard is empty', async () => {
    const { game, board } = buildGame({ grid: ['⬜ ⬜'], luck: 100000 });

    await new Grave().evaluateProduce(game, 0, 0);

    expect(board.cells[0][1].emoji()).toBe('⬜');
  });
});
