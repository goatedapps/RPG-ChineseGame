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

test('Treehouse Summit is safe and its final encounters are on a separate fog route', async () => {
  const { validateMap } = await import('../src/world/map.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const r1 = readJson('content/authored/campaign/maps/r1-hub.json');
  const r7 = readJson('content/authored/campaign/maps/r7-treehouse-summit.json');
  assert.deepEqual(validateMap(r7), []);
  assert.ok(r7.width * r7.height > r1.width * r1.height);
  for (const id of ['dictionary-tree', 'school-door', 'inn-door', 'hall-door', 'shop-door', 'route-entrance', 'tree-warden', 'return-gate', 'dictionary-heart', 'keeper-ming', 'builder-ru', 'gardener-shui', 'reader-lin']) {
    assert.ok(r7.objects.some(object => object.id === id), id);
  }
  assert.equal(r7.zones.length, 0);
  assert.equal(r7.objects.some(object => object.interaction?.kind === 'boss'), false);
  assert.equal(isEncounterTerrain(r7, r7.spawn.x, r7.spawn.y), false);
  const terminal = readJson('content/authored/campaign/routes.json').find(route => route.region === 'r7');
  assert.equal(terminal.terminal, true);
  assert.equal(terminal.gate.length, 2, 'older cached clients must still be able to unpack a gate coordinate');
});

test('P2 and P5 activate their own final lessons, sets and boss question pool', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue } = await import('../src/systems/story.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const { isWalkable, validateMap } = await import('../src/world/map.js');
  const { revealRouteTile } = await import('../src/world/fog.js');
  for (const [level, lessons] of [['p2', [18, 19]], ['p5', [16, 17]]]) {
    const base = await loadLevelPackage(level, fetcher, '');
    const r7 = activateRegion(base, 'r7');
    assert.equal(r7.map.id, 'r7-treehouse-summit');
    assert.equal(r7.map.safeTown, true);
    assert.equal(r7.map.atlasVillage, true);
    assert.equal(r7.map.zones.length, 0);
    assert.equal(r7.route.route, true);
    assert.equal(r7.route.name, 'Crown Veil Trail');
    assert.deepEqual(validateMap(r7.route), []);
    assert.ok(r7.route.width * r7.route.height >= 44 * 32 * 1.9);
    assert.equal(r7.route.objects.some(object => object.id === 'next-region-gate'), false);
    for (const id of ['return-village', 'boss-pavilion-door', 'boss-pavilion-building']) assert.ok(r7.route.objects.some(object => object.id === id), id);
    const seen = new Set([`${r7.route.spawn.x},${r7.route.spawn.y}`]);
    const queue = [r7.route.spawn];
    for (let index = 0; index < queue.length; index += 1) {
      const { x, y } = queue[index];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: x + dx, y: y + dy };
        const key = `${next.x},${next.y}`;
        if (!seen.has(key) && isWalkable(r7.route, next.x, next.y)) { seen.add(key); queue.push(next); }
      }
    }
    const walkable = r7.route.tiles.reduce((count, row, y) => count + [...row].filter((_, x) => isWalkable(r7.route, x, y)).length, 0);
    assert.equal(seen.size, walkable, `${level}: all Crown Veil paths must be reachable`);
    for (const id of ['return-village', 'boss-pavilion-door']) {
      const object = r7.route.objects.find(item => item.id === id);
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${object.x + dx},${object.y + dy}`)), `${level}: ${id} cannot be approached`);
    }
    const firstFog = revealRouteTile(r7.route, [], r7.route.spawn.x, r7.route.spawn.y);
    assert.ok(firstFog.length > 1 && firstFog.length < r7.route.width * r7.route.height / 3);
    const pavilion = r7.route.objects.find(item => item.id === 'boss-pavilion-building');
    assert.equal(firstFog.includes(pavilion.rect.y * r7.route.width + pavilion.rect.x), false);
    for (const zone of r7.route.zones) {
      const encounterTiles = [];
      for (let y = zone.rect.y; y < zone.rect.y + zone.rect.height; y += 1) {
        for (let x = zone.rect.x; x < zone.rect.x + zone.rect.width; x += 1) {
          if (isEncounterTerrain(r7.route, x, y)) encounterTiles.push([x, y]);
        }
      }
      assert.ok(encounterTiles.length >= 20, `${level} ${zone.name} needs playable encounters`);
    }
    assert.equal(isEncounterTerrain(r7.route, r7.route.spawn.x, r7.route.spawn.y), true);
    assert.ok(r7.route.zones.every(zone => lessons.includes(zone.lesson)));
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
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.webp`)).size > 10000, file);
  }
  for (const file of ['treeheart-lens', 'final-stroke']) assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.webp`)).size > 10000, file);
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  const hit = adventure.indexOf("audio?.setScene('victory')");
  const next = adventure.indexOf('data-boss-next>Next spell', hit);
  assert.ok(hit > -1 && next > hit);
  assert.match(adventure.slice(hit, next), /data-boss-victory>Continue the story/);
  assert.match(adventure.slice(hit, next), /return;/);
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /r7-treehouse-summit\.json/);
  assert.match(sw, /great-forgetter\.webp/);
  assert.match(sw, /final-stroke\.webp/);
});

test('final trail discoveries and position survive saving and reopening', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { routeKey } = await import('../src/systems/regions.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const summit = activateRegion(base, 'r7');
  const state = createFreshState(summit);
  const route = summit.route;
  const key = routeKey('r7');
  state.player.map = route.id;
  state.player.x = route.spawn.x;
  state.player.y = route.spawn.y;
  state.progress.routes[key] = {
    mapVersion: route.mapVersion,
    discovered: [route.spawn.y * route.width + route.spawn.x, (route.spawn.y - 1) * route.width + route.spawn.x],
    gateOpened: false,
    position: { x: route.spawn.x, y: route.spawn.y, direction: 'up' },
    villagePosition: { x: 24, y: 3, direction: 'up' }
  };
  const reopened = migrateState(JSON.parse(JSON.stringify(state)), summit);
  assert.equal(reopened.player.map, route.id);
  assert.deepEqual(reopened.progress.routes[key], state.progress.routes[key]);
});
