const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fetcher = async url => {
  const file = path.join(root, url.replace(/^\//, '').replaceAll('/', path.sep));
  return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
};

test('Harvest Crossing is a larger valid shared map with all P11 destinations', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r2 = readJson('content/authored/campaign/maps/r2-harvest-crossing.json');
  assert.deepEqual(validateMap(r2), []);
  assert.ok(r2.width * r2.height > r1.width * r1.height);
  assert.deepEqual(r2.zones.map(zone => zone.lesson), [4, 5, 6]);
  for (const id of ['school-door', 'inn-door', 'hall-door', 'shop-door', 'return-gate', 'truth-terrace', 'hawker-lina', 'courier-wei', 'farmer-tan', 'gatekeeper']) {
    assert.ok(r2.objects.some(object => object.id === id), id);
  }
});

test('P2 and P5 activate curriculum-specific Harvest Crossing content', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  for (const level of ['p2', 'p5']) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r2 = activateRegion(base, 'r2');
    assert.equal(r2.map.id, 'r2-harvest-crossing');
    assert.deepEqual([...new Set(r2.regionStory.stories.map(story => story.lesson))], [4, 5, 6]);
    assert.ok(r2.regionStory.stories.every(story => story.pages.some(page => /[\u3400-\u9fff]/u.test(page))));
    assert.equal(r2.sets.length, 3);
    const words = new Set(r2.content.words.map(word => word.w));
    assert.ok(r2.sets.flatMap(set => set.words).every(word => words.has(word)));
  }
});

test('regional travel preserves separate story, reading, encounter and NPC state', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(base);
  state.player.x = 17;
  state.progress.story.flags.arrival = true;
  state.progress.reading.completed = ['r1-passage'];
  state.progress.npcs.guide = { x: 3, y: 4 };
  saveCurrentRegion(state, 'r1');
  enterRegion(state, activateRegion(base, 'r2'));
  assert.equal(state.player.map, 'r2-harvest-crossing');
  assert.deepEqual(state.progress.reading.completed, []);
  state.progress.story.flags.arrival = true;
  state.player.x = 30;
  saveCurrentRegion(state, 'r2');
  enterRegion(state, activateRegion(base, 'r1'));
  assert.equal(state.player.x, 17);
  assert.equal(state.progress.story.flags.arrival, true);
  assert.deepEqual(state.progress.reading.completed, ['r1-passage']);
});

test('Region 2 battle and reward art are packaged for offline play', () => {
  for (const file of ['chaff-sprite', 'rumour-crow', 'price-mimic', 'doubt-moth', 'forked-gecko', 'doubt-serpent']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.png`)).size > 10000, file);
  }
  for (const file of ['market-seal', 'truth-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.png`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r2-harvest-crossing\.json/);
  assert.match(serviceWorker, /doubt-serpent\.png/);
  assert.match(serviceWorker, /truth-stroke\.png/);
});
