const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { playableIds } = require('./support/levels.cjs');

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) });

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

test('a full Mistwood exploration samples roughly two thirds of regional spirits at normal encounter odds', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { isWalkable } = await import('../src/world/map.js');
  const { isEncounterTerrain, zoneAt } = await import('../src/world/encounters.js');
  const { revealRouteTile, routeDiscoveryPercent } = await import('../src/world/fog.js');
  const fetcher = async url => ({ ok: true, json: async () => read(url.replace(/^\//, '')) });
  for (const level of playableIds) {
    const game = await loadLevelPackage(level, fetcher, '');
    const map = game.campaigns.r1.route;
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
      assert.ok(target, 'every reachable tile should be discoverable');
      for (const step of target.path) {
        player = step;
        discovered = revealRouteTile(map, discovered, step.x, step.y);
        if (isEncounterTerrain(map, step.x, step.y)) {
          const lesson = zoneAt(map, step.x, step.y).lesson;
          stepsByLesson.set(lesson, (stepsByLesson.get(lesson) || 0) + 1);
        }
      }
    }
    const lessons = game.config.regionLessons.r1;
    const regionalWords = game.content.words.filter(word => lessons.includes(word.lesson));
    const expectedUnique = [...new Set(lessons)].reduce((total, lesson) => {
      const words = regionalWords.filter(word => word.lesson === lesson).length;
      const steps = stepsByLesson.get(lesson) || 0;
      const rate = map.zones.find(zone => zone.lesson === lesson).encounter.rate;
      const expectedBattles = steps * rate / (1 + 2 * rate);
      return total + words * (1 - Math.pow(1 - 1 / words, expectedBattles));
    }, 0);
    const fraction = expectedUnique / regionalWords.length;
    assert.ok(fraction >= .60 && fraction <= .72, `${level} route pacing: ${Math.round(fraction * 100)}%`);
  }
});

test('dictation selection limits school to regional lessons and scores the chosen length', async () => {
  const { dictationLessons, chooseDictationWords, chooseGuidedDictationWord, dictationResult } = await import('../src/systems/dictation.js');
  const content = read('content/generated/p5.content.json');
  const config = read('content/authored/levels/p5/level.json');
  const lessons = dictationLessons(content.words, config.regionLessons.r1);
  assert.deepEqual(lessons, config.regionLessons.r1);
  assert.ok(dictationLessons(content.words).length > lessons.length);
  assert.equal(chooseDictationWords(content.words, lessons[0], 5, () => .5).length, 5);
  assert.equal(chooseDictationWords(content.words, lessons[0], 10, () => .5).length, 10);
  assert.equal(chooseDictationWords(content.words, lessons[0], 'all', () => .5).length, content.words.filter(word => word.lesson === lessons[0]).length);
  assert.equal(Array.from(chooseGuidedDictationWord(content.words, lessons[0])[0].w).length, 1);
  assert.equal(dictationResult(4, 5).message, 'Good work!');
  assert.equal(dictationResult(3, 5).message, 'Practise more and try again.');
});

test('menu dictation opens a lesson booklet and requires selected words', async () => {
  const { JSDOM } = require('jsdom');
  const { createGameplay } = await import('../src/gameplay.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const pkg = await loadLevelPackage('p2', fetcher, '');
  const game = { levelPackage: pkg, state: createFreshState(pkg) };
  const dom = new JSDOM('<div id="overlay"></div>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const element = document.querySelector('#overlay');
    const overlay = { open(html) { element.innerHTML = html; } };
    const gameplay = createGameplay({ getActive: () => game, overlay, storage: { getItem() { return null; }, setItem() {} }, persist() {}, render() {}, toast() {} });
    gameplay.dictationPractice();
    assert.match(element.textContent, /Select any words/);
    element.querySelector('[data-dictation-lesson]').value = '2';
    element.querySelector('[name="dictation-count"][value="custom"]').checked = true;
    element.querySelector('[data-dictation-start]').click();
    assert.match(element.textContent, /Lesson 2 booklet/);
    assert.equal(element.querySelectorAll('[data-dictation-word]').length, pkg.content.words.filter(word => word.lesson === 2).length);
    const start = element.querySelector('[data-dictation-selected-start]');
    assert.equal(start.disabled, true);
    const first = element.querySelector('[data-dictation-word]');
    first.checked = true;
    first.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(start.disabled, false);
    assert.match(element.querySelector('.dictation-selection-status').textContent, /1 word selected/);
  } finally {
    global.document = previousDocument;
    dom.window.close();
  }
});

test('wrong villager feedback keeps the question, answer and passage available for review', async () => {
  const { passageReviewMarkup } = await import('../src/gameplay.js');
  const markup = passageReviewMarkup({ passage: { title: 'River Day', text: '小明看见一条河。' } }, { q: '小明看见什么？' }, '一条河');
  assert.match(markup, /open><summary>/);
  assert.match(markup, /小明看见什么？/);
  assert.match(markup, /小明看见一条河。/);
  assert.match(markup, /Answer:<\/b> 一条河/);
});
