const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const fetcher = async url => {
  const file = path.join(root, url.replace(/^\//, '').replaceAll('/', path.sep));
  return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => readJson(url.replace(/^\//, '')) };
};

test('Treehouse Summit map has all final destinations and encounter terrain', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r7 = readJson('content/authored/campaign/maps/r7-treehouse-summit.json');
  assert.deepEqual(validateMap(r7), []);
  assert.ok(r7.width * r7.height > r1.width * r1.height);
  for (const id of ['dictionary-tree', 'school-door', 'inn-door', 'hall-door', 'shop-door', 'final-seal-door', 'tree-warden', 'return-gate', 'dictionary-heart', 'keeper-ming', 'builder-ru', 'gardener-shui', 'reader-lin']) {
    assert.ok(r7.objects.some(object => object.id === id), id);
  }
  for (const zone of r7.zones) {
    let count = 0;
    for (let y = zone.rect.y; y < zone.rect.y + zone.rect.height; y += 1) {
      for (let x = zone.rect.x; x < zone.rect.x + zone.rect.width; x += 1) if (isEncounterTerrain(r7, x, y)) count += 1;
    }
    assert.ok(count >= 20, `${zone.id}: ${count} encounter tiles`);
  }
});

test('P2 and P5 activate their own final lessons, sets and boss question pool', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue } = await import('../src/systems/story.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  for (const [level, lessons] of [['p2', [18, 19]], ['p5', [16, 17]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r7 = activateRegion(base, 'r7');
    assert.equal(r7.map.id, 'r7-treehouse-summit');
    assert.ok(r7.map.zones.every(zone => lessons.includes(zone.lesson)));
    assert.ok(Object.values(r7.regionStory.requests).every(request => lessons.includes(request.lesson)));
    assert.deepEqual([...new Set(r7.regionStory.stories.map(story => story.lesson))], lessons);
    assert.equal(r7.sets.length, 3);
    const words = new Set(r7.content.words.filter(word => lessons.includes(word.lesson)).map(word => word.w));
    assert.ok(r7.sets.flatMap(set => set.words).every(word => words.has(word)));
    assert.ok(bossGateQueue(r7.content, r7.config, lessons).length > 0);
    const strongest = Math.max(...lessons.map(lesson => r7.balance.combat.lessonLevels[String(lesson)][1]));
    assert.equal(createBoss(r7.balance, lessons).level, strongest + 1);
  }
});

test('Final art is packaged offline and boss knockout bypasses Next spell', () => {
  for (const file of ['blank-page-wisp', 'eraser-moth', 'silence-raven', 'lost-name-fox', 'hollow-book-golem', 'great-forgetter']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.png`)).size > 10000, file);
  }
  for (const file of ['treeheart-lens', 'final-stroke']) assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.png`)).size > 10000, file);
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  const hit = adventure.indexOf("audio?.setScene('victory')");
  const next = adventure.indexOf('data-boss-next>Next spell', hit);
  assert.ok(hit > -1 && next > hit);
  assert.match(adventure.slice(hit, next), /data-boss-victory>Continue the story/);
  assert.match(adventure.slice(hit, next), /return;/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /r7-treehouse-summit\.json/);
  assert.match(sw, /great-forgetter\.png/);
  assert.match(sw, /final-stroke\.png/);
});
