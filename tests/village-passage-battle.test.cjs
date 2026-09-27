const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('full-body map sprites replace the cropped villagers and the hero uses distinct art', () => {
  const renderer = fs.readFileSync('src/world/renderer.js', 'utf8');
  assert.match(renderer, /villagers-full-body\.webp/);
  assert.match(renderer, /hero-map\.webp/);
  assert.match(renderer, /192, 256, x - 8, y - 18, 48, 56/);
  assert.ok(fs.statSync('assets/images/atlas/villagers-full-body.webp').size < 100_000);
  assert.ok(fs.statSync('assets/images/atlas/hero-map.webp').size < 30_000);
});

test('village casts occupy several areas without blocking building entrances', async () => {
  const { isWalkable, objectOccupies } = await import('../src/world/map.js');
  for (const file of ['r1-hub', 'r2-harvest-crossing', 'r3-tidewater-bay', 'r4-lantern-theatre', 'r5-festival-city', 'r6-ancient-grove', 'r7-treehouse-summit']) {
    const map = read(`content/authored/campaign/maps/${file}.json`);
    const villagers = map.objects.filter(object => object.type === 'npc');
    const upper = villagers.filter(object => object.y <= 10).length;
    const lower = villagers.filter(object => object.y >= 23).length;
    assert.ok(upper >= 2 && lower >= 2, `${file} still clusters villagers in one band`);
    for (const villager of villagers) {
      assert.equal(map.legend[map.tiles[villager.y][villager.x]].walkable, true, `${file}: ${villager.id} stands on blocked ground`);
      assert.ok(!map.objects.some(other => other !== villager && other.solid && objectOccupies(other, villager.x, villager.y)), `${file}: ${villager.id} overlaps another object`);
    }
    for (const building of map.objects.filter(object => object.type === 'building')) {
      assert.ok(isWalkable(map, building.door.x, building.door.y), `${file}: ${building.id} has no accessible doorstep`);
    }
  }
});

test('battle feedback speaker appears only after answering and reads the word and example', async () => {
  const { showQuestion } = await import('../src/ui/questionView.js');
  const dom = new JSDOM('<div id="overlay"></div>');
  const previous = global.document;
  global.document = dom.window.document;
  try {
    const root = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { root.innerHTML = html; } };
    const word = { w: '帮助', p: 'bāng zhù', m: 'to help', ex: '谢谢你帮助我。' };
    const question = { prompt: word.w, instruction: 'What does this mean?', options: ['to help', 'to leave'], correct: 'to help' };
    let readWord = null;
    let stopped = false;
    showQuestion(overlay, question, null, () => {}, { revealWord: word, readFeedback: revealed => { readWord = revealed; }, stopFeedback: () => { stopped = true; } });
    assert.equal(root.querySelector('[data-read-feedback]'), null);
    root.querySelector('[data-answer="0"]').click();
    const speaker = root.querySelector('[data-read-feedback]');
    assert.equal(speaker.getAttribute('aria-label'), 'Read word and example sentence');
    speaker.click();
    assert.deepEqual(readWord, word);
    root.querySelector('[data-question-next]').click();
    assert.equal(stopped, true);
  } finally {
    global.document = previous;
  }
});

test('Mirror Trick asks for Hanzi using only the English meaning', async () => {
  const { makeBattleQuestion } = await import('../src/gameplay.js');
  const words = read('content/generated/p5.content.json').words;
  const word = words[0];
  const question = makeBattleQuestion(word, 'h', words);
  assert.equal(question.prompt, word.m);
  assert.ok(!question.prompt.includes(word.p));
  assert.ok(question.options.includes(word.w));
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  assert.match(gameplay, /const question = makeBattleQuestion\(word, battle\.creature\.attackSkill/);
});

test('food-waste dialogue displays its eight options and accepts the authored answer', async () => {
  const { passageChoices, passageReviewMarkup } = await import('../src/gameplay.js');
  const { checkPassageAnswer } = await import('../src/systems/reading.js');
  const group = read('content/generated/p5.content.json').questions.groups.find(candidate => candidate.passage.title === '别浪费食物');
  assert.ok(group);
  for (const item of group.items) {
    const choices = passageChoices(group, item);
    assert.equal(choices.length, 8);
    assert.ok(choices.includes(item.c));
    assert.equal(checkPassageAnswer(item, item.c), true);
    assert.equal(checkPassageAnswer(item, choices.find(choice => choice !== item.c)), false);
  }
  const markup = passageReviewMarkup(group, group.items[0], group.items[0].c);
  assert.ok(markup.indexOf('Answer:</b>') < markup.indexOf('passage-scroll'));
});

test('unanswered and incorrect villager questions stay open after save migration', async () => {
  const { normalizeReading } = await import('../src/systems/reading.js');
  const { migrateState, SAVE_SCHEMA_VERSION } = await import('../src/core/state.js');
  const reading = { active: 'RG-G3', questionCount: 4, results: { 0: { rating: 'help', correct: false }, 1: { rating: 'right', correct: true } } };
  assert.deepEqual(Object.keys(normalizeReading(reading).results), ['1']);
  const levelPackage = { id: 'p5', content: { contentVersion: 'test' }, map: { id: 'r1-hub', spawn: { x: 20, y: 14 } } };
  const migrated = migrateState({ schemaVersion: SAVE_SCHEMA_VERSION - 1, level: 'p5', progress: { reading } }, levelPackage);
  assert.deepEqual(Object.keys(migrated.progress.reading.results), ['1']);
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  assert.match(gameplay, /if \(correct\) finishPassageQuestion\(group, questionIndex\);\s*else showPassageHelp/);
  assert.doesNotMatch(gameplay, /data-passage-giveup[^\n]*finishPassageQuestion/);
});
