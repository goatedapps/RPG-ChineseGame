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
        inventory: { 'rice-ball': 1 },
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

test('closing a Shop or partner window leaves the next Jun dialogue intact', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const element = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(element);
  let pending = true;
  element.addEventListener('overlay:changed', () => {
    if (pending && !overlay.isOpen) {
      pending = false;
      overlay.tutorialDialogue(['Good, your action is complete.']);
    }
  });
  overlay.open('<div class="panel"><button data-close-overlay>Leave Shop</button></div>');
  element.querySelector('[data-close-overlay]').click();
  assert.equal(overlay.isOpen, true);
  assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /Good, your action is complete/);
  assert.equal(element.querySelector('.tutorial-dialog-card .speaker').textContent, 'Apprentice Jun');
  overlay.close();
  global.document = previousDocument;
});

test('pointer-restored menu focus cannot masquerade as a tutorial highlight', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<body><button id="dictation-button">Dictation</button><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const opener = dom.window.document.querySelector('#dictation-button');
  const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
  try {
    opener.focus();
    opener.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    overlay.open('<div class="panel"><button data-close-overlay>Close</button></div>');
    dom.window.document.querySelector('[data-close-overlay]').dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    overlay.close();
    assert.equal(dom.window.document.activeElement, opener);
    assert.equal(opener.classList.contains('restored-pointer-focus'), true);
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    assert.equal(opener.classList.contains('restored-pointer-focus'), false);

    opener.focus();
    opener.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    overlay.open('<div class="panel"><button data-close-overlay>Close</button></div>');
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    overlay.close();
    assert.equal(opener.classList.contains('restored-pointer-focus'), true);
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    opener.focus();
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    overlay.open('<div class="panel"><button data-close-overlay>Close</button></div>');
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    overlay.close();
    assert.equal(opener.classList.contains('restored-pointer-focus'), false);
  } finally {
    overlay.close();
    global.document = previousDocument;
  }
});

test('villager and School results hand off to Jun after their windows close', async () => {
  const [{ createOverlay }, { createTutorial }] = await Promise.all([
    import('../src/ui/overlay.js'), import('../src/tutorial.js')
  ]);
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.progress.tutorial.step = 3;
  const element = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(element);
  let guide;
  guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => guide.show(), overlay });
  element.addEventListener('overlay:changed', () => guide.show());
  try {
    overlay.open('<div class="panel"><button data-close-overlay>Leave</button></div>');
    guide.action('interact', { id: 'mr-lin', kind: 'npc' });
    guide.action('interact', { id: 'storyteller', kind: 'npc' });
    element.querySelector('[data-close-overlay]').click();
    assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /You heard two neighbours/);
    for (let index = 0; index < 4; index += 1) element.querySelector('[data-dialogue-next]').click();
    assert.equal(overlay.isOpen, false);
    game.state.progress.tutorial.step = 4;
    game.state.progress.tutorial.pending = null;
    overlay.open('<div class="panel"><button data-close-overlay>Continue</button></div>');
    guide.action('school-quiz');
    overlay.open('<div class="panel"><button data-close-overlay>Continue</button></div>');
    element.querySelector('[data-close-overlay]').click();
    assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /Well done on your quiz/);
  } finally {
    guide.destroy();
    overlay.close();
    global.document = previousDocument;
  }
});

test('Jun recovers if another window replaces an unfinished conversation', async () => {
  const [{ createOverlay }, { createTutorial }] = await Promise.all([
    import('../src/ui/overlay.js'), import('../src/tutorial.js')
  ]);
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.progress.tutorial.step = 3;
  game.state.progress.tutorial.pending = 2;
  const element = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(element);
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay });
  element.addEventListener('overlay:changed', () => guide.show());
  try {
    guide.show();
    assert.match(element.textContent, /Apprentice Jun/);
    overlay.open('<div class="panel"><button data-close-overlay>Close</button></div>');
    await Promise.resolve();
    element.querySelector('[data-close-overlay]').click();
    assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /Good, you bought a Rice Ball/);
  } finally {
    guide.destroy();
    overlay.close();
    global.document = previousDocument;
  }
});

