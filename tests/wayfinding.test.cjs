const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(url.replace(/^\//, ''), 'utf8')) });

test('next-step pin points toward the current lesson, reading key, and boss without locking exploration', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { nextStep } = await import('../src/systems/wayfinding.js');
  const { gateStatus } = await import('../src/systems/story.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(base);
  const first = nextStep(base, state);
  assert.match(first.text, /Mistwood Road/);
  const entrance = base.map.objects.find(object => object.id === 'route-entrance');
  assert.deepEqual(first.target, { x: entrance.x, y: entrance.y });

  const route = { ...base, map: base.campaigns.r1.route };
  const exploring = nextStep(route, state);
  assert.match(exploring.text, /Mistwood Edge \(Lesson 1\)/);
  assert.ok(exploring.target);

  const lessons = new Set(base.config.regionLessons.r1);
  for (const word of base.content.words.filter(word => lessons.has(word.lesson))) state.progress.words[word.w] = { collected: true };
  assert.ok(gateStatus(base, state.progress, state.progress.inventory).bronze >= gateStatus(base, state.progress, state.progress.inventory).required);
  const reading = nextStep(base, state);
  assert.match(reading.text, /Reading Hall/);
  assert.equal(reading.target.x, base.map.objects.find(object => object.id === 'reading-hall').door.x);
  state.progress.inventory.keyItems.push(base.regionStory.readingKeyItem || 'cave-lantern');
  const boss = nextStep(route, state);
  assert.match(boss.text, /boss|pavilion/i);
  assert.ok(boss.target);
});

test('final summit guidance sends the child to its encounter glades', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { nextStep } = await import('../src/systems/wayfinding.js');
  const { isEncounterTerrain } = await import('../src/world/encounters.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const summit = activateRegion(base, 'r7');
  const state = createFreshState(summit);
  const step = nextStep(summit, state);
  assert.match(step.text, /Ascent Glade|Whisper Branches|Crown Garden/);
  assert.ok(isEncounterTerrain(summit.map, step.target.x, step.target.y));
});

test('small map names the current route lesson and omits obsolete town lesson labels', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { drawGuideMap } = await import('../src/ui/guideMap.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(base);
  const drawnLabels = [];
  const context = { fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, fillText(text) { drawnLabels.push(text); } };
  const canvas = { getContext: () => context, setAttribute() {} };
  drawGuideMap(canvas, base.map, state, { target: base.map.spawn });
  assert.deepEqual(drawnLabels, []);
  const route = base.campaigns.r1.route;
  const target = route.zones[0].rect;
  state.player.x = target.x + 1;
  state.player.y = target.y + 1;
  const current = drawGuideMap(canvas, route, state, { target: route.spawn });
  assert.equal(current.name, route.zones[0].name);
  assert.equal(current.lesson, route.zones[0].lesson);
  assert.ok(drawnLabels.includes(`L${current.lesson}`));
});
