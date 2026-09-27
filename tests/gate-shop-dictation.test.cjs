const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('boss thresholds, gate dictation defaults and half-rate battle XP are authored', () => {
  for (let number = 1; number <= 7; number += 1) assert.equal(read(`content/authored/campaign/r${number}-story.json`).gateBronzePct, 0.8);
  assert.equal(read('content/authored/shared/balance.json').combat.battleXp, 12);
  assert.equal(read('content/authored/levels/p2/level.json').tuning.balance.combat.battleXp, 10.5);
  const adventure = fs.readFileSync('src/adventure.js', 'utf8');
  assert.match(adventure, /You need <b>\$\{gate\.required\} Word Spirits<\/b>/);
  assert.doesNotMatch(adventure, /Silver or better:|requiredPct \* 100/);
});

test('gate test selects collected regional words, validates parent rules and persists a pass', async () => {
  const { chooseGateDictationWords, gateDictationPool, gateDictationRules } = await import('../src/systems/dictation.js');
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  assert.deepEqual(gateDictationRules({}), { count: 15, pass: 13 });
  assert.deepEqual(gateDictationRules({ gateDictationCount: 10, gateDictationPass: 8 }), { count: 10, pass: 8 });
  assert.deepEqual(gateDictationRules({ gateDictationCount: 10, gateDictationPass: 20 }), { count: 10, pass: 10 });
  const words = Array.from({ length: 20 }, (_, index) => ({ w: `字${index}` }));
  const progress = Object.fromEntries(words.slice(0, 16).map(word => [word.w, { collected: true }]));
  assert.equal(gateDictationPool(words, progress).length, 16);
  const chosen = chooseGateDictationWords(words, progress, 15, () => 0.5);
  assert.equal(chosen.length, 15);
  assert.ok(chosen.every(word => progress[word.w]?.collected));
  const levelPackage = { id: 'p5', content: { contentVersion: 'test' }, map: { id: 'r1-hub', spawn: { x: 20, y: 14 } } };
  const fresh = createFreshState(levelPackage);
  assert.equal(fresh.settings.gateDictationCount, 15);
  assert.equal(fresh.settings.gateDictationPass, 13);
  const migrated = migrateState({ ...fresh, schemaVersion: 8, player: { ...fresh.player, coins: 20 }, progress: { ...fresh.progress, inventory: { 'lucky-knot': 2 } }, settings: { gateDictationCount: 10, gateDictationPass: 20 } }, levelPackage);
  assert.equal(migrated.settings.gateDictationPass, 10);
  assert.equal(migrated.player.coins, 120);
  assert.equal(migrated.progress.inventory['lucky-knot'], undefined);
  const parentPanel = fs.readFileSync('src/gameplay.js', 'utf8');
  assert.match(parentPanel, /data-gate-dictation-count/);
  assert.match(parentPanel, /data-gate-dictation-pass/);
  assert.match(parentPanel, /data-gate-dictation-save/);
  fresh.progress.story.flags.gateDictationPassed = true;
  saveCurrentRegion(fresh, 'r1');
  enterRegion(fresh, { region: { id: 'r1' }, map: levelPackage.map });
  assert.equal(fresh.progress.story.flags.gateDictationPassed, true);
});

test('Scholar Lantern filters mastered spirits for exactly forty forest steps', async () => {
  const { encounterStep } = await import('../src/world/encounters.js');
  const { eligibleBattleWords } = await import('../src/learning/selection.js');
  const items = read('content/authored/shared/items.json');
  const lantern = items.find(item => item.id === 'scholars-lantern');
  assert.deepEqual([lantern.price, lantern.amount, lantern.effect], [40, 40, 'repel-mastered']);
  assert.equal(items.some(item => item.id === 'lucky-knot'), false);
  const map = read('content/authored/campaign/maps/r1-hub.json');
  const step = encounterStep({ cooldown: 0, zone: null, scholarsLanternSteps: 1 }, map, { x: 2, y: 2 }, () => 0);
  assert.equal(step.scholarsLanternActive, true);
  assert.equal(step.state.scholarsLanternSteps, 0);
  const villageStep = encounterStep({ ...step.state, scholarsLanternSteps: 3 }, map, { x: 20, y: 14 }, () => 0);
  assert.equal(villageStep.state.scholarsLanternSteps, 3);
  const words = [{ w: '甲' }, { w: '乙' }, { w: '丙' }];
  const progress = { 甲: { collected: true, ticks: { m: 1, p: 1, h: 1 } }, 乙: { collected: true, ticks: { m: 1 } } };
  assert.deepEqual(eligibleBattleWords(words, progress, true).map(word => word.w), ['乙', '丙']);
  assert.equal(eligibleBattleWords(words, progress, false).length, 3);
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  assert.match(gameplay, /const BAIT_PRICE = 10/);
  assert.match(gameplay, /lanterns\.map\(itemCard\)/);
  assert.match(gameplay, /bait-word \$\{collected \? 'collected' : 'missing'\}/);
});

