const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));

test('Mistwood Road is a separate reachable battlefield with a hidden pavilion and eastern gate', async () => {
  const { isWalkable, validateMap } = await import('../src/world/map.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const village = read('content/authored/campaign/maps/r1-hub.json');
  const route = read('content/authored/campaign/maps/r1-r2-mistwood.json');
  village.safeTown = true;
  assert.deepEqual(validateMap(route), []);
  assert.equal(isEncounterTerrain(village, 6, 6), false);
  assert.equal(route.zones.length, 3);
  const reachable = new Set([`${route.spawn.x},${route.spawn.y}`]);
  const queue = [route.spawn];
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: x + dx, y: y + dy };
      const mark = `${next.x},${next.y}`;
      if (!reachable.has(mark) && isWalkable(route, next.x, next.y)) { reachable.add(mark); queue.push(next); }
    }
  }
  const beside = object => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable.has(`${object.x + dx},${object.y + dy}`));
  assert.ok(beside(route.objects.find(object => object.id === 'boss-pavilion-door')));
  assert.ok(beside(route.objects.find(object => object.id === 'next-region-gate')));
  assert.ok(route.objects.find(object => object.id === 'next-region-gate').x > route.width * .75);
  assert.ok(reachable.size > 500);
});

test('exploring one tile reveals adjoining whole blocked areas but not distant paths', async () => {
  const { revealRouteTile, routeDiscoveryPercent } = await import('../src/world/fog.js');
  const map = read('content/authored/campaign/maps/r1-r2-mistwood.json');
  const first = revealRouteTile(map, [], map.spawn.x, map.spawn.y);
  assert.ok(first.includes(map.spawn.y * map.width + map.spawn.x));
  assert.ok(!first.includes(5 * map.width + 39));
  const besideTrees = revealRouteTile(map, first, 5, 8);
  assert.ok(besideTrees.length > first.length + 1);
  assert.ok(routeDiscoveryPercent(map, besideTrees) < 5);
});

test('a full Mistwood exploration yields about thirty percent of regional spirits at normal encounter odds', async () => {
  const { isWalkable } = await import('../src/world/map.js');
  const { revealRouteTile, routeDiscoveryPercent } = await import('../src/world/fog.js');
  const map = read('content/authored/campaign/maps/r1-r2-mistwood.json');
  let player = map.spawn;
  let discovered = revealRouteTile(map, [], player.x, player.y);
  const stepsByZone = [0, 0, 0];
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
    assert.ok(target, 'every reachable tile should be discoverable');
    for (const step of target.path) {
      player = step;
      discovered = revealRouteTile(map, discovered, step.x, step.y);
      stepsByZone[Math.min(2, Math.floor((step.x - 1) / 15))] += 1;
    }
  }
  for (const level of ['p2', 'p5']) {
    const content = read(`content/generated/${level}.content.json`);
    const config = read(`content/authored/levels/${level}/level.json`);
    const rate = config.tuning.routeEncounterRate ?? map.zones[0].encounter.rate;
    const expectedUnique = stepsByZone.reduce((total, steps, slot) => {
      const words = content.words.filter(word => word.lesson === config.regionLessons.r1[slot]).length;
      const expectedBattles = steps * rate / (1 + 2 * rate);
      return total + words * (1 - Math.pow(1 - 1 / words, expectedBattles));
    }, 0);
    const regionalTotal = content.words.filter(word => config.regionLessons.r1.includes(word.lesson)).length;
    assert.ok(expectedUnique / regionalTotal >= .25 && expectedUnique / regionalTotal <= .37, `${level} route pacing: ${Math.round(expectedUnique / regionalTotal * 100)}%`);
  }
});

test('dictation selection limits school to regional lessons and scores the chosen length', async () => {
  const { dictationLessons, chooseDictationWords, dictationResult } = await import('../src/systems/dictation.js');
  const content = read('content/generated/p5.content.json');
  const config = read('content/authored/levels/p5/level.json');
  const lessons = dictationLessons(content.words, config.regionLessons.r1);
  assert.deepEqual(lessons, config.regionLessons.r1);
  assert.ok(dictationLessons(content.words).length > lessons.length);
  assert.equal(chooseDictationWords(content.words, lessons[0], 5, () => .5).length, 5);
  assert.equal(chooseDictationWords(content.words, lessons[0], 10, () => .5).length, 10);
  assert.equal(chooseDictationWords(content.words, lessons[0], 'all', () => .5).length, content.words.filter(word => word.lesson === lessons[0]).length);
  assert.equal(dictationResult(4, 5).message, 'Good work!');
  assert.equal(dictationResult(3, 5).message, 'Practise more and try again.');
});

test('wrong villager feedback keeps the question, answer and passage available for review', async () => {
  const { passageReviewMarkup } = await import('../src/gameplay.js');
  const markup = passageReviewMarkup({ passage: { title: 'River Day', text: '小明看见一条河。' } }, { q: '小明看见什么？' }, '一条河');
  assert.match(markup, /open><summary>/);
  assert.match(markup, /小明看见什么？/);
  assert.match(markup, /小明看见一条河。/);
  assert.match(markup, /Answer:<\/b> 一条河/);
});
