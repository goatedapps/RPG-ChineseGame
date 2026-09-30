const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(url.replace(/^\//, ''), 'utf8')) });

test('Tidewater dictation awards a clue at two of three and the rescue gates travel', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { createOverlay } = await import('../src/ui/overlay.js');
  const { createAdventure } = await import('../src/adventure.js');
  const game = activateRegion(await loadLevelPackage('p5', fetcher, ''), 'r3');
  const state = createFreshState(game);
  state.progress.story.flags.arrival = true;
  const lesson = game.regionStory.requests['fisher-yu'].lesson;
  for (const word of game.content.words.filter(candidate => candidate.lesson === lesson).slice(0, 3)) {
    state.progress.words[word.w] = { collected: true };
  }
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const oldWindow = global.window;
  const oldDocument = global.document;
  const oldMatchMedia = global.matchMedia;
  global.window = dom.window;
  global.document = dom.window.document;
  global.matchMedia = () => ({ matches: true });
  dom.window.setTimeout = callback => callback();
  let strokes = 0;
  dom.window.HanziWriter = { create: () => ({
    quiz({ onCorrectStroke, onComplete }) {
      if (strokes++ === 0) onCorrectStroke({ mistakesOnStroke: 4 });
      onComplete();
    },
    cancelQuiz() {},
    animateCharacter({ onComplete }) { onComplete(); }
  }) };
  try {
    const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
    const active = { levelPackage: game, state };
    const adventure = createAdventure({ overlay, getActive: () => active, persist: () => {}, render: () => {}, toast: () => {}, gameplay: { battlesLeft: () => 30 }, audio: { sfx() {}, setScene() {} } });
    adventure.storyJournal();
    assert.doesNotMatch(dom.window.document.querySelector('.rescue-journal').textContent, /dictation|from memory|2\/3/i);
    adventure.gatekeeper();
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Collect Word Spirits.*Fisher Yu/);
    adventure.handleInteraction({ id: 'fisher-yu' });
    dom.window.document.querySelector('[data-tide-test]').click();
    for (let index = 0; index < 3; index += 1) {
      assert.ok(dom.window.document.querySelector('[data-tide-next]'));
      dom.window.document.querySelector('[data-tide-next]').click();
    }
    assert.match(dom.window.document.querySelector('#overlay').textContent, /2\/3/);
    assert.equal(state.progress.story.flags.tideClues['fisher-yu'], true);
    assert.equal(state.progress.accuracy.w.total, 3);
    state.progress.story.flags.tideClues['maker-chen'] = true;
    state.progress.story.flags.tideClues['watcher-an'] = true;
    state.progress.inventory.keyItems.push('harbour-chronometer');
    for (const word of game.content.words.filter(candidate => game.config.regionLessons.r3.includes(candidate.lesson))) {
      state.progress.words[word.w] = { ...state.progress.words[word.w], collected: true };
    }
    adventure.gatekeeper();
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Bring the three clues/);
    adventure.handleInteraction({ id: 'keeper-lan' });
    for (let index = 0; index < 2; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.tideEvidenceCompared, true);
    adventure.gatekeeper();
    assert.match(dom.window.document.querySelector('#overlay').textContent, /The gate is open/);
    state.progress.story.bossDefeated = true;
    game.map = game.campaigns.r3.route;
    adventure.handleInteraction({ id: 'next-region-gate' });
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Whale Rescue Dock/);
    game.map = game.campaigns.r3.map;
    adventure.handleInteraction({ id: 'rescue-dock' });
    for (let index = 0; index < 4; index += 1) dom.window.document.querySelector('[data-scene-next]').click();
    assert.equal(state.progress.story.flags.tideWhaleRescued, true);
    assert.ok(dom.window.document.querySelector('img[src="assets/images/story/tidewater-whale-rescue.webp"]'));
    game.map = game.campaigns.r3.route;
    adventure.handleInteraction({ id: 'next-region-gate' });
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Defeat the Idle Clock|Pass a 15-word dictation|The gate is open/);
  } finally {
    global.window = oldWindow;
    global.document = oldDocument;
    global.matchMedia = oldMatchMedia;
    dom.window.close();
  }
});
