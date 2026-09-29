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

test('both curricula can earn three Tidewater clues through three-word dictations', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { completeTidewaterClue, tidewaterClue, tidewaterCluesComplete, tidewaterDictationWords, tidewaterEvidenceReady } = await import('../src/systems/tidewaterRescue.js');
  for (const level of ['p2', 'p5']) {
    const game = activateRegion(await loadLevelPackage(level, fetcher, ''), 'r3');
    const state = createFreshState(game);
    let story = state.progress.story;
    const clueIds = Object.keys(game.regionStory.rescue.clues);
    assert.deepEqual(clueIds, ['fisher-yu', 'maker-chen', 'watcher-an']);
    for (const id of clueIds) {
      const clue = tidewaterClue(game, id);
      assert.ok(game.config.regionLessons.r3.includes(clue.lesson), `${level}: ${id} uses a regional lesson`);
      if (id === clueIds[0]) assert.equal(tidewaterDictationWords(game, state.progress, id).length, 0);
      const words = game.content.words.filter(word => word.lesson === clue.lesson).slice(0, clue.requiredCollected);
      assert.equal(words.length, clue.requiredCollected);
      for (const word of words) state.progress.words[word.w] = { collected: true };
      const testWords = tidewaterDictationWords(game, state.progress, id, () => 0);
      assert.equal(testWords.length, 3);
      assert.ok(testWords.every(word => word.lesson === clue.lesson));
      assert.equal(completeTidewaterClue(story, game.regionStory, id, 1), story);
      story = completeTidewaterClue(story, game.regionStory, id, 2);
      assert.equal(story.flags.tideClues[id], true);
    }
    assert.equal(tidewaterCluesComplete(story, game.regionStory), true);
    assert.equal(tidewaterEvidenceReady(story, game.regionStory, state.progress.inventory), false);
    state.progress.inventory.keyItems.push('harbour-chronometer');
    assert.equal(tidewaterEvidenceReady(story, game.regionStory, state.progress.inventory), true);
  }
});

test('Primary 5 reserves separate groups of Lesson 8 spirits for its two clue-givers', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { tidewaterClue, tidewaterDictationWords } = await import('../src/systems/tidewaterRescue.js');
  const game = activateRegion(await loadLevelPackage('p5', fetcher, ''), 'r3');
  const state = createFreshState(game);
  const lessonEight = game.content.words.filter(word => word.lesson === 8);
  for (const word of lessonEight.slice(0, 3)) state.progress.words[word.w] = { collected: true };
  assert.equal(tidewaterClue(game, 'maker-chen').requiredCollected, 3);
  assert.equal(tidewaterClue(game, 'watcher-an').requiredCollected, 6);
  const makerWords = tidewaterDictationWords(game, state.progress, 'maker-chen', () => 0);
  assert.equal(makerWords.length, 3);
  assert.equal(tidewaterDictationWords(game, state.progress, 'watcher-an', () => 0).length, 0);
  for (const word of lessonEight.slice(3, 6)) state.progress.words[word.w] = { collected: true };
  const watcherWords = tidewaterDictationWords(game, state.progress, 'watcher-an', () => 0);
  assert.equal(watcherWords.length, 3);
  assert.equal(watcherWords.some(word => makerWords.includes(word)), false);
});

test('Tidewater guidance follows clues, evidence, boss and whale rescue without resetting saved state', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { nextStep } = await import('../src/systems/wayfinding.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const game = activateRegion(base, 'r3');
  const state = createFreshState(game);
  enterRegion(state, game);
  const first = game.content.words.filter(word => word.lesson === game.config.regionLessons.r3[0]).slice(0, 3);
  for (const word of first) state.progress.words[word.w] = { collected: true };
  assert.match(nextStep(game, state).text, /Fisher Yu.*three-word dictation/);
  state.progress.story.flags.tideClues = { 'fisher-yu': true, 'maker-chen': true, 'watcher-an': true };
  assert.match(nextStep(game, state).text, /Tide Archive/);
  state.progress.inventory.keyItems.push('harbour-chronometer');
  assert.match(nextStep(game, state).text, /Keeper Lan/);
  state.progress.story.flags.tideEvidenceCompared = true;
  state.progress.story.bossDefeated = true;
  assert.match(nextStep(game, state).text, /Whale Rescue Dock/);
  saveCurrentRegion(state, 'r3');
  enterRegion(state, activateRegion(base, 'r1'));
  enterRegion(state, game);
  assert.equal(state.progress.story.flags.tideEvidenceCompared, true);
  state.progress.story.flags.tideWhaleRescued = true;
  assert.match(nextStep(game, state).text, /gate to Lantern Theatre/);
});

test('P12 creature, boss and reward art are packaged for offline play', () => {
  for (const file of ['tangle-crab', 'drift-jelly', 'rust-gull', 'minute-mite', 'tide-hare', 'idle-clock']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/creatures', `${file}.webp`)).size > 10000, file);
  }
  for (const file of ['harbour-chronometer', 'current-stroke']) {
    assert.ok(fs.statSync(path.join(root, 'assets/images/rewards', `${file}.webp`)).size > 10000, file);
  }
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /r3-tidewater-bay\.json/);
  assert.match(serviceWorker, /idle-clock\.webp/);
  assert.match(serviceWorker, /current-stroke\.webp/);
  assert.match(serviceWorker, /tidewater-bg\.mp3/);
  assert.match(serviceWorker, /tidewaterRescue\.js/);
  assert.match(serviceWorker, /tidewater-whale-rescue\.webp/);
  assert.ok(fs.statSync(path.join(root, 'assets/images/story/tidewater-whale-rescue.webp')).size < 180000);
});
