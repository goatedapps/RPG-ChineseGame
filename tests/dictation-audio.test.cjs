const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

class Utterance { constructor(text) { this.text = text; } }

test('dictation resumes paused speech and selects an available local Mandarin voice on each replay', async () => {
  const { createSpeechController } = await import('../src/learning/audio.js');
  const spoken = [];
  const mandarin = { lang: 'zh-SG', localService: true };
  let voices = [];
  let resumed = 0;
  const synth = {
    paused: true, cancel() {}, resume() { resumed += 1; this.paused = false; },
    getVoices: () => voices,
    speak(utterance) { spoken.push(utterance); utterance.onstart(); }
  };
  const speech = createSpeechController({ synth, Utterance });
  speech.speak('今天');
  assert.equal(resumed, 1);
  voices = [{ lang: 'en-US', localService: true }, { lang: 'zh-HK', localService: true }, { lang: 'zh-CN', localService: false }, mandarin];
  speech.speak('今天');
  assert.equal(spoken[1].voice, mandarin);
  assert.equal(spoken[1].lang, 'zh-SG');
  speech.stop();
});

test('speech reports unavailable engines, thrown failures and asynchronous errors without breaking replay', async () => {
  const { createSpeechController } = await import('../src/learning/audio.js');
  const errors = [];
  assert.equal(createSpeechController({ synth: null, Utterance }).speak('今天', { onError: error => errors.push(error) }), false);
  const spoken = [];
  const synth = { cancel() {}, speak(utterance) { spoken.push(utterance); } };
  const speech = createSpeechController({ synth, Utterance });
  speech.speak('今天', { onError: error => errors.push(error) });
  spoken[0].onerror({ error: 'language-unavailable' });
  spoken[0].onerror({ error: 'language-unavailable' });
  assert.equal(speech.isSpeaking, false);
  speech.speak('今天', { onError: error => errors.push(error) });
  spoken[0].onerror({ error: 'interrupted' });
  assert.equal(speech.isSpeaking, true);
  spoken[1].onend();
  synth.speak = () => { throw new Error('Engine unavailable'); };
  assert.equal(speech.speak('今天', { onError: error => errors.push(error) }), false);
  assert.deepEqual(errors, ['unavailable', 'language-unavailable', 'synthesis-failed']);
});

test('silent speech startup times out, while started or stopped requests do not produce false errors', async t => {
  const { createSpeechController } = await import('../src/learning/audio.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const errors = [];
  const spoken = [];
  const speech = createSpeechController({ synth: { cancel() {}, speak: utterance => spoken.push(utterance) }, Utterance });
  speech.speak('今天', { onError: error => errors.push(error) });
  t.mock.timers.tick(8000);
  assert.deepEqual(errors, ['start-timeout']);
  assert.equal(speech.isSpeaking, false);
  speech.speak('今天', { onError: error => errors.push(error) });
  spoken[1].onstart();
  t.mock.timers.tick(8000);
  assert.equal(speech.isSpeaking, true);
  speech.stop();
  speech.speak('今天', { onError: error => errors.push(error) });
  speech.stop();
  t.mock.timers.tick(8000);
  assert.deepEqual(errors, ['start-timeout']);
});

test('P2 second-village battle writing displays audio errors, preserves hidden answers and clears errors on replay', async () => {
  const { showWritingTask } = await import('../src/ui/writingView.js');
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<div id="overlay"></div>');
  const oldDocument = global.document;
  const oldWindow = global.window;
  global.document = dom.window.document;
  global.window = dom.window;
  dom.window.HanziWriter = { create: () => ({ quiz() {}, cancelQuiz() {} }) };
  try {
    const content = JSON.parse(fs.readFileSync('content/generated/p2.content.json', 'utf8'));
    const word = content.words.find(word => word.lesson === 4);
    assert.ok(word);
    const root = document.querySelector('#overlay');
    const overlay = createOverlay(root);
    const spoken = [];
    let stopped = 0;
    let fail;
    showWritingTask(overlay, word, {}, {}, () => {}, {
      forceMemory: true, headerHtml: '<div class="battle-question-badge">Attack</div>',
      speech: { stop() { stopped += 1; }, speak(text, options) { spoken.push(text); fail = options.onError; } }
    });
    fail('language-unavailable');
    assert.match(root.querySelector('[data-dictation-status]').textContent, /Chinese \(Mandarin\)/);
    assert.ok(!root.querySelector('.dictation-clue').textContent.includes(word.w));
    root.querySelector('[data-dictate-word]').click();
    assert.equal(root.querySelector('[data-dictation-status]').textContent, '');
    assert.deepEqual(spoken, [word.w, word.w]);
    fail('not-allowed');
    assert.match(root.querySelector('[data-dictation-status]').textContent, /Tap Hear word/);
    overlay.open('<div class="panel"><h1>Your turn</h1></div>');
    assert.equal(stopped, 1);
    fail('language-unavailable');
    assert.equal(root.textContent, 'Your turn');
  } finally {
    global.document = oldDocument;
    global.window = oldWindow;
    dom.window.close();
  }
});
