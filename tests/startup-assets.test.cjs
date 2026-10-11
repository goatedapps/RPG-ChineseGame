const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function installer({ fail = false } = {}) {
  const listeners = new Map();
  const stored = new Map();
  const requests = [];
  let running = 0;
  let peak = 0;
  let activated = false;
  const cache = {
    async put(asset, response) { stored.set(asset, response); },
    async match(asset) { return stored.get(asset); }
  };
  const context = vm.createContext({
    self: {
      addEventListener(name, listener) { listeners.set(name, listener); },
      skipWaiting() { activated = true; }
    },
    caches: { async open() { return cache; } },
    async fetch(asset, options) {
      requests.push({ asset, priority: options.priority });
      peak = Math.max(peak, ++running);
      await new Promise(resolve => setTimeout(resolve, 1));
      running -= 1;
      return { ok: !fail, async json() { return [{ id: 'p6', worldMappingReady: true }, { id: 'unready', worldMappingReady: false }]; } };
    }
  });
  vm.runInContext(fs.readFileSync('sw.js', 'utf8'), context);
  let completion;
  listeners.get('install')({ waitUntil(promise) { completion = promise; } });
  return { completion, stored, requests, get peak() { return peak; }, get activated() { return activated; } };
}

test('offline installation bounds background downloads, uses low priority, and caches all playable assets before activation', async () => {
  const run = installer();
  await run.completion;
  assert.equal(run.peak, 2);
  assert(run.requests.every(request => request.priority === 'low'));
  assert.equal(run.activated, true);
  for (const asset of ['content/generated/p6.content.json', 'content/generated/p6.chars.json', 'assets/audio/treehouse-summit-bg.mp3', 'assets/images/room/room-crimson.webp']) {
    assert(run.stored.has(`./${asset}`), asset);
  }
  assert(!run.requests.some(request => request.asset.includes('unready')));
  assert.equal(new Set(run.requests.map(request => request.asset)).size, run.requests.length);
});

test('a missing offline asset cannot activate an incomplete replacement cache', async () => {
  const run = installer({ fail: true });
  await assert.rejects(run.completion, /Offline asset unavailable/);
  assert.equal(run.activated, false);
  assert(run.requests.length <= 2);
});

test('opening media stays within a compact first-screen budget', () => {
  assert(fs.statSync('assets/images/intro/dictionary-tree.webp').size < 160 * 1024);
  assert(fs.statSync('assets/images/hero/hero-walking.webp').size < 50 * 1024);
  const startup = fs.readFileSync('src/main.js', 'utf8');
  assert.match(startup, /openingImage.fetchPriority = 'high'/);
  assert.match(startup, /requestAnimationFrame\(registerOfflineCache\)/);
  assert.doesNotMatch(startup.match(/const warmPaths = \[[^\]]+\]/)?.[0] || '', /room\/|shop\/|reading-scroll/);
});
