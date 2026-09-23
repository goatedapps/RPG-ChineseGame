const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('content lab exposes both curricula and local Hanzi Writer', () => {
  const html = fs.readFileSync(path.join(root, 'game', 'lab.html'), 'utf8');
  const dom = new JSDOM(html);
  const levels = [...dom.window.document.querySelectorAll('#lab-level option')].map(option => option.value);
  assert.deepEqual(levels, ['p5', 'p2']);
  assert.equal(dom.window.document.querySelector('script[src*="hanzi-writer.min.js"]').getAttribute('src'), '../vendor/hanzi-writer/hanzi-writer.min.js');
  assert.equal(dom.window.document.querySelector('script[type="module"]').getAttribute('src'), '../src/content-lab.js');
});

test('mastery awards one tick per skill per day and reaches Gold across days', async () => {
  const { recordAnswer, starsOf, tierOf } = await import('../src/learning/mastery.js');
  let progress = { collected: true };
  for (const skill of ['m', 'p', 'h', 'u', 'w']) {
    progress = recordAnswer(progress, { skill, correct: true, day: '2026-09-23' }).progress;
    const duplicate = recordAnswer(progress, { skill, correct: true, day: '2026-09-23' });
    assert.equal(duplicate.tickEarned, false);
    progress = recordAnswer(duplicate.progress, { skill, correct: true, day: '2026-09-24' }).progress;
  }
  assert.equal(starsOf(progress), 5);
  assert.equal(tierOf(progress), 'gold');
  assert.equal(progress.reviewDay, '2026-09-24');
});

test('due reviews drop the failed skill and successful reviews double their interval', async () => {
  const { completeReview, isReviewDue, recordAnswer, tierOf } = await import('../src/learning/mastery.js');
  const gold = {
    collected: true,
    ticks: { m: 2, p: 2, h: 2, u: 2, w: 2 },
    reviewDay: '2026-09-20',
    reviewInterval: 3
  };
  assert.equal(isReviewDue(gold, '2026-09-23'), true);
  const failed = recordAnswer(gold, { skill: 'p', correct: false, day: '2026-09-23' });
  assert.equal(failed.reviewFailed, true);
  assert.equal(failed.progress.ticks.p, 1);
  assert.equal(tierOf(failed.progress), 'silver');
  const reviewed = completeReview(gold, '2026-09-23');
  assert.equal(reviewed.reviewInterval, 6);
  assert.equal(reviewed.reviewDay, '2026-09-23');
});

test('selection excludes resting Gold words and favours missing words', async () => {
  const { wordWeight, selectWord } = await import('../src/learning/selection.js');
  const words = [{ w: '甲' }, { w: '乙' }];
  const progress = {
    甲: { collected: true, ticks: { m: 2, p: 2, h: 2, u: 2, w: 2 }, reviewDay: '2026-09-22', reviewInterval: 3 },
    乙: { collected: false }
  };
  assert.equal(wordWeight(progress.甲, '2026-09-23'), 0);
  assert.equal(wordWeight(progress.乙, '2026-09-23'), 5);
  assert.equal(selectWord(words, progress, { day: '2026-09-23', random: () => 0.9 }).w, '乙');
});

test('all four generated MCQ skills produce a valid answer for P2 and P5 words', async () => {
  const { checkAnswer, makeQuestion } = await import('../src/learning/questions.js');
  for (const level of ['p2', 'p5']) {
    const content = readJson(`content/generated/${level}.content.json`);
    const word = content.words[0];
    for (const skill of ['m', 'p', 'h', 'u']) {
      const question = makeQuestion(word, skill, content.words, { random: () => 0.42 });
      assert.ok(question.options.length >= 2, `${level} ${skill} needs options`);
      assert.ok(question.options.includes(question.correct), `${level} ${skill} needs its answer`);
      assert.equal(checkAnswer(question, question.correct).ok, true);
    }
  }
});

test('exam adapters exclude disabled kinds, Higher Chinese, and malformed options', async () => {
  const { filterSupportedQuestions } = await import('../src/learning/examAdapters.js');
  const content = {
    questions: { single: [
      { id: 'a', kind: 'vocab', subject: 'Chinese', o: ['甲', '乙'], c: '甲' },
      { id: 'b', kind: 'phrase', subject: 'Chinese', o: ['甲', '乙'], c: '甲' },
      { id: 'c', kind: 'vocab', subject: 'Higher Chinese', o: ['甲', '乙'], c: '甲' },
      { id: 'd', kind: 'vocab', subject: 'Chinese', o: ['乙'], c: '甲' }
    ] }
  };
  const result = filterSupportedQuestions(content, { coreQuestionKinds: ['vocab'], optionalQuestionKinds: [] });
  assert.deepEqual(result.map(question => question.id), ['a']);
});

test('writing stages preserve the four-miss threshold and update character progress once per run', async () => {
  const { AUTO_COMPLETE_AFTER_MISSES, recordCharacter, stageForCharacter, writingResult } = await import('../src/learning/writing.js');
  assert.equal(AUTO_COMPLETE_AFTER_MISSES, 4);
  assert.equal(stageForCharacter({ stage: 0 }).name, 'Trace');
  let progress = recordCharacter({}, { helped: false, runId: 'battle-1' });
  assert.equal(progress.stage, 1);
  progress = recordCharacter(progress, { helped: false, runId: 'battle-1' });
  assert.equal(progress.stage, 1);
  progress = recordCharacter(progress, { helped: true, runId: 'battle-2' });
  assert.equal(progress.stage, 0);
  assert.deepEqual(writingResult({ allFromMemory: true }), { ok: true, helped: false, earnsTick: true });
  assert.equal(writingResult({ allFromMemory: true, autoCompleted: true }).earnsTick, false);
});

test('speech control cancels playback when toggled or replaced', async () => {
  const { createSpeechController } = await import('../src/learning/audio.js');
  const spoken = [];
  let cancellations = 0;
  const synth = { speak: utterance => spoken.push(utterance), cancel: () => { cancellations += 1; } };
  class Utterance { constructor(text) { this.text = text; } }
  const audio = createSpeechController({ synth, Utterance });
  assert.equal(audio.speak('露营'), true);
  assert.equal(audio.isSpeaking, true);
  assert.equal(audio.speak('集合'), true);
  assert.equal(spoken[1].text, '集合');
  audio.stop();
  assert.equal(audio.isSpeaking, false);
  assert.equal(cancellations, 3);
});
