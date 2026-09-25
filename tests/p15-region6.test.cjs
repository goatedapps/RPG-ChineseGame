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

test('Ancient Grove is a valid shared map with every P15 destination', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r6 = readJson('content/authored/campaign/maps/r6-ancient-grove.json');
  assert.deepEqual(validateMap(r6), []);
  assert.ok(r6.width * r6.height > r1.width * r1.height);
  for (const id of ['school-door', 'inn-door', 'hall-door', 'shop-door', 'excavation-lodge', 'ghost-archive-door', 'root-library', 'return-gate', 'memory-vault', 'curator-wen', 'researcher-mo', 'scribe-yu', 'arborist-he', 'memory-keeper']) {
    assert.ok(r6.objects.some(object => object.id === id), id);
  }
});

test('P2 and P5 activate their own Ancient Grove lessons, stories and sets', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  for (const [level, lessons] of [['p2', [16, 17]], ['p5', [13, 14, 15]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r6 = activateRegion(base, 'r6');
    assert.equal(r6.map.id, 'r6-ancient-grove');
    assert.deepEqual([...new Set(r6.regionStory.stories.map(story => story.lesson))], lessons);
    assert.ok(r6.map.zones.every(zone => lessons.includes(zone.lesson)));
    assert.equal(r6.sets.length, 3);
    const words = new Set(r6.content.words.map(word => word.w));
    assert.ok(r6.sets.flatMap(set => set.words).every(word => words.has(word)));
    assert.ok(Object.values(r6.regionStory.requests).every(request => lessons.includes(request.lesson)));
  }
});

test('Region 6 travel state remains isolated and Give-Up Ghost scales above its creatures', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const r6 = activateRegion(base, 'r6');
  const state = createFreshState(base);
  saveCurrentRegion(state, 'r1');
  enterRegion(state, r6);
  state.progress.story.flags.arrival = true;
  state.player.x = 44;
  saveCurrentRegion(state, 'r6');
  enterRegion(state, activateRegion(base, 'r1'));
  enterRegion(state, r6);
  assert.equal(state.player.x, 44);
  assert.equal(state.progress.story.flags.arrival, true);
  const lessons = base.config.regionLessons.r6;
  const strongest = Math.max(...lessons.map(lesson => r6.balance.combat.lessonLevels[String(lesson)][1]));
  assert.equal(createBoss(r6.balance, lessons).level, strongest + 1);
});

test('P15 creature, boss and reward art are packaged for offline play', () => {
  for (const file of ['glyph-beetle', 'bone-owl', 'ink-vine', 'relic-tortoise', 'whisper-moss', 'give-up-ghost']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.png`)).size > 10000, file);
  }
  for (const file of ['oracle-rubbing-kit', 'memory-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.png`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r6-ancient-grove\.json/);
  assert.match(serviceWorker, /give-up-ghost\.png/);
  assert.match(serviceWorker, /memory-stroke\.png/);
  assert.match(serviceWorker, /music-village\.wav/);
});
