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

test('Festival City is a valid shared map with every P14 destination', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r5 = readJson('content/authored/campaign/maps/r5-festival-city.json');
  assert.deepEqual(validateMap(r5), []);
  assert.ok(r5.width * r5.height > r1.width * r1.height);
  for (const id of ['school-door', 'inn-door', 'hall-door', 'shop-door', 'harmony-dojo', 'dragon-gate-door', 'festival-workshop', 'return-gate', 'harmony-pavilion', 'mayor-shen', 'keeper-bao', 'artist-cai', 'gardener-ren', 'dragon-warden']) {
    assert.ok(r5.objects.some(object => object.id === id), id);
  }
});

test('P2 and P5 activate their own Festival City lessons, stories and sets', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  for (const [level, lessons] of [['p2', [13, 14, 15]], ['p5', [11, 12]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r5 = activateRegion(base, 'r5');
    assert.equal(r5.map.id, 'r5-festival-city');
    assert.deepEqual([...new Set(r5.regionStory.stories.map(story => story.lesson))], lessons);
    assert.ok(r5.map.zones.every(zone => lessons.includes(zone.lesson)));
    assert.equal(r5.sets.length, 3);
    const words = new Set(r5.content.words.map(word => word.w));
    assert.ok(r5.sets.flatMap(set => set.words).every(word => words.has(word)));
    assert.ok(Object.values(r5.regionStory.requests).every(request => lessons.includes(request.lesson)));
  }
});

test('Region 5 travel state remains isolated and Grudge Dragon scales above its creatures', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const r5 = activateRegion(base, 'r5');
  const state = createFreshState(base);
  saveCurrentRegion(state, 'r1');
  enterRegion(state, r5);
  state.progress.story.flags.arrival = true;
  state.player.x = 44;
  saveCurrentRegion(state, 'r5');
  enterRegion(state, activateRegion(base, 'r1'));
  enterRegion(state, r5);
  assert.equal(state.player.x, 44);
  assert.equal(state.progress.story.flags.arrival, true);
  const lessons = base.config.regionLessons.r5;
  const strongest = Math.max(...lessons.map(lesson => r5.balance.combat.lessonLevels[String(lesson)][1]));
  assert.equal(createBoss(r5.balance, lessons).level, strongest + 1);
});

test('P14 creature, boss and reward art are packaged for offline play', () => {
  for (const file of ['ribbon-rat', 'drum-gremlin', 'spark-kite', 'quarrel-macaque', 'boastful-lion', 'grudge-dragon']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.webp`)).size > 10000, file);
  }
  for (const file of ['festival-medallion', 'harmony-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.webp`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r5-festival-city\.json/);
  assert.match(serviceWorker, /grudge-dragon\.webp/);
  assert.match(serviceWorker, /harmony-stroke\.webp/);
  assert.match(serviceWorker, /festival-city-bg\.mp3/);
});
