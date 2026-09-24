const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

async function loadPackage(level) {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const fetcher = async url => {
    const file = path.join(root, url.replace(/^\//, '').replaceAll('/', path.sep));
    return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  };
  return loadLevelPackage(level, fetcher, '');
}

test('P2 is playable with younger tuning and curriculum-specific Region 1 story data', async () => {
  const levels = readJson('content/authored/shared/levels.json');
  const p2Level = levels.find(level => level.id === 'p2');
  assert.equal(p2Level.worldMappingReady, true);
  assert.equal(p2Level.modularPreviewReady, true);
  const p2 = await loadPackage('p2');
  const p5 = await loadPackage('p5');
  assert.equal(p2.config.ready, true);
  assert.equal(p2.config.region1.tutorialWord, '帮助');
  assert.ok(p2.content.words.some(word => word.w === p2.config.region1.tutorialWord && word.lesson === 1));
  assert.equal(p2.regionStory.stories[0].title, '谁折得最美？');
  assert.match(p2.regionStory.stories[0].pages[0], /今年，我读二年级了/);
  assert.equal(p2.regionStory.stories[0].pages.length, 6);
  assert.ok(p2.balance.combat.lessonLevels['2'][0] < p5.balance.combat.lessonLevels['2'][0]);
  assert.equal(p2.balance.school.questionsPerQuiz, 4);
});

test('P2 story requests and boss use only words and required question kinds available to P2', async () => {
  const { bossGateQueue, requestReady } = await import('../src/systems/story.js');
  const p2 = await loadPackage('p2');
  const bindings = p2.config.region1.requests;
  const silver = { collected: true, ticks: { m: 2, p: 2, h: 2, u: 0, w: 0 } };
  const progress = { words: { 外: { collected: true }, 帮助: { collected: true }, 专心: silver, 读: silver, 听: silver, 碗: silver, 盘: silver } };
  const story = { flags: { treasureFound: true }, counters: { creatures: { 'twin-shade': 3, 'ink-imp': 2 }, writing: { 年级: 1 }, tingxieLesson3: 3 } };
  for (const id of ['xiaoqiang', 'mr-lin', 'chef-mei']) for (let step = 0; step < 3; step += 1) assert.equal(requestReady(id, step, progress, story, bindings), true);
  const queue = bossGateQueue(p2.content, p2.config);
  assert.deepEqual([...new Set(queue.map(task => task.phase))], ['Chain Spell', 'Scramble Spell', 'Ink Spell', 'Muddle Scroll']);
  const enabled = new Set(p2.config.coreQuestionKinds);
  assert.ok(queue.filter(task => task.item).every(task => enabled.has(task.item.kind)));
});

test('P2 and P5 saves remain isolated when the active curriculum changes', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelState, saveLevelState, saveProfile, saveKey } = await import('../src/core/save.js');
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const p2 = await loadPackage('p2');
  const p5 = await loadPackage('p5');
  const p2State = createFreshState(p2); p2State.player.coins = 42;
  const p5State = createFreshState(p5); p5State.player.coins = 99;
  saveLevelState(storage, p2State); saveProfile(storage, 'p2');
  saveLevelState(storage, p5State); saveProfile(storage, 'p5');
  assert.notEqual(values.get(saveKey('p2')), values.get(saveKey('p5')));
  assert.equal(loadLevelState(storage, p2).state.player.coins, 42);
  assert.equal(loadLevelState(storage, p5).state.player.coins, 99);
});

