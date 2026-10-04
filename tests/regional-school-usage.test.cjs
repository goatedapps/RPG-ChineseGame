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