test('the tutorial arrow is a separate viewport pointer and the highlighted target blinks', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/atlas.css'), 'utf8');
  const tutorial = fs.readFileSync(path.join(__dirname, '../src/tutorial.js'), 'utf8');
  assert.match(css, /\.tutorial-pointer \{ position: fixed/);
  assert.match(css, /\.tutorial-arrow \{[^}]*animation: tutorial-target-pulse/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(tutorial, /arrowTarget = document\.querySelector\(selector\)/);
  assert.doesNotMatch(css, /content: '➜'/);
  assert.doesNotMatch(css, /data-tutorial-step="14"[^\n]*#dictation-button/);
  assert.match(css, /body:not\(\[data-tutorial-step\]\) \.tutorial-arrow \{ outline: none !important; animation: none; \}/);
  assert.match(css, /body:not\(\[data-tutorial-step\]\) \.tutorial-pointer \{ display: none; \}/);
  const base = fs.readFileSync(path.join(__dirname, '../css/base.css'), 'utf8');
  assert.match(base, /\.restored-pointer-focus:not\(\.tutorial-arrow\):focus-visible \{ outline: none; \}/);
  assert.doesNotMatch(base, /focus-visible \{ outline: 3px solid var\(--gold\)/);
});

test('the later shop lesson highlights only Forest Repellent, not the first Buy button', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/atlas.css'), 'utf8');
  const gameplay = fs.readFileSync(path.join(__dirname, '../src/gameplay.js'), 'utf8');
  const tutorial = fs.readFileSync(path.join(__dirname, '../src/tutorial.js'), 'utf8');
  assert.doesNotMatch(css, /body\[data-tutorial-step="2"\] \[data-buy="rice-ball"\]/);
  assert.match(gameplay, /<h1 tabindex="-1" data-shop-title>Supplies for the road<\/h1>/);
  assert.match(gameplay, /focusSelector: '\[data-shop-title\]'/);
  assert.match(tutorial, /15: tutorial\.repellentBought \? .* : '\[data-buy="forest-repellent"\]'/);
});

test('battle and question titles receive initial focus instead of a meaningless answer outline', async () => {
  const [{ createOverlay }, { showQuestion }] = await Promise.all([
    import('../src/ui/overlay.js'), import('../src/ui/questionView.js')
  ]);
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
  try {
    showQuestion(overlay, { prompt: 'Which answer?', instruction: 'Choose one.', options: ['A', 'B'], correct: 'B' }, null, () => {});
    assert.equal(dom.window.document.activeElement, dom.window.document.querySelector('[data-question-title]'));
    overlay.open('<div class="panel"><h2 tabindex="-1" data-battle-title>Your turn</h2><button data-attack>Attack</button></div>', { focusSelector: '[data-battle-title]' });
    assert.equal(dom.window.document.activeElement, dom.window.document.querySelector('[data-battle-title]'));
  } finally {
    overlay.close();
    global.document = previousDocument;
  }
});

test('menu teaching highlights Close and advances only after each panel closes', async () => {
  const [{ createOverlay }, { createTutorial }] = await Promise.all([
    import('../src/ui/overlay.js'), import('../src/tutorial.js')
  ]);
  const dom = new JSDOM('<body><div id="overlay" hidden></div><button id="story-button"></button><button id="daily-button"></button></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.progress.tutorial.step = 10;
  const element = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(element);
  let guide;
  guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => guide.show(), overlay });
  element.addEventListener('overlay:changed', () => guide.show());
  try {
    overlay.open('<div class="panel"><h1>Adventure Journal</h1><button data-close-overlay>Close</button></div>');
    guide.action('open-journal');
    assert.equal(game.state.progress.tutorial.step, 10);
    assert.match(guide.objective().text, /Close Adventure Journal/);
    assert.equal(element.querySelector('[data-close-overlay]').classList.contains('tutorial-arrow'), true);
    assert.equal(dom.window.document.querySelector('#daily-button').classList.contains('tutorial-arrow'), false);
    element.querySelector('[data-close-overlay]').click();
    assert.equal(game.state.progress.tutorial.step, 11);
    assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /Adventure helps you remember/);
  } finally {
    guide.destroy();
    overlay.close();
    global.document = previousDocument;
  }
});

