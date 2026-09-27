const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('high-level targets are dangerous without providing a fourfold XP shortcut', async () => {
  const { battleRewardAmounts, enemyAttack, heroDamage, relativeRewardMultiplier } = await import('../src/battle/battle.js');
  const { applyHealing } = await import('../src/systems/inventory.js');
  const { xpToNextLevel } = await import('../src/core/progression.js');
  const balance = { combat: { battleXp: 12, battleCoins: 8 } };
  assert.equal(relativeRewardMultiplier(10, 13), 2);
  assert.equal(relativeRewardMultiplier(10, 50), 2);
  assert.ok(battleRewardAmounts(10, 13, balance).xp < battleRewardAmounts(10, 10, balance).xp * 2.1);
  assert.ok(xpToNextLevel(40) > xpToNextLevel(10) * 3);
  const creature = { level: 13, defense: 25, attack: 23 };
  const sameLevel = heroDamage(13, creature, { roll: 0 });
  const underLevelled = heroDamage(10, creature, { roll: 0 });
  assert.ok(underLevelled < sameLevel);
  assert.ok(heroDamage(10, creature, { weak: true, writing: true, streak: 3, roll: 0 }) > underLevelled);
  assert.ok(heroDamage(40, { level: 40, defense: 80 }, { bonusDamage: 2, roll: 0 }) > heroDamage(40, { level: 40, defense: 80 }, { roll: 0 }) + 2);
  const player = { level: 10, hp: 38, maxHp: 38 };
  const fullHit = enemyAttack({ creature }, player, () => 1);
  const guardedHit = enemyAttack({ creature }, player, () => 1, { defenseBoost: 2 });
  assert.ok(fullHit.damage > guardedHit.damage);
  assert.equal(fullHit.evaded, false);
  assert.ok(applyHealing({ hp: 20, maxHp: 120 }, { effect: 'heal', amount: 10, healFraction: .15 }).hp >= 38);
});

test('memory and tracing cards dictate the target once and replay only that word', async () => {
  const { showWritingTask } = await import('../src/ui/writingView.js');
  const dom = new JSDOM('<div id="overlay"></div>');
  const previousDocument = global.document;
  const previousWindow = global.window;
  const previousSynth = global.speechSynthesis;
  const previousUtterance = global.SpeechSynthesisUtterance;
  global.document = dom.window.document;
  global.window = dom.window;
  const spoken = [];
  global.speechSynthesis = { cancel() {}, speak(utterance) { spoken.push(utterance.text); } };
  global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  dom.window.HanziWriter = { create: () => ({ quiz() {}, cancelQuiz() {} }) };
  try {
    const root = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { root.innerHTML = html; } };
    const word = { w: '帮助', m: 'help', p: 'bāng zhù', ex: '谢谢你的帮助。' };
    showWritingTask(overlay, word, {}, {}, () => {}, { forceMemory: true });
    assert.deepEqual(spoken, ['帮助']);
    assert.ok(!root.querySelector('.dictation-clue').textContent.includes('帮助'));
    root.querySelector('[data-dictate-word]').click();
    assert.deepEqual(spoken, ['帮助', '帮助']);
    spoken.length = 0;
    showWritingTask(overlay, word, {}, {}, () => {});
    assert.deepEqual(spoken, ['帮助']);
    assert.ok(root.querySelector('.question-word').textContent.includes('帮助'));
    root.querySelector('[data-dictate-word]').click();
    assert.deepEqual(spoken, ['帮助', '帮助']);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    global.speechSynthesis = previousSynth;
    global.SpeechSynthesisUtterance = previousUtterance;
  }
});
