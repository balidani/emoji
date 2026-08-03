#!/usr/bin/env node
// Golden-master trace runner.
//
// Drives the real game (through window.simulate, which uses the real Board/Shop/
// Inventory and the actual seeded RNG) inside headless Chromium, and records an
// ordered trace of every gameplay-relevant event: raw RNG draws, resource changes,
// board mutations, and shop offer generation. Diffs the trace against a committed
// golden file per fixture.
//
// Usage:
//   node test/run-trace.mjs            # verify against committed goldens
//   node test/run-trace.mjs --update   # (re)write the committed goldens

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { fixtures } from './fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GOLDEN_DIR = path.join(__dirname, 'golden');

// playwright-core does not bundle a browser; resolve one from (in priority order)
// an explicit env override, the PLAYWRIGHT_BROWSERS_PATH cache (as set up in this
// sandbox), or fall back to letting playwright-core find a system Chrome/Chromium.
function resolveChromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (cacheRoot && fs.existsSync(cacheRoot)) {
    const match = fs
      .readdirSync(cacheRoot)
      .find(
        (name) =>
          name.startsWith('chromium-') && !name.includes('headless_shell')
      );
    if (match) {
      const candidate = path.join(cacheRoot, match, 'chrome-linux', 'chrome');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined; // let playwright-core fall back to its own resolution / channel.
}
const CHROMIUM_PATH = resolveChromiumPath();

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Runs inside the page. Patches shared class prototypes (reachable from the live
// `window.game` instance, but shared with every instance created by window.simulate
// too, since it's the same module graph) to append human-readable trace lines into
// the same array the RNG hook in util.js/rng.js is already writing raw draws to.
function installTraceHooks() {
  window.__TRACE__ = window.__RNG_TRACE__;
  const push = (line) => window.__TRACE__.push(line);

  const boardProto = Object.getPrototypeOf(window.game.board);
  const invProto = Object.getPrototypeOf(window.game.inventory);
  const evtProto = Object.getPrototypeOf(window.game.eventlog);
  const catProto = Object.getPrototypeOf(window.game.catalog);

  const wrapVoid = (proto, method, fmt) => {
    const orig = proto[method];
    proto[method] = function (...args) {
      push(fmt(...args));
      return orig.apply(this, args);
    };
  };
  const wrapResult = (proto, method, fmt) => {
    const orig = proto[method];
    proto[method] = function (...args) {
      const result = orig.apply(this, args);
      push(fmt(args, result));
      return result;
    };
  };

  wrapVoid(
    boardProto,
    'addSymbol',
    (_g, sym, x, y) => `board.addSymbol ${sym.emoji()} @ ${x},${y}`
  );
  wrapVoid(
    boardProto,
    'removeSymbol',
    (_g, x, y) => `board.removeSymbol @ ${x},${y}`
  );
  wrapVoid(
    boardProto,
    'lockCell',
    (x, y, symbol, duration) =>
      `board.lockCell ${symbol.emoji()} @ ${x},${y} dur=${duration}`
  );
  wrapVoid(boardProto, 'unlockCell', (x, y) => `board.unlockCell @ ${x},${y}`);
  wrapVoid(
    boardProto,
    'makePassive',
    (_g, x, y) => `board.makePassive @ ${x},${y}`
  );
  wrapVoid(boardProto, 'pinCell', (_g, x, y) => `board.pinCell @ ${x},${y}`);
  wrapVoid(invProto, 'add', (symbol) => `inventory.add ${symbol.emoji()}`);
  wrapVoid(
    invProto,
    'remove',
    (symbol) => `inventory.remove ${symbol.emoji()}`
  );
  wrapVoid(
    evtProto,
    'logResourceChange',
    (key, value, source, direction) =>
      `event ${source}${direction === 'lost' ? '←' : '→'}${key}${value}`
  );
  wrapResult(
    catProto,
    'generateShop',
    (args, result) =>
      `catalog.generateShop(min=${args[0]},luck=${args[1]},rare=${!!args[2]}) -> ${result.map((s) => s.emoji()).join('')}`
  );
}

async function runFixture(browser, baseUrl, fixture) {
  const page = await browser.newPage();
  const consoleLines = [];
  page.on('console', (msg) => {
    if (/^\d+\tscore/.test(msg.text())) {
      consoleLines.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.error(`[${fixture.name}] page error: ${err}`);
  });
  // Installed before any page script runs, so it captures RNG draws from the very
  // first import-time static initializer onward (this matters for Santa's static
  // initializer draw -- see the note below).
  await page.addInitScript(() => {
    window.__RNG_TRACE__ = [];
  });
  await page.goto(`${baseUrl}/index.html#${fixture.seed}`, {
    waitUntil: 'load',
  });
  await page.waitForFunction(() => window.game && window.simulate);
  await page.evaluate(installTraceHooks);
  await page.evaluate(
    ({ buyAlways, buyOnce, rounds }) =>
      window.simulate(buyAlways, buyOnce, rounds),
    {
      buyAlways: fixture.buyAlways,
      buyOnce: fixture.buyOnce,
      rounds: fixture.rounds ?? 1,
    }
  );
  const trace = await page.evaluate(() =>
    window.__TRACE__.map((x) => (typeof x === 'number' ? `rng:${x}` : x))
  );
  await page.close();
  return [...trace, ...consoleLines.map((l) => `console: ${l}`)];
}

async function main() {
  const update = process.argv.includes('--update');
  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice('--only='.length);
  const server = await startServer();
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
    args: ['--no-sandbox'],
  });

  let failures = 0;
  const selected = only ? fixtures.filter((f) => f.name === only) : fixtures;
  for (const fixture of selected) {
    let trace;
    try {
      trace = await runFixture(browser, baseUrl, fixture);
    } catch (e) {
      console.error(`ERROR running ${fixture.name}: ${e}`);
      failures++;
      continue;
    }
    const goldenPath = path.join(GOLDEN_DIR, `${fixture.name}.trace`);
    const content = trace.join('\n') + '\n';
    if (update) {
      fs.mkdirSync(GOLDEN_DIR, { recursive: true });
      fs.writeFileSync(goldenPath, content);
      console.log(`wrote ${fixture.name}: ${trace.length} events`);
      continue;
    }
    if (!fs.existsSync(goldenPath)) {
      console.error(
        `MISSING golden for ${fixture.name} (run with --update first)`
      );
      failures++;
      continue;
    }
    const golden = fs.readFileSync(goldenPath, 'utf8');
    if (golden !== content) {
      failures++;
      const goldenLines = golden.split('\n');
      const newLines = content.split('\n');
      let firstDiff = -1;
      for (let i = 0; i < Math.max(goldenLines.length, newLines.length); i++) {
        if (goldenLines[i] !== newLines[i]) {
          firstDiff = i;
          break;
        }
      }
      console.error(`DIVERGED ${fixture.name} at line ${firstDiff}`);
      console.error(`  golden: ${goldenLines[firstDiff]}`);
      console.error(`  actual: ${newLines[firstDiff]}`);
    } else {
      console.log(`OK ${fixture.name}: ${trace.length} events`);
    }
  }

  await browser.close();
  server.close();
  if (failures > 0) {
    console.error(`\n${failures} fixture(s) diverged or failed.`);
    process.exit(1);
  }
  console.log('\nAll fixtures match golden traces.');
}

main();
