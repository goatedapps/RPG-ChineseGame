const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8')) });

test('chapter dictations use mapped lessons and reserve separate P5 Lesson 10 words', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { chapterDictationWords, chapterGroupComplete, chapterTask, completeChapterTask } = await import('../src/systems/chapterQuests.js');
  for (const level of require('./support/levels.cjs').playableIds) {
    const game = await loadLevelPackage(level, fetcher, '');
    const state = createFreshState(game);
    const gardener = chapterTask(game, 'r4', 'gardener-su');
    const expected = game.config.regionLessons.r4.at(-1);
    assert.equal(gardener.lesson, expected);
    const farmer = chapterTask(game, 'r4', 'farmer-qiao');
    if (gardener.lesson === farmer.lesson) {
      if (level === 'p5') assert.equal(gardener.lesson, 10);
      assert.equal(gardener.requiredCollected, 6);
      for (const word of game.content.words.filter(word => word.lesson === gardener.lesson).slice(0, 6)) state.progress.words[word.w] = { collected: true };
      const farmerWords = chapterDictationWords(game, state.progress, 'r4', 'farmer-qiao', () => 0);
      const gardenerWords = chapterDictationWords(game, state.progress, 'r4', 'gardener-su', () => 0);
      assert.equal(farmerWords.length, 3);
      assert.equal(gardenerWords.length, 3);
      assert.ok(gardenerWords.every(word => !farmerWords.includes(word)));
    } else assert.notEqual(gardener.lesson, farmer.lesson);
    const arborist = chapterTask(game, 'r6', 'arborist-he');
    assert.equal(arborist.lesson, game.config.regionLessons.r6.at(-1));
    const chapter = game.campaigns.r6.regionStory.chapter;
    assert.equal(completeChapterTask(state.progress.story, chapter, 'researcher-mo', 1), state.progress.story);
    let story = state.progress.story;
    for (const id of Object.keys(chapter.tasks)) story = completeChapterTask(story, chapter, id, 2);
    assert.equal(chapterGroupComplete(story, chapter, 'evidence'), true);
  }
});

test('Lantern and Grove chapter scenes gate the boss and onward road', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { createOverlay } = await import('../src/ui/overlay.js');
  const { createAdventure } = await import('../src/adventure.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const { chapterTask } = await import('../src/systems/chapterQuests.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const game = activateRegion(base, 'r4');
  const state = createFreshState(game);
  state.progress.story.flags.arrival = true;
  for (const word of game.content.words) state.progress.words[word.w] = { collected: true };
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const oldWindow = global.window;
  const oldDocument = global.document;
  const oldMatchMedia = global.matchMedia;
  global.window = dom.window;
  global.document = dom.window.document;
  global.matchMedia = () => ({ matches: true });
  dom.window.setTimeout = callback => callback();
  dom.window.HanziWriter = { create: () => ({ quiz({ onComplete }) { onComplete(); }, cancelQuiz() {}, animateCharacter({ onComplete }) { onComplete(); } }) };
  try {
    const active = { levelPackage: game, state };
    const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
    const adventure = createAdventure({ overlay, getActive: () => active, persist() {}, render() {}, toast() {}, gameplay: { battlesLeft: () => 30 }, audio: { sfx() {}, setScene() {} } });
    adventure.storyJournal();
    assert.doesNotMatch(dom.window.document.querySelector('.rescue-journal').textContent, /dictation|from memory|2\/3/i);
    const testTask = id => {
      adventure.handleInteraction({ id });
      assert.ok(dom.window.document.querySelector('[data-chapter-test]'), id);
      dom.window.document.querySelector('[data-chapter-test]').click();
      for (let index = 0; index < 3; index += 1) dom.window.document.querySelector('[data-chapter-next]').click();
      assert.match(dom.window.document.querySelector('#overlay').textContent, /Memory recovered/);
    };
    const move = id => {
      saveCurrentRegion(state, active.levelPackage.region.id);
      active.levelPackage = activateRegion(base, id);
      enterRegion(state, active.levelPackage);
      state.progress.story.flags.arrival = true;
    };
    adventure.gatekeeper();
    assert.match(dom.window.document.querySelector('#overlay').textContent, /three stage cues/);
    for (const id of ['actor-min', 'farmer-qiao', 'gardener-su']) testTask(id);
    move('r3');
    testTask('keeper-lan');
    move('r2');
    testTask('elder-sun');
    move('r1');
    testTask('grandma-wang');
    move('r4');
    state.progress.inventory.keyItems.push('lantern-stage-pass');
    adventure.handleInteraction({ id: 'director-luo' });
    for (let index = 0; index < 3; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.lanternRehearsed, true);
    assert.ok(dom.window.document.querySelector('img[src="assets/images/story/lantern-rehearsal.webp"]'));
    state.progress.story.bossDefeated = true;
    active.levelPackage.map = active.levelPackage.campaigns.r4.route;
    adventure.handleInteraction({ id: 'next-region-gate' });
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Lantern Theatre first/);
    active.levelPackage.map = active.levelPackage.campaigns.r4.map;
    adventure.handleInteraction({ id: 'theatre-door' });
    for (let index = 0; index < 2; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.lanternPerformed, true);
    assert.ok(dom.window.document.querySelector('img[src="assets/images/story/lantern-performance.webp"]'));

    move('r6');
    adventure.storyJournal();
    assert.doesNotMatch(dom.window.document.querySelector('.rescue-journal').textContent, /dictation|from memory|2\/3/i);
    for (const id of ['researcher-mo', 'scribe-yu', 'arborist-he']) testTask(id);
    state.progress.inventory.keyItems.push('oracle-rubbing-kit');
    adventure.handleInteraction({ id: 'curator-wen' });
    for (const id of ['researcher-mo', 'scribe-yu', 'arborist-he']) dom.window.document.querySelector(`[data-grove-evidence="${id}"]`).click();
    dom.window.document.querySelector('[data-grove-choice="clean"]').click();
    assert.match(dom.window.document.querySelector('.chapter-evidence-feedback').textContent, /try another way/);
    dom.window.document.querySelector('[data-grove-choice="complete"]').click();
    for (let index = 0; index < 4; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.groveAccountCompared, true);
    assert.ok(dom.window.document.querySelector('img[src="assets/images/story/grove-evidence.webp"]'));
    state.progress.story.bossDefeated = true;
    active.levelPackage.map = active.levelPackage.campaigns.r6.route;
    adventure.handleInteraction({ id: 'next-region-gate' });
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Excavation Lodge/);
    active.levelPackage.map = active.levelPackage.campaigns.r6.map;
    adventure.handleInteraction({ id: 'excavation-lodge' });
    for (let index = 0; index < 2; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.groveDisplayed, true);
    assert.ok(dom.window.document.querySelector('img[src="assets/images/story/grove-account.webp"]'));

    const old = { ...state, schemaVersion: 12, player: { ...state.player, map: 'r6-ancient-grove' }, progress: { ...state.progress, story: { ...state.progress.story, flags: {}, bossDefeated: true } } };
    const migrated = migrateState(old, base);
    assert.equal(migrated.progress.story.flags.groveDisplayed, true);
  } finally {
    global.window = oldWindow;
    global.document = oldDocument;
    global.matchMedia = oldMatchMedia;
    dom.window.close();
  }
});

