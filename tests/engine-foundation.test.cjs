const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('modular preview shell exposes the shared map and touch controls', () => {
  const html = fs.readFileSync(path.join(root, 'game', 'index.html'), 'utf8');
  const dom = new JSDOM(html);
  assert.ok(dom.window.document.querySelector('canvas#world'));
  assert.equal(dom.window.document.querySelectorAll('#dpad [data-direction]').length, 4);
  assert.match(dom.window.document.querySelector('script[type="module"]').getAttribute('src'), /^\.\.\/src\/main\.js\?p13/);
});
test('shared Region 1 map validates and supports movement interactions', async () => {
  const { attemptStep, validateMap } = await import('../src/world/map.js');
  const map = readJson('content/authored/campaign/maps/r1-hub.json');
  assert.deepEqual(validateMap(map), []);
  const moved = attemptStep({ x: 20, y: 14, direction: 'down' }, map, 'left');
  assert.equal(moved.moved, true);
  assert.equal(moved.player.x, 19);
  const sign = attemptStep({ x: 10, y: 14, direction: 'left' }, map, 'left');
  assert.equal(sign.moved, false);
  assert.equal(sign.interaction.id, 'forest-sign');
});
test('modular save codec isolates levels and detects edits', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { decodeSave, encodeSave, saveKey } = await import('../src/core/save.js');
  const levelPackage = {
    id: 'p2',
    content: { contentVersion: 'test' },
    map: { id: 'r1-hub', width: 40, height: 28, spawn: { x: 20, y: 14, direction: 'down' } }
  };
  const state = createFreshState(levelPackage);
  state.player.name = '小文';
  const encoded = encodeSave(state);
  assert.deepEqual(decodeSave(encoded), state);
  const pieces = encoded.split('.');
  pieces[2] = '00000000';
  assert.equal(decodeSave(pieces.join('.')).tampered, true);
  assert.equal(saveKey('p2'), 'wsq-next-save-p2');
  assert.equal(saveKey('p5'), 'wsq-next-save-p5');
});

test('prototype progress migrates by copying into the preview namespace', async () => {
  const { decodeSave: decodePreview, loadLevelState, saveKey } = await import('../src/core/save.js');
  const levelPackage = {
    id: 'p5',
    content: { contentVersion: 'test' },
    map: { id: 'r1-hub', width: 40, height: 28, spawn: { x: 20, y: 14, direction: 'down' } }
  };
  const legacy = { version: 1, level: 'p5', lvl: 4, xp: 12, hp: 18, coins: 77, x: 20, y: 14, words: { '露营': { c: 1 } } };
  const body = Buffer.from(JSON.stringify(legacy)).toString('base64');
  let hash = 0x811c9dc5;
  for (const character of `wsq·字灵·v1${body}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; }
  const legacyEncoded = `WSQ1.${body}.${hash.toString(16).padStart(8, '0')}`;
  const values = new Map([['wsq-save-p5', legacyEncoded]]);
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const result = loadLevelState(storage, levelPackage);
  assert.equal(result.migrated, true);
  assert.equal(result.state.player.level, 4);
  assert.equal(result.state.player.coins, 77);
  assert.equal(values.get('wsq-save-p5'), legacyEncoded);
  assert.ok(values.get(saveKey('p5')).startsWith('WSQ2.'));
  assert.equal(decodePreview(values.get(saveKey('p5'))).session.migratedFromPrototype, true);
});

test('content loader combines a selected curriculum with the shared campaign', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const fetcher = async url => {
    const file = path.join(root, url.replace(/^\//, '').replaceAll('/', path.sep));
    return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => readJson(path.relative(root, file)) };
  };
  const [p2, p5] = await Promise.all([
    loadLevelPackage('p2', fetcher, ''),
    loadLevelPackage('p5', fetcher, '')
  ]);
  assert.equal(p2.map.id, p5.map.id);
  assert.deepEqual(p2.map, p5.map);
  assert.equal(p2.content.words.length, 460);
  assert.equal(p5.content.words.length, 327);
  assert.deepEqual(p2.config.regionLessons.r1, [1, 2, 3]);
  assert.deepEqual(p5.config.regionLessons.r1, [1, 2, 3]);
});
