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

test('Tidewater Bay is a valid larger shared map with all P12 destinations', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const r2 = readJson('content/authored/campaign/maps/r2-harvest-crossing.json');
  const r3 = readJson('content/authored/campaign/maps/r3-tidewater-bay.json');
  assert.deepEqual(validateMap(r3), []);
  assert.ok(r3.width * r3.height > r2.width * r2.height);
  for (const id of ['school-door', 'inn-door', 'hall-door', 'shop-door', 'return-gate', 'tide-vault', 'fisher-yu', 'maker-chen', 'watcher-an', 'clock-warden']) {
    assert.ok(r3.objects.some(object => object.id === id), id);
  }
});

test('P2 and P5 activate their own Tidewater lesson mappings, stories and sets', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  for (const [level, lessons] of [['p2', [7, 8, 9]], ['p5', [7, 8]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r3 = activateRegion(base, 'r3');
    assert.equal(r3.map.id, 'r3-tidewater-bay');
    assert.deepEqual([...new Set(r3.regionStory.stories.map(story => story.lesson))], lessons);
    assert.ok(r3.map.zones.every(zone => lessons.includes(zone.lesson)));
    assert.equal(r3.sets.length, 3);
    const words = new Set(r3.content.words.map(word => word.w));
    assert.ok(r3.sets.flatMap(set => set.words).every(word => words.has(word)));
    assert.ok(Object.values(r3.regionStory.requests).every(request => lessons.includes(request.lesson)));
  }
});

test('Region 3 travel state remains isolated and its boss scales above its creatures', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const r3 = activateRegion(base, 'r3');
  const state = createFreshState(base);
  state.player.x = 14;
  saveCurrentRegion(state, 'r1');
  enterRegion(state, r3);
  state.progress.story.flags.arrival = true;
  state.player.x = 40;
  saveCurrentRegion(state, 'r3');
  enterRegion(state, activateRegion(base, 'r1'));
  enterRegion(state, r3);
  assert.equal(state.player.x, 40);
  assert.equal(state.progress.story.flags.arrival, true);
  const lessons = base.config.regionLessons.r3;
  const strongest = Math.max(...lessons.map(lesson => r3.balance.combat.lessonLevels[String(lesson)][1]));
  assert.equal(createBoss(r3.balance, lessons).level, strongest + 1);
});

test('P12 creature, boss and reward art are packaged for offline play', () => {
  for (const file of ['tangle-crab', 'drift-jelly', 'rust-gull', 'minute-mite', 'tide-hare', 'idle-clock']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.png`)).size > 10000, file);
  }
  for (const file of ['harbour-chronometer', 'current-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.png`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r3-tidewater-bay\.json/);
  assert.match(serviceWorker, /idle-clock\.png/);
  assert.match(serviceWorker, /current-stroke\.png/);
  assert.match(serviceWorker, /tidewater-bg\.mp3/);
});
