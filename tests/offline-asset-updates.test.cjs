const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function worker({ offline = false, exactCached = null } = {}) {
  const handlers = {};
  const lookups = [];
  const writes = [];
  const fresh = { ok: true, clone: () => fresh };
  const old = { old: true };
  let requests = 0;
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
    URL,
    Response,
    self: { location: { origin: 'http://localhost' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: {
      match: async request => { lookups.push(request); return typeof request === 'string' ? old : exactCached; },
      open: async () => ({ put: async (...args) => { writes.push(args); } })
    },
    fetch: async () => { requests += 1; if (offline) throw new Error('Offline'); return fresh; }
  });
  const request = { method: 'GET', url: 'http://localhost/css/wayfinding.css?p1' };
  let response;
  handlers.fetch({ request, respondWith: value => { response = value; } });
  return { response, fresh, old, lookups, writes, requests: () => requests };
}

test('new asset versions fetch fresh content instead of silently serving older unversioned styles', async () => {
  const run = worker();
  assert.equal(await run.response, run.fresh);
  assert.equal(run.requests(), 1);
  assert.equal(run.lookups.length, 1);
  assert.equal(run.writes.length, 1);
});

test('versioned assets retain unversioned offline fallback and exact cached copies', async () => {
  const offline = worker({ offline: true });
  assert.equal(await offline.response, offline.old);
  assert.equal(offline.lookups[1], 'http://localhost/css/wayfinding.css');
  const exactCached = { current: true };
  const cached = worker({ exactCached });
  assert.equal(await cached.response, exactCached);
  assert.equal(cached.requests(), 0);
});