test('memory writing reveals only completed characters and can exit mid-dictation', async () => {
  const { showWritingTask } = await import('../src/ui/writingView.js');
  const dom = new JSDOM('<div id="overlay"></div>');
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = dom.window.document;
  global.window = dom.window;
  let completeStroke;
  let cancelled = false;
  let exited = false;
  dom.window.setTimeout = callback => callback();
  dom.window.HanziWriter = { create: () => ({ quiz: options => { completeStroke = options.onComplete; }, cancelQuiz: () => { cancelled = true; } }) };
  try {
    const root = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { root.innerHTML = html; } };
    showWritingTask(overlay, { w: '帮助', m: 'help', p: 'bāng zhù', ex: '谢谢你的帮助。' }, {}, {}, () => {}, { forceMemory: true, onExit: () => { exited = true; } });
    assert.deepEqual([...root.querySelectorAll('.writing-slots span')].map(slot => slot.textContent), ['✎', '']);
    completeStroke();
    assert.deepEqual([...root.querySelectorAll('.writing-slots span')].map(slot => slot.textContent), ['帮', '✎']);
    root.querySelector('[data-writing-exit]').click();
    assert.equal(cancelled, true);
    assert.equal(exited, true);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
});

test('passing the gate test unlocks travel without requiring Silver spirits', async () => {
  const { createAdventure } = await import('../src/adventure.js');
  const { createOverlay } = await import('../src/ui/overlay.js');
  const { createFreshState } = await import('../src/core/state.js');
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = dom.window.document;
  global.window = dom.window;
  let completeStroke;
  let destination = null;
  dom.window.setTimeout = callback => callback();
  dom.window.HanziWriter = { create: () => ({ quiz: options => { completeStroke = options.onComplete; }, cancelQuiz: () => {} }) };
  try {
    const word = { w: '帮', lesson: 1, m: 'help', p: 'bāng', ex: '请帮我。' };
    const map = { id: 'r1-hub', spawn: { x: 20, y: 14 } };
    const levelPackage = { id: 'p5', content: { contentVersion: 'test', words: [word] }, map, region: { id: 'r1', name: 'Scholar Village' }, campaigns: { r2: { region: { id: 'r2', name: 'Harvest Crossing' } } }, config: { regionLessons: { r1: [1] } }, regionStory: { bossName: 'Muddle King', fragmentName: 'Dawn Stroke' }, characters: { characters: {} } };
    const state = createFreshState(levelPackage);
    state.progress.story.bossDefeated = true;
    state.progress.words[word.w] = { collected: true };
    state.settings.gateDictationCount = 1;
    state.settings.gateDictationPass = 1;
    const root = dom.window.document.querySelector('#overlay');
    const overlay = createOverlay(root);
    const adventure = createAdventure({ overlay, getActive: () => ({ levelPackage, state }), persist: () => {}, render: () => {}, toast: () => {}, gameplay: {}, onSwitchRegion: id => { destination = id; } });
    assert.equal(adventure.handleInteraction({ id: 'next-region-gate' }), true);
    assert.match(root.textContent, /1-word dictation/);
    root.querySelector('[data-gate-test]').click();
    assert.equal(state.progress.story.flags.gateDictationPassed, undefined);
    completeStroke();
    assert.equal(state.progress.story.flags.gateDictationPassed, true);
    root.querySelector('[data-travel-next]').click();
    assert.equal(destination, 'r2');
    assert.equal(state.settings.unlockedRegions, 2);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
  }
});

test('shared question feedback places Continue beneath the answer in all MCQ modes', () => {
  const styles = fs.readFileSync('css/stage.css', 'utf8');
  const question = fs.readFileSync('src/ui/questionView.js', 'utf8');
  assert.match(styles, /\.answer-feedback \{ display: flex; flex-direction: column;/);
  assert.match(styles, /\.answer-feedback > \[data-question-next\] \{ align-self: flex-end;[^}]*margin-top: 12px/);
  assert.match(question, /<button class="primary" data-question-next type="button">Continue<\/button>/);
});
