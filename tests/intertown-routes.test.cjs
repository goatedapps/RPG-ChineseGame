const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(url.replace(/^\//, ''), 'utf8')) });

test('all six inter-town battlefields are distinct, reachable and tied to their regional lessons', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { isWalkable, validateMap } = await import('../src/world/map.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const names = new Set();
  const layouts = new Set();
  for (const level of ['p2', 'p5']) {
    const game = await loadLevelPackage(level, fetcher, '');
    for (let number = 1; number <= 6; number += 1) {
      const regionId = `r${number}`;
      const campaign = game.campaigns[regionId];
      const map = campaign.route;
      assert.ok(map.width * map.height >= 44 * 32 * 1.9, `${map.name} has roughly twice the exploration area`);
      assert.equal(campaign.map.safeTown, true);
      assert.equal(isEncounterTerrain(campaign.map, campaign.map.zones[0].rect.x + 1, campaign.map.zones[0].rect.y + 1), false);
      assert.deepEqual(validateMap(map), [], map.name);
      assert.equal(map.zones.length, 3);
      assert.deepEqual(map.zones.map(zone => zone.lesson), [0, 1, 2].map(slot => game.config.regionLessons[regionId][slot] ?? game.config.regionLessons[regionId].at(-1)));
      if (level === 'p5') { names.add(map.name); layouts.add(map.tiles.join('')); }
      const seen = new Set([`${map.spawn.x},${map.spawn.y}`]);
      const queue = [map.spawn];
      for (let index = 0; index < queue.length; index += 1) {
        const { x, y } = queue[index];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const next = { x: x + dx, y: y + dy };
          const key = `${next.x},${next.y}`;
          if (!seen.has(key) && isWalkable(map, next.x, next.y)) { seen.add(key); queue.push(next); }
        }
      }
      const walkable = map.tiles.reduce((count, row, y) => count + [...row].filter((_, x) => isWalkable(map, x, y)).length, 0);
      assert.equal(seen.size, walkable, `${map.name} has inaccessible terrain`);
      for (const id of ['boss-pavilion-door', 'next-region-gate', 'return-village']) {
        const object = map.objects.find(item => item.id === id);
        assert.ok(object, `${map.name}: ${id}`);
        assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${object.x + dx},${object.y + dy}`)), `${map.name}: ${id} cannot be approached`);
      }
      assert.ok(map.objects.find(item => item.id === 'next-region-gate').x > map.width * .75);
    }
  }
  assert.equal(names.size, 6);
  assert.equal(layouts.size, 6);
});

test('route fog, gate opening and village return positions survive a save migration', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { isWalkable } = await import('../src/world/map.js');
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { routeKey } = await import('../src/systems/regions.js');
  const game = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(game);
  state.player.map = game.campaigns.r1.route.id;
  state.player.x = 8;
  state.player.y = 9;
  for (let number = 1; number <= 6; number += 1) {
    state.progress.routes[routeKey(`r${number}`)] = { discovered: [11, 12, 12], gateOpened: true, position: { x: 8, y: 9 }, villagePosition: { x: 12, y: 10 } };
  }
  const migrated = migrateState({ ...state, schemaVersion: 9 }, game);
  for (let number = 1; number <= 6; number += 1) {
    const route = migrated.progress.routes[routeKey(`r${number}`)];
    assert.ok(route.discovered.length > 2);
    assert.ok(route.discovered.every(mark => mark >= 0 && mark < game.campaigns[`r${number}`].route.width * game.campaigns[`r${number}`].route.height));
    assert.equal(route.mapVersion, 2);
    assert.equal(route.gateOpened, true);
    assert.ok(route.position.x > 8 && route.position.y > 9);
    assert.deepEqual(route.villagePosition, { x: 12, y: 10 });
  }
  assert.ok(isWalkable(game.campaigns.r1.route, migrated.player.x, migrated.player.y));
  const savedAgain = migrateState(migrated, game);
  assert.deepEqual(savedAgain.progress.routes, migrated.progress.routes);
  assert.deepEqual(savedAgain.player, migrated.player);
});

test('town gates lead to roads while their bosses are only challenged at road pavilions', async () => {
  const { loadLevelPackage, activateRegion } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { createAdventure } = await import('../src/adventure.js');
  const { enterRegion } = await import('../src/systems/regions.js');
  const game = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(game);
  const dom = new JSDOM('<div id="overlay"></div>');
  const oldDocument = global.document;
  global.document = dom.window.document;
  try {
    const root = dom.window.document.querySelector('#overlay');
    const calls = [];
    let active = { levelPackage: game, state };
    const overlay = { open: html => { root.innerHTML = html; }, dialogue: data => { calls.push(data.title); } };
    const adventure = createAdventure({ overlay, getActive: () => active, persist: () => {}, render: () => {}, toast: () => {}, gameplay: {}, onEnterRoute: direction => calls.push(direction), onSwitchRegion: id => calls.push(id) });
    for (let number = 2; number <= 6; number += 1) {
      const regionId = `r${number}`;
      active = { levelPackage: activateRegion(game, regionId), state };
      enterRegion(state, active.levelPackage);
      const bossDoor = active.levelPackage.map.objects.find(object => object.interaction?.kind === 'boss');
      assert.equal(adventure.handleInteraction(bossDoor), true);
      assert.equal(calls.at(-1), active.levelPackage.route.name);
      adventure.handleInteraction({ id: 'next-region-gate' });
      assert.equal(calls.at(-1), 'enter');
      adventure.handleInteraction({ id: 'return-gate' });
      assert.equal(calls.at(-1), 'back');
      active.levelPackage.map = active.levelPackage.route;
      adventure.handleInteraction({ id: 'return-village' });
      assert.equal(calls.at(-1), 'leave');
      adventure.handleInteraction({ id: 'next-region-gate' });
      assert.match(root.textContent, /Defeat the|dictation/);
      assert.notEqual(calls.at(-1), `r${number + 1}`);
    }
  } finally {
    global.document = oldDocument;
  }
});

test('each onward gate plays its opening scene only on first crossing', async () => {
  const { loadLevelPackage, activateRegion } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { createAdventure } = await import('../src/adventure.js');
  const game = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(game);
  const levelPackage = activateRegion(game, 'r2');
  levelPackage.map = levelPackage.route;
  state.progress.story.bossDefeated = true;
  state.progress.story.flags.gateDictationPassed = true;
  state.progress.routes.r2r3 = { discovered: [], gateOpened: false };
  const dom = new JSDOM('<div id="overlay"></div>');
  const oldDocument = global.document;
  global.document = dom.window.document;
  let openings = 0;
  let travels = 0;
  try {
    const root = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { root.innerHTML = html; } };
    const adventure = createAdventure({ overlay, getActive: () => ({ levelPackage, state }), persist: () => {}, render: () => {}, toast: () => {}, gameplay: {}, onGateOpening: async () => { openings += 1; }, onSwitchRegion: () => { travels += 1; } });
    for (let crossing = 0; crossing < 2; crossing += 1) {
      adventure.handleInteraction({ id: 'next-region-gate' });
      root.querySelector('[data-travel-next]').click();
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(openings, 1);
    assert.equal(travels, 2);
    assert.equal(state.progress.routes.r2r3.gateOpened, true);
  } finally {
    global.document = oldDocument;
  }
});

test('clearing each later road naturally samples roughly two thirds of its regional spirits', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { isWalkable } = await import('../src/world/map.js');
  const { isEncounterTerrain, zoneAt } = await import('../src/world/encounters.js');
  const { revealRouteTile, routeDiscoveryPercent } = await import('../src/world/fog.js');
  for (const level of ['p2', 'p5']) {
    const game = await loadLevelPackage(level, fetcher, '');
    for (let number = 2; number <= 6; number += 1) {
      const regionId = `r${number}`;
      const map = game.campaigns[regionId].route;
      let player = map.spawn;
      let discovered = revealRouteTile(map, [], player.x, player.y);
      const stepsByLesson = new Map();
      while (routeDiscoveryPercent(map, discovered) < 99) {
        const known = new Set(discovered);
        const queue = [{ ...player, path: [] }];
        const visited = new Set([`${player.x},${player.y}`]);
        let target = null;
        for (let index = 0; index < queue.length && !target; index += 1) {
          const current = queue[index];
          if (!known.has(current.y * map.width + current.x)) { target = current; break; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = current.x + dx;
            const y = current.y + dy;
            const mark = `${x},${y}`;
            if (!visited.has(mark) && isWalkable(map, x, y)) { visited.add(mark); queue.push({ x, y, path: [...current.path, { x, y }] }); }
          }
        }
        assert.ok(target, `${map.name} cannot be fully explored`);
        for (const step of target.path) {
          player = step;
          discovered = revealRouteTile(map, discovered, step.x, step.y);
          if (isEncounterTerrain(map, step.x, step.y)) {
            const lesson = zoneAt(map, step.x, step.y).lesson;
            stepsByLesson.set(lesson, (stepsByLesson.get(lesson) || 0) + 1);
          }
        }
      }
      const lessons = game.config.regionLessons[regionId];
      const regionalWords = game.content.words.filter(word => lessons.includes(word.lesson));
      const expectedUnique = [...new Set(lessons)].reduce((total, lesson) => {
        const count = regionalWords.filter(word => word.lesson === lesson).length;
        const rate = map.zones[0].encounter.rate;
        const expectedBattles = (stepsByLesson.get(lesson) || 0) * rate / (1 + 2 * rate);
        return total + count * (1 - Math.pow(1 - 1 / count, expectedBattles));
      }, 0);
      const fraction = expectedUnique / regionalWords.length;
      assert.ok(fraction >= .60 && fraction <= .72, `${level} ${map.name}: ${Math.round(fraction * 100)}% expected spirits`);
    }
  }
});
