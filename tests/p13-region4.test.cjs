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

test('Lantern Theatre is a valid shared map with every P13 destination', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r4 = readJson('content/authored/campaign/maps/r4-lantern-theatre.json');
  assert.deepEqual(validateMap(r4), []);
  assert.ok(r4.width * r4.height > r1.width * r1.height);
  for (const id of ['school-door', 'inn-door', 'hall-door', 'shop-door', 'theatre-door', 'mirror-stage-door', 'farmhouse-door', 'return-gate', 'courage-loft', 'director-luo', 'actor-min', 'farmer-qiao', 'gardener-su', 'mirror-keeper']) {
    assert.ok(r4.objects.some(object => object.id === id), id);
  }
});

test('P2 and P5 activate their own Lantern Theatre lessons, stories and sets', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  for (const [level, lessons] of [['p2', [10, 11, 12]], ['p5', [9, 10]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r4 = activateRegion(base, 'r4');
    assert.equal(r4.map.id, 'r4-lantern-theatre');
    assert.deepEqual([...new Set(r4.regionStory.stories.map(story => story.lesson))], lessons);
    assert.ok(r4.map.zones.every(zone => lessons.includes(zone.lesson)));
    assert.equal(r4.sets.length, 3);
    const words = new Set(r4.content.words.map(word => word.w));
    assert.ok(r4.sets.flatMap(set => set.words).every(word => words.has(word)));
    assert.ok(Object.values(r4.regionStory.requests).every(request => lessons.includes(request.lesson)));
  }
});

test('Region 4 travel state remains isolated and Mocking Mirror scales above its creatures', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const r4 = activateRegion(base, 'r4');
  const state = createFreshState(base);
  state.player.x = 14;
  saveCurrentRegion(state, 'r1');
  enterRegion(state, r4);
  state.progress.story.flags.arrival = true;
  state.player.x = 42;
  saveCurrentRegion(state, 'r4');
  enterRegion(state, activateRegion(base, 'r1'));
  enterRegion(state, r4);
  assert.equal(state.player.x, 42);
  assert.equal(state.progress.story.flags.arrival, true);
  const lessons = base.config.regionLessons.r4;
  const strongest = Math.max(...lessons.map(lesson => r4.balance.combat.lessonLevels[String(lesson)][1]));
  assert.equal(createBoss(r4.balance, lessons).level, strongest + 1);
});

test('P13 art and both supplied future-facing music tracks are packaged for offline play', () => {
  for (const file of ['mask-moth', 'heckle-magpie', 'straw-soldier', 'spotlight-fox', 'wilt-wisp', 'mocking-mirror']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.webp`)).size > 10000, file);
  }
  for (const file of ['lantern-stage-pass', 'courage-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.webp`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r4-lantern-theatre\.json/);
  assert.match(serviceWorker, /mocking-mirror\.webp/);
  assert.match(serviceWorker, /courage-stroke\.webp/);
  assert.match(serviceWorker, /lantern-theatre-bg\.mp3/);
  assert.match(serviceWorker, /festival-city-bg\.mp3/);
});