test('chapter art is compact and cached for offline play', () => {
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const name of ['lantern-rehearsal', 'lantern-performance', 'grove-evidence', 'grove-account']) {
    const file = path.join(root, 'assets/images/story', `${name}.webp`);
    assert.ok(fs.statSync(file).size < 180000, name);
    assert.match(serviceWorker, new RegExp(`${name}\\.webp`));
  }
});

test('schema 12 saves keep route positions and grandfather completed chapters', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const old = createFreshState(base);
  old.schemaVersion = 12;
  old.player.map = base.campaigns.r4.route.id;
  old.player.x = 42;
  old.player.y = 25;
  old.progress.story = { ...old.progress.story, bossDefeated: true };
  old.progress.regions.r6 = { story: { bossDefeated: true, flags: {} } };
  const migrated = migrateState(old, base);
  assert.deepEqual([migrated.player.x, migrated.player.y], [42, 25]);
  assert.equal(migrated.progress.story.flags.lanternPerformed, true);
  assert.equal(migrated.progress.regions.r6.story.flags.groveDisplayed, true);
});

test('the P5 Lantern walkthrough names Lesson 10 for Gardener Su', async () => {
  const dom = new JSDOM('<body data-region="r4"><div id="guide-root"></div></body>', { url: 'http://localhost/walkthrough/walkthrough-region-4.html?level=p5' });
  const oldDocument = global.document;
  const oldLocation = global.location;
  const oldFetch = global.fetch;
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.fetch = async url => {
    const file = path.resolve(root, 'walkthrough', url);
    return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  };
  try {
    await import(`../walkthrough/walkthrough.js?lantern-label=${Date.now()}`);
    for (let attempt = 0; attempt < 20 && !dom.window.document.querySelector('#lantern-story'); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
    const text = dom.window.document.querySelector('#lantern-story')?.textContent || '';
    assert.match(text, /Gardener Su · the lantern cue: collect three Lesson 10 words/);
    assert.doesNotMatch(text, /undefined/);
  } finally {
    global.document = oldDocument;
    global.location = oldLocation;
    global.fetch = oldFetch;
    dom.window.close();
  }
});

test('the return revision route points east after the Scholar Village memory', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { nextStep } = await import('../src/systems/wayfinding.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const game = activateRegion(base, 'r2');
  game.map = game.campaigns.r2.route;
  const state = createFreshState(game);
  state.progress.regions.r4 = { story: { bossDefeated: false, flags: { chapterTasks: { 'actor-min': true, 'farmer-qiao': true, 'gardener-su': true, 'memory-r3': true, 'memory-r2': true, 'memory-r1': true } } } };
  const gate = game.map.objects.find(object => object.id === 'next-region-gate');
  assert.deepEqual(nextStep(game, state).target, { x: gate.x, y: gate.y });
});

test('Lantern next step names the westward quest without study instructions', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { nextStep } = await import('../src/systems/wayfinding.js');
  const game = activateRegion(await loadLevelPackage('p5', fetcher, ''), 'r4');
  const state = createFreshState(game);
  state.progress.story.flags.chapterTasks = { 'actor-min': true, 'farmer-qiao': true, 'gardener-su': true };
  const step = nextStep(game, state);
  assert.match(step.text, /west road.*Tidewater Bay.*Harvest Crossing.*Scholar Village/);
  assert.match(step.text, /Keeper Lan.*Elder Sun.*Grandma Wang/);
  assert.doesNotMatch(step.text, /revis|dictation|correct|memory practice/i);
});