test('corrupt active saves restore the last known-good backup and future saves are preserved', async () => {
  const { createFreshState, SAVE_SCHEMA_VERSION } = await import('../src/core/state.js');
  const { backupKey, encodeSave, loadLevelState, recoveryKey, saveKey, saveLevelState } = await import('../src/core/save.js');
  const levelPackage = await loadPackage('p2');
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const state = createFreshState(levelPackage);
  state.player.coins = 41;
  saveLevelState(storage, state);
  state.player.coins = 82;
  saveLevelState(storage, state);
  assert.ok(values.get(backupKey('p2')));
  values.set(saveKey('p2'), 'truncated-save');
  const recovered = loadLevelState(storage, levelPackage);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.player.coins, 41);
  assert.equal(values.get(recoveryKey('p2')), 'truncated-save');

  const future = { ...state, schemaVersion: SAVE_SCHEMA_VERSION + 1 };
  values.set(saveKey('p2'), encodeSave(future));
  values.delete(backupKey('p2'));
  const blocked = loadLevelState(storage, levelPackage);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.warning, /newer than this game supports/);
  assert.equal(values.get(recoveryKey('p2')), values.get(saveKey('p2')));
});

test('tablet shell exposes accessibility landmarks and an offline application cache', () => {
  const html = fs.readFileSync(path.join(root, 'game/index.html'), 'utf8');
  const dom = new JSDOM(html);
  assert.ok(dom.window.document.querySelector('.skip-link[href="#game-stage"]'));
  assert.equal(dom.window.document.querySelector('#objective-text').parentElement.getAttribute('aria-live'), 'polite');
  assert.equal(dom.window.document.querySelector('#save-status').getAttribute('role'), 'status');
  assert.ok(dom.window.document.querySelector('link[rel="manifest"]'));
  assert.ok(dom.window.document.querySelector('#hud-xp-bar'));
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const asset of [...serviceWorker.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]).filter(asset => asset !== 'game/')) {
    assert.equal(fs.existsSync(path.join(root, asset)), true, asset);
  }
  assert.match(serviceWorker, /self\.clients\.claim/);
  assert.doesNotMatch(serviceWorker, /ignoreSearch: true/);
});

test('tablet fixes hide unavailable help actions and memory-writing answers', () => {
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  const writing = fs.readFileSync(path.join(root, 'src/ui/writingView.js'), 'utf8');
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/stage.css'), 'utf8');
  assert.match(adventure, /ready \? `<button class="primary" data-request-complete/);
  assert.match(writing, /memoryTask[\s\S]*dictation-clue/);
  assert.match(gameplay, /if \(skill === 'h'\) question\.prompt = battle\.word\.m/);
  assert.match(gameplay, /data-higher-chinese/);
  assert.match(gameplay, /Give a Spirit card/);
  assert.match(gameplay, /accuracyLabel\(skill\)/);
  assert.match(css, /-webkit-tap-highlight-color: transparent/);
  assert.match(css, /\.pin-settings/);
});

test('battle presentation keeps the spirit sealed and questions reveal details only after an answer', async () => {
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/stage.css'), 'utf8');
  assert.match(gameplay, /class="battle-enemy/);
  assert.match(gameplay, /creatureSvg\(battle\.creature\.id, '？'\)/);
  assert.doesNotMatch(gameplay, /escapeHtml\(battle\.word\.(?:p|m)\)/);
  assert.match(gameplay, /showQuestion\(overlay, question, null/);
  assert.match(gameplay, /revealWord: battle\.word/);
  assert.match(css, /\.battle-enemy \{ position: absolute; top: 8px; right: 14px/);

  const dom = new JSDOM('<div id="overlay"></div>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const { showQuestion } = await import('../src/ui/questionView.js');
    const rootElement = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { rootElement.innerHTML = html; } };
    const word = { w: '帮助', p: 'bāng zhù', m: 'To help', ex: '谢谢你帮助我。' };
    const question = { prompt: '帮助', instruction: 'What does this word mean?', options: ['To help', 'Outside'], correct: 'To help' };
    showQuestion(overlay, question, null, () => {}, { revealWord: word });
    assert.equal(rootElement.querySelector('.question-word'), null);
    assert.doesNotMatch(rootElement.textContent, /bāng zhù/);
    rootElement.querySelector('[data-answer="0"]').click();
    assert.match(rootElement.textContent, /bāng zhù/);
  } finally {
    global.document = previousDocument;
  }
});
