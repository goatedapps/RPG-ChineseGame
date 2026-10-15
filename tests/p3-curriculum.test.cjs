const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { load } = require('js-yaml');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fetcher = async url => ({ ok: true, json: async () => read(url.replace(/^\//, '')) });

test('P3 supplies its complete source bank, offline writing and all seven boss challenges', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue } = await import('../src/systems/story.js');
  const game = await loadLevelPackage('p3', fetcher, '');
  assert.equal(game.content.lessons.length, 17);
  assert.equal(game.content.words.length, 399);
  assert.equal(game.content.questions.single.length, 914);
  assert.equal(game.content.questions.groups.reduce((count, group) => count + group.items.length, 0), 298);
  assert.ok(!game.config.coreQuestionKinds.includes('sentence'));
  for (const word of game.content.words) {
    assert.ok(word.sb.some(sentence => sentence[0].includes(word.w)), `${word.w}: usable sentence`);
    for (const char of [...word.w].filter(value => /\p{Script=Han}/u.test(value))) {
      assert.ok(game.characters.characters[char], `${char}: offline stroke data`);
    }
  }
  for (const [region, lessons] of Object.entries(game.config.regionLessons)) {
    const queue = bossGateQueue(game.content, game.config, lessons);
    const questions = queue.filter(task => task.kind === 'question');
    assert.equal(questions.length, 10);
    assert.equal(new Set(questions.map(task => task.item.id)).size, 10);
    for (const lesson of lessons) assert.ok(questions.some(task => task.item.lessons.includes(lesson)), `${region}: Lesson ${lesson}`);
    for (const { item } of questions) {
      assert.equal(item.subject, 'Chinese');
      assert.equal(new Set(item.o).size, 4);
      assert.ok(item.o.includes(item.c));
    }
    assert.equal(new Set(queue.filter(task => task.kind === 'writing').map(task => task.word.w)).size, 2);
  }
});

test('P3 Heavy Slam uses dedicated ordinary Chinese Usage for every word and lesson', async () => {
  const { makeBattleQuestion, schoolQuestionPool } = await import('../src/gameplay.js');
  const { SKILLS } = await import('../src/learning/mastery.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const game = await loadLevelPackage('p3', fetcher, '');
  const content = game.content;
  const authored = content.questions.single.filter(question => question.id.startsWith('WSQ-P3-'));
  assert.equal(authored.length, 387);
  assert.equal(SKILLS.u.action, 'Heavy Slam');
  const schoolPools = Object.fromEntries(Object.keys(game.config.regionLessons).map(id => [id,
    schoolQuestionPool({ content, config: game.config, region: { id } })
  ]));
  const selectedIds = new Set();
  for (const word of content.words) {
    const usage = content.questions.single.filter(question => question.kind === 'usage'
      && question.subject === 'Chinese' && question.word === word.w && question.lessons.includes(word.lesson));
    assert.equal(usage.length, 1, `${word.w}, Lesson ${word.lesson}: dedicated Usage question`);
    const expected = usage[0];
    assert.equal(new Set(expected.o).size, 4, `${expected.id}: four distinct choices`);
    assert.ok(expected.o.every(option => option.includes(word.w)), `${expected.id}: every choice tests the target`);
    assert.equal(expected.o.filter(option => option === expected.c).length, 1);
    assert.deepEqual(expected.lessons, [word.lesson]);
    const question = makeBattleQuestion(word, 'u', content.words, content.questions.single);
    assert.equal(question.id, expected.id, `${word.w}, Lesson ${word.lesson}: Heavy Slam chooses Usage over vocab/fallback`);
    assert.equal(question.source, 'exam');
    assert.equal(question.skill, 'u');
    assert.equal(question.word, word.w);
    assert.equal(question.correct, expected.c);
    assert.deepEqual(new Set(question.options), new Set(expected.o));
    selectedIds.add(question.id);
    for (const [region, pool] of Object.entries(schoolPools)) {
      assert.equal(pool.some(item => item.id === expected.id), game.config.regionLessons[region].includes(word.lesson), `${expected.id}: School region ${region}`);
    }
  }
  assert.equal(selectedIds.size, 399, 'Repeated words retain different lesson questions');
  const source = load(fs.readFileSync('content/source/p3/questions/usage.yaml', 'utf8'));
  const index = load(fs.readFileSync('content/source/p3/questions/index.yaml', 'utf8'));
  const approved = source.filter(question => question.reviewStatus === 'user-approved-sample');
  assert.equal(approved.length, 10);
  assert.deepEqual(approved.map(question => question.options.indexOf(question.correct) + 1), [2, 4, 1, 3, 2, 4, 2, 1, 4, 3]);
  for (const question of authored) {
    assert.ok(index.some(entry => entry.groupId === question.id && entry.category === 'usage'
      && entry.questionCount === 1 && entry.lessonIds.length === 1 && entry.lessonIds[0] === question.lessons[0]));
  }
});

test('P3 shared answer banks reach every cloze and dialogue MCQ', () => {
  const content = read('content/generated/p3.content.json');
  const bankGroups = content.questions.groups.filter(group => group.optionBank);
  assert.equal(bankGroups.length, 14);
  assert.equal(bankGroups.reduce((count, group) => count + group.items.length, 0), 59);
  for (const group of content.questions.groups) {
    assert.ok(group.passage?.text);
    for (const item of group.items) {
      if (item.format === 'MCQ') {
        assert.ok(item.o.length >= 2, `${group.id}: playable choices`);
        assert.equal(new Set(item.o).size, item.o.length);
        assert.ok(item.o.includes(item.c));
      } else if (item.format === 'Fill-in') assert.ok(item.c || item.accepted?.length);
      else assert.ok(item.c || item.displayAnswer);
    }
  }
});

test('P3 adapted exam choices preserve the originals and explicit vocabulary targets survive the build', () => {
  const source = load(fs.readFileSync('content/source/p3/questions/vocab.yaml', 'utf8'));
  const adapted = source.filter(question => question.originalOptions);
  assert.equal(adapted.length, 70);
  for (const question of adapted) {
    assert.ok(question.originalOptions.includes(question.correct));
    assert.equal(new Set(question.options).size, 4);
    assert.ok(question.options.includes(question.correct));
  }
  const content = read('content/generated/p3.content.json');
  for (const kind of ['vocab', 'usage', 'pinyin', 'phrase']) {
    const questions = load(fs.readFileSync(`content/source/p3/questions/${kind}.yaml`, 'utf8'));
    for (const question of questions.filter(item => content.words.some(word => word.w === item.targetWord))) {
      assert.equal(content.questions.single.find(item => item.id === question.questionID).word, question.targetWord);
    }
  }
});