test('finishing the guide clears every tutorial highlight even while Jun says goodbye', async () => {
  const { createTutorial } = await import('../src/tutorial.js');
  const dom = new JSDOM('<body data-tutorial-step="14"><button id="dictation-button" class="tutorial-arrow"></button><aside id="tutorial-guide" hidden></aside></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.progress.tutorial.step = 15;
  game.state.progress.tutorial.repellentBought = true;
  const overlay = fakeOverlay();
  let guide;
  guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => guide.show(), overlay });
  try {
    guide.action('buy-bait');
    assert.equal(game.state.progress.tutorial.step, 16);
    assert.equal(dom.window.document.body.hasAttribute('data-tutorial-step'), false);
    assert.equal(dom.window.document.querySelector('#dictation-button').classList.contains('tutorial-arrow'), false);
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /You’re prepared for the road/);
    overlay.dialogues.at(-1).done();
    assert.equal(game.state.progress.tutorial.pending, null);
    assert.equal(dom.window.document.querySelectorAll('.tutorial-arrow').length, 0);
  } finally {
    guide.destroy();
    global.document = previousDocument;
  }
});

test('choosing a Silver Partner saves the party and advances Jun’s guide', async () => {
  const [{ createOverlay }, { createTutorial }, { createCollection }] = await Promise.all([
    import('../src/ui/overlay.js'), import('../src/tutorial.js'), import('../src/collection.js')
  ]);
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const game = freshGame();
  game.state.player = { level: 3, hp: 24, maxHp: 24, coins: 20 };
  game.state.progress.tutorial.step = 8;
  game.state.progress.words['露营'] = { collected: true, ticks: { m: 1, p: 1, h: 1 } };
  game.state.progress.equipment = { owned: ['bamboo-brush'], equipped: { brush: 'bamboo-brush' } };
  game.state.progress.room = { trophies: [], decorations: [] };
  game.state.progress.milestones = [];
  game.state.progress.parent = { goal: null };
  game.levelPackage.milestones = [];
  game.levelPackage.content.words = [{ id: 'word-1', w: '露营', m: 'Camping' }, { id: 'word-2', w: '散步', m: 'Walk' }];
  game.levelPackage.gear = [];
  const overlayElement = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(overlayElement);
  let guide;
  const render = () => guide.show();
  guide = createTutorial({ getActive: () => game, persist: () => {}, render, overlay });
  overlayElement.addEventListener('overlay:changed', () => guide.show());
  const collection = createCollection({ overlay, getActive: () => game, persist: () => {}, render, toast: () => {}, onTutorialAction: (type, detail) => guide.action(type, detail), tutorialStep: () => guide.current() });
  try {
    collection.room();
    overlayElement.querySelector('[data-room-partners]').click();
    assert.equal(overlayElement.querySelectorAll('[data-partner]').length, 1);
    overlayElement.querySelector('[data-partner]').click();
    overlayElement.querySelector('[data-save-partners]').click();
    assert.deepEqual(game.state.progress.partners, ['word-1']);
    assert.equal(game.state.progress.tutorial.step, 9);
    assert.match(overlayElement.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /Your Partner can now travel beside you/);
  } finally {
    guide.destroy();
    overlay.close();
    global.document = previousDocument;
  }
});

