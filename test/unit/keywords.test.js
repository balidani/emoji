import { describe, it, expect } from 'vitest';
import { createInteractiveDescription } from '../../src/core/util.js';
import { KEYWORDS } from '../../src/keywords.js';
import { Symb } from '../../src/symbol.js';
import * as money from '../../src/symbols/money.js';
import * as animals from '../../src/symbols/animals.js';
import * as food from '../../src/symbols/food.js';
import * as music from '../../src/symbols/music.js';
import * as rocks from '../../src/symbols/rocks.js';
import * as advanced from '../../src/symbols/advanced.js';
import * as things from '../../src/symbols/things.js';
import * as tools from '../../src/symbols/tools.js';
import * as wildcard from '../../src/symbols/wildcard.js';

const KEYWORD_TOKEN_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

describe('createInteractiveDescription keyword linkification', () => {
  it('wraps [Display](id) as a clickable keyword span, keyed by id', () => {
    const html = createInteractiveDescription(
      'Every turn: [Spawns](spawn) a 🪙.'
    );
    expect(html).toContain(
      '<span class="keyword" data-keyword="spawn">Spawns</span>'
    );
  });

  it('resolves different display text to the same id without stemming', () => {
    const spawn = createInteractiveDescription('[Spawn](spawn)');
    const spawns = createInteractiveDescription('[Spawns](spawn)');
    const spawning = createInteractiveDescription('[Spawning](spawn)');
    expect(spawn).toContain('data-keyword="spawn">Spawn<');
    expect(spawns).toContain('data-keyword="spawn">Spawns<');
    expect(spawning).toContain('data-keyword="spawn">Spawning<');
  });

  it('leaves ordinary parentheses untouched', () => {
    const html = createInteractiveDescription('x4 per neighboring 🧈 (x2)');
    expect(html).toContain('(x2)');
    expect(html).not.toContain('class="keyword"');
  });

  it('still wraps emoji outside keyword tokens as interactive-emoji', () => {
    const html = createInteractiveDescription('[Pays](pays) 💵2.');
    expect(html).toContain(
      '<span class="interactive-emoji" data-emoji="💵">💵</span>'
    );
  });
});

describe('KEYWORDS registry completeness', () => {
  const symbolModules = [
    money,
    animals,
    food,
    music,
    rocks,
    advanced,
    things,
    tools,
    wildcard,
  ];

  const allSymbolInstances = [];
  for (const mod of symbolModules) {
    for (const value of Object.values(mod)) {
      if (typeof value === 'function' && value.prototype instanceof Symb) {
        allSymbolInstances.push(new value());
      }
    }
  }

  it('found at least one symbol to scan', () => {
    expect(allSymbolInstances.length).toBeGreaterThan(0);
  });

  it('every (id) referenced in a symbol description exists in KEYWORDS', () => {
    const missingIds = new Set();
    for (const symbol of allSymbolInstances) {
      for (const match of symbol.description().matchAll(KEYWORD_TOKEN_RE)) {
        const id = match[2];
        if (!(id in KEYWORDS)) {
          missingIds.add(id);
        }
      }
    }
    expect([...missingIds]).toEqual([]);
  });

  it('every (id) referenced inside a keyword description also exists in KEYWORDS', () => {
    const missingIds = new Set();
    for (const entry of Object.values(KEYWORDS)) {
      for (const match of entry.description.matchAll(KEYWORD_TOKEN_RE)) {
        const id = match[2];
        if (!(id in KEYWORDS)) {
          missingIds.add(id);
        }
      }
    }
    expect([...missingIds]).toEqual([]);
  });
});
