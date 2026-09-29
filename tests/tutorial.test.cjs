const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('the guided battle uses Jun pop-ups, a Rice Ball cue, and returns to the village', () => {
  const gameplay = fs.readFileSync(path.join(__dirname, '../src/gameplay.js'), 'utf8');
  assert.match(gameplay, /guidedBattlePrompt\(\['This Fogling has a Word Spirit trapped inside/);
  assert.match(gameplay, /guidedBattlePrompt\(\['The creature grazed you/);
  assert.match(gameplay, /guidedBattlePrompt\(\['This is your battle Bag/);
  assert.match(gameplay, /guidedBattlePrompt\(\['Good! The Rice Ball restored your HP/);
  assert.match(gameplay, /if \(battle\.guided\) return onReturnToVillage\('leave'\)/);
  assert.doesNotMatch(gameplay, /Answer an attack correctly to help this Spirit learn that skill/);
});

function freshGame() {
  return {
    state: {
      player: { level: 1, coins: 20 },
      progress: {
        tutorial: { step: 1, villagers: [], heroSeen: false, repellentBought: false, baitBought: false, allowanceGiven: false },
        story: { flags: { arrival: true } },
        words: {},
        partners: []
      }
    },
    levelPackage: { map: { objects: [{ id: 'apprentice-jun', x: 6, y: 9 }, { id: 'shop-door', x: 10, y: 9 }] }, sets: [], content: { words: [] } }
  };
}

function fakeOverlay() {
  const dialogues = [];
  return { isOpen: false, dialogues, tutorialDialogue(lines, done) { dialogues.push({ lines, done }); } };
}

test('fresh saves start Jun once and a current tutorial step survives migration', async () => {
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const levelPackage = { id: 'p5', content: { contentVersion: 'test' }, map: { id: 'r1-hub', spawn: { x: 20, y: 14 } } };
  const fresh = createFreshState(levelPackage);
  assert.equal(fresh.progress.tutorial.step, 1);
  const resumed = migrateState({ ...fresh, progress: { ...fresh.progress, tutorial: { ...fresh.progress.tutorial, step: 9, boardSeen: true } } }, levelPackage);
  assert.equal(resumed.progress.tutorial.step, 9);
  assert.equal(resumed.progress.tutorial.boardSeen, true);
});

test('the child guide has six first-day gates and resumes its second part only at level three', async () => {
  const { createTutorial } = await import('../src/tutorial.js');
  const dom = new JSDOM('<body><aside id="tutorial-guide" hidden></aside></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  const overlay = fakeOverlay();
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay });
  try {
    guide.show();
    assert.equal(overlay.dialogues.length, 0);
    for (let index = 0; index < 5; index += 1) guide.action('moved');
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /Welcome to Scholar Village/);
    overlay.dialogues.at(-1).done();
    game.state.progress.tutorial.introStage = 'map-talk';
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /map at the top right/);
    overlay.dialogues.at(-1).done();
    game.state.progress.tutorial.introStage = 'shop-talk';
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /Rice Ball/);
    overlay.dialogues.at(-1).done();
    assert.equal(game.state.progress.tutorial.step, 2);
    assert.equal(game.state.player.coins, 30);
    guide.action('buy-item', { id: 'rice-ball' });
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /Good, you bought a Rice Ball/);
    overlay.dialogues.at(-1).done();
    guide.action('interact', { id: 'xiaoqiang', kind: 'npc' });
    assert.equal(game.state.progress.tutorial.step, 3);
    guide.action('interact', { id: 'mr-lin', kind: 'npc' });
    guide.action('school-quiz');
    game.state.progress.words['词'] = { collected: true, ticks: { m: 1 } };
    guide.action('battle-win', { collected: true, word: '词' });
    guide.action('open-book');
    assert.equal(game.state.progress.tutorial.step, 6);
    guide.action('open-word-card', { word: '词' });
    assert.equal(game.state.progress.tutorial.step, 7);
    assert.equal(guide.current(), null);
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /tell you more when you reach level 3/);
    overlay.dialogues.at(-1).done();
    game.state.player.level = 3;
    assert.equal(guide.current(), 7);
    game.state.progress.words['词'] = { collected: true, ticks: { m: 1, p: 1, h: 1 } };
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /Welcome back/);
    overlay.dialogues.at(-1).done();
    guide.action('open-book');
    guide.action('tier-acknowledged');
    assert.equal(game.state.progress.tutorial.step, 8);
  } finally {
    guide.destroy();
    global.document = previousDocument;
  }
});

test('Jun conversations use the green typed dialogue and one short line at a time', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
  let finished = 0;
  try {
    overlay.tutorialDialogue(['First, look at Next step.', 'Now look at the map.'], () => { finished += 1; });
    assert.equal(dom.window.document.querySelector('.tutorial-dialog-card .speaker').textContent, 'Apprentice Jun');
    assert.equal(dom.window.document.querySelector('[data-type-dialogue]').getAttribute('aria-label'), 'First, look at Next step.');
    dom.window.document.querySelector('[data-dialogue-next]').click();
    assert.equal(dom.window.document.querySelector('[data-type-dialogue]').textContent, 'First, look at Next step.');
    dom.window.document.querySelector('[data-dialogue-next]').click();
    assert.equal(dom.window.document.querySelector('[data-type-dialogue]').getAttribute('aria-label'), 'Now look at the map.');
    dom.window.document.querySelector('[data-dialogue-next]').click();
    dom.window.document.querySelector('[data-dialogue-next]').click();
    assert.equal(finished, 1);
    assert.equal(overlay.isOpen, false);
  } finally {
    overlay.close();
    global.document = previousDocument;
  }
});

test('active guide gates unrelated story interactions but allows its target and the route home', async () => {
  const { createTutorial } = await import('../src/tutorial.js');
  const dom = new JSDOM('<body><aside id="tutorial-guide" hidden></aside></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay: fakeOverlay() });
  try {
    assert.equal(guide.allowsStoryInteraction({ id: 'storyteller', type: 'npc' }), false);
    assert.equal(guide.allowsStoryInteraction({ id: 'apprentice-jun', type: 'npc' }), true);
    game.state.progress.tutorial.step = 3;
    assert.equal(guide.allowsStoryInteraction({ id: 'xiaoqiang', type: 'npc' }), true);
    game.state.progress.tutorial.step = 5;
    assert.equal(guide.allowsStoryInteraction({ id: 'route-entrance', type: 'gate' }), true);
    assert.equal(guide.allowsStoryInteraction({ id: 'return-village', type: 'gate' }), true);
    assert.equal(guide.allowsStoryInteraction({ id: 'boss-pavilion-door', type: 'gate' }), false);
  } finally {
    guide.destroy();
    global.document = previousDocument;
  }
});

test('the later guide requires the Restoration explanation, menu visits, and both shop purchases', async () => {
  const { createTutorial } = await import('../src/tutorial.js');
  const dom = new JSDOM('<body><aside id="tutorial-guide" hidden></aside></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.player.level = 3;
  game.state.progress.tutorial.step = 8;
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay: fakeOverlay() });
  try {
    game.state.progress.partners.push('word-1');
    guide.action('partners-saved');
    guide.action('open-board');
    assert.equal(game.state.progress.tutorial.step, 9);
    guide.action('board-acknowledged');
    guide.action('open-journal');
    guide.action('open-daily');
    guide.action('open-bag');
    guide.action('open-craft');
    assert.equal(game.state.progress.tutorial.step, 13);
    guide.action('open-hero');
    guide.action('open-craft');
    guide.action('dictation-word');
    guide.action('buy-item', { id: 'forest-repellent' });
    assert.equal(game.state.progress.tutorial.step, 15);
    guide.action('buy-bait');
    assert.equal(game.state.progress.tutorial.step, 16);
    guide.action('buy-bait');
    assert.equal(game.state.progress.tutorial.step, 16);
  } finally {
    guide.destroy();
    global.document = previousDocument;
  }
});

test('only the parent control can end an incomplete guide without rewards', async () => {
  const { createTutorial } = await import('../src/tutorial.js');
  const dom = new JSDOM('<body><aside id="tutorial-guide" hidden></aside></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay: fakeOverlay() });
  try {
    assert.equal(guide.skipByParent(), true);
    assert.equal(game.state.progress.tutorial.step, 16);
    assert.equal(game.state.progress.tutorial.skipped, true);
    assert.equal(game.state.player.coins, 20);
    assert.equal(guide.skipByParent(), false);
  } finally {
    guide.destroy();
    global.document = previousDocument;
  }
});
