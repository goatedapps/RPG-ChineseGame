const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { playableLevels } = require('./support/levels.cjs');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('School Quiz and Exam Day pools include only current-region lessons', async () => {
  const { schoolQuestionPool } = await import('../src/gameplay.js');
  for (const level of playableLevels) {
    const content = read(`content/generated/${level.id}.content.json`);
    const config = read(`content/authored/levels/${level.id}/level.json`);
    for (let number = 1; number <= 7; number += 1) {
      const id = `r${number}`;
      const lessons = new Set(config.regionLessons[id]);
      const pool = schoolQuestionPool({ content, config, region: { id } });
      assert.ok(pool.length >= 4, `${level.id} ${id}: enough regional questions`);
      assert.ok(pool.every(question => question.lessons.every(lesson => lessons.has(lesson))), `${level.id} ${id}: no out-of-region question`);
    }
  }
});

test('authored exam answers are shuffled without changing the answer or source options', async () => {
  const { makeExamQuestion, checkAnswer } = await import('../src/learning/questions.js');
  const source = { id: 'sample', kind: 'vocab', q: 'Choose the word.', o: ['correct', 'second', 'third', 'fourth'], c: 'correct' };
  const original = [...source.o];
  const question = makeExamQuestion(source, { random: () => 0 });
  assert.notEqual(question.options[0], question.correct);
  assert.deepEqual(new Set(question.options), new Set(original));
  assert.deepEqual(source.o, original);
  assert.equal(checkAnswer(question, question.options[question.options.indexOf('correct')]).ok, true);
});

test('battle Usage prefers a vetted matching question, then falls back only when absent', async () => {
  const { makeBattleQuestion } = await import('../src/gameplay.js');
  const content = read('content/generated/p2.content.json');
  const usage = content.questions.single.find(question => question.id === 'P2-USE37');
  const vocab = content.questions.single.find(question => question.id === 'CHATGPT-Vocab-125');
  const usageWord = content.words.find(word => word.w === usage.word && word.lesson === usage.lessons[0]);
  const vocabWord = content.words.find(word => word.w === vocab.word && word.lesson === vocab.lessons[0]);
  const authoredUsage = makeBattleQuestion(usageWord, 'u', content.words, [usage, vocab]);
  assert.equal(authoredUsage.id, usage.id);
  assert.equal(authoredUsage.source, 'exam');
  assert.equal(authoredUsage.skill, 'u');
  assert.deepEqual(new Set(authoredUsage.options), new Set(usage.o));
  assert.equal(authoredUsage.correct, usage.c);
  const authoredVocab = makeBattleQuestion(vocabWord, 'u', content.words, [vocab]);
  assert.equal(authoredVocab.id, vocab.id);
  assert.equal(authoredVocab.correct, vocab.c);
  const fallback = makeBattleQuestion(usageWord, 'u', content.words, [{ ...usage, lessons: [99] }]);
  assert.equal(fallback.source, 'generated');
});

test('approved P6 vocabulary questions are available in battle Usage and each word’s regional School pool', async () => {
  const { makeBattleQuestion, schoolQuestionPool } = await import('../src/gameplay.js');
  const content = read('content/generated/p6.content.json');
  const config = read('content/authored/levels/p6/level.json');
  const approved = content.questions.single.filter(question => /^P6-CH-AUTHORED-B0[12]-Q/.test(question.id));
  assert.equal(approved.length, 205);
  const targets = new Set(approved.map(question => question.word));
  assert.equal(targets.size, 200);
  const schoolPools = Object.fromEntries(Object.keys(config.regionLessons).map(regionId => [
    regionId, schoolQuestionPool({ content, config, region: { id: regionId } })
  ]));

  for (const word of content.words.filter(word => targets.has(word.w))) {
    const authored = approved.find(question => question.word === word.w && question.lessons.includes(word.lesson));
    assert.ok(authored, `${word.w}, Lesson ${word.lesson}: approved question exists`);
    assert.deepEqual(authored.lessons, [word.lesson], `${authored.id}: one lesson keeps School eligibility local`);
    assert.equal(authored.word, authored.c);
    const battleQuestion = makeBattleQuestion(word, 'u', content.words, content.questions.single);
    assert.equal(battleQuestion.source, 'exam', `${word.w}: no generated fallback`);
    assert.ok(battleQuestion.id.startsWith('P6-CH-AUTHORED-B0'), `${word.w}: approved bank selected`);
    assert.ok(battleQuestion.options.includes(battleQuestion.correct));
    const regionId = Object.keys(config.regionLessons).find(id => config.regionLessons[id].includes(word.lesson));
    assert.ok(schoolPools[regionId].some(question => question.id === authored.id), `${word.w}: available at ${regionId} School`);
    for (const [otherRegion, pool] of Object.entries(schoolPools)) {
      if (otherRegion !== regionId) assert.ok(!pool.some(question => question.id === authored.id), `${authored.id}: no out-of-region School leak`);
    }
  }

  const covered = content.words.filter(word => content.questions.single.some(question => (
    ['vocab', 'usage'].includes(question.kind)
    && question.word === word.w
    && question.lessons?.includes(word.lesson)
    && question.subject !== 'Higher Chinese'
    && Array.isArray(question.o)
    && question.o.length >= 2
    && question.o.includes(question.c)
  )));
  assert.ok(covered.length >= 263, 'P6 retains reviewed question coverage for at least 263 lesson vocabulary entries');
});