test('Primary 2 can open Jun’s Restoration Board and continue the guide', async () => {
  const [{ loadLevelPackage }, { createFreshState }, { createOverlay }, { createTutorial }, { createCollection }] = await Promise.all([
    import('../src/content/loader.js'), import('../src/core/state.js'), import('../src/ui/overlay.js'), import('../src/tutorial.js'), import('../src/collection.js')
  ]);
  const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) });
  const levelPackage = await loadLevelPackage('p2', fetcher, '');
  const game = { levelPackage, state: createFreshState(levelPackage) };
  game.state.player.level = 3;
  game.state.progress.story.flags.arrival = true;
  game.state.progress.tutorial.step = 9;
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  const element = dom.window.document.querySelector('#overlay');
  const overlay = createOverlay(element);
  let guide;
  guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => guide.show(), overlay });
  element.addEventListener('overlay:changed', () => guide.show());
  const collection = createCollection({ overlay, getActive: () => game, persist: () => {}, render: () => guide.show(), toast: () => {}, onTutorialAction: type => guide.action(type), tutorialStep: () => guide.current() });
  try {
    collection.room();
    const button = element.querySelector('[data-board-open]');
    assert.ok(button);
    button.click();
    assert.match(element.querySelector('[data-type-dialogue]').getAttribute('aria-label'), /This first set is Working Together/);
    for (let index = 0; index < 4; index += 1) element.querySelector('[data-dialogue-next]').click();
    assert.match(element.textContent, /Restoration Board/);
    element.querySelector('[data-tutorial-board-done]').click();
    assert.equal(game.state.progress.tutorial.step, 10);
  } finally {
    guide.destroy();
    overlay.close();
    global.document = previousDocument;
  }
});

test('guided dictation can finish one demonstrated character without awarding a skill tick', async () => {
  const { showWritingTask } = await import('../src/ui/writingView.js');
  const dom = new JSDOM('<body><div id="overlay"></div></body>');
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = dom.window.document;
  global.window = dom.window;
  dom.window.HanziWriter = { create: () => ({ quiz() {}, cancelQuiz() {}, animateCharacter({ onComplete }) { onComplete(); } }) };
  const element = dom.window.document.querySelector('#overlay');
  const overlay = { open(html) { element.innerHTML = html; } };
  let outcome;
  try {
    showWritingTask(overlay, { w: '擦', m: 'Wipe', p: 'cā', ex: '他擦脸。' }, {}, {}, result => { outcome = result; }, {
      forceMemory: true,
      completeOnHelp: true,
      speech: { speak() {}, stop() {} }
    });
    element.querySelector('[data-writing-show]').click();
    await new Promise(resolve => setTimeout(resolve, 450));
    assert.equal(outcome.helped, true);
    assert.equal(outcome.earnsTick, false);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
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
    assert.match(guide.objective().text, /Go around the sign on the north path/);
    assert.equal(guide.allowsStoryInteraction({ id: 'tree-sign', type: 'sign' }), true);
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
  const overlay = fakeOverlay();
  const guide = createTutorial({ getActive: () => game, persist: () => {}, render: () => {}, overlay });
  try {
    game.state.progress.partners.push('word-1');
    guide.action('partners-saved');
    guide.action('open-board');
    assert.equal(game.state.progress.tutorial.step, 9);
    guide.action('board-acknowledged');
    guide.action('open-journal');
    guide.show();
    guide.action('open-daily');
    guide.show();
    guide.action('open-bag');
    guide.show();
    guide.action('open-craft');
    assert.equal(game.state.progress.tutorial.step, 13);
    guide.action('open-hero');
    guide.action('open-craft');
    guide.show();
    guide.action('dictation-word');
    guide.action('buy-item', { id: 'forest-repellent' });
    assert.equal(game.state.progress.tutorial.step, 15);
    guide.action('buy-bait');
    assert.equal(game.state.progress.tutorial.step, 16);
    guide.show();
    assert.match(overlay.dialogues.at(-1).lines.join(' '), /You’re prepared for the road/);
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
