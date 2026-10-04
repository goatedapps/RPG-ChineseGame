const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

test('leaving dictation during the final stroke delay cannot complete it', async () => {
  const { showWritingTask } = await import('../src/ui/writingView.js');
  const dom = new JSDOM('<div id="overlay"></div>');
  const previousDocument = global.document;
  const previousWindow = global.window;
  global.document = dom.window.document;
  global.window = dom.window;
  const timers = new Map();
  let nextTimer = 0;
  let completeStroke;
  let exited = 0;
  let completed = 0;
  dom.window.setTimeout = callback => { timers.set(++nextTimer, callback); return nextTimer; };
  dom.window.clearTimeout = id => { timers.delete(id); };
  dom.window.HanziWriter = { create: () => ({ quiz: options => { completeStroke = options.onComplete; }, cancelQuiz() {} }) };
  try {
    const root = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { root.innerHTML = html; } };
    showWritingTask(overlay, { w: '擦', m: 'wipe', p: 'cā', ex: '擦脸。' }, {}, {}, () => { completed += 1; }, {
      forceMemory: true,
      onExit: () => { exited += 1; },
      speech: { speak() {}, stop() {} }
    });
    completeStroke();
    const pending = [...timers.values()];
    root.querySelector('[data-writing-exit]').click();
    pending.forEach(callback => callback());
    completeStroke();
    assert.equal(exited, 1);
    assert.equal(completed, 0);
    assert.equal(timers.size, 0);
  } finally {
    global.document = previousDocument;
    global.window = previousWindow;
    dom.window.close();
  }
});

test('replacing the Reading Hall panel stops its activity without running its close action', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
    let stopped = 0;
    let closed = 0;
    overlay.open('<div class="panel"><h1>Reading Hall</h1></div>', {
      onClose: () => { closed += 1; },
      onReplace: () => { stopped += 1; }
    });
    overlay.open('<div class="panel"><h1>Spirit Book</h1></div>');
    assert.equal(stopped, 1);
    assert.equal(closed, 0);
    assert.match(dom.window.document.querySelector('#overlay').textContent, /Spirit Book/);
    overlay.close();
    assert.equal(closed, 0);
  } finally {
    global.document = previousDocument;
    dom.window.close();
  }
});

test('late events from cancelled speech do not end the current utterance', async () => {
  const { createSpeechController } = await import('../src/learning/audio.js');
  const spoken = [];
  const synth = { speak: utterance => spoken.push(utterance), cancel: () => spoken.at(-1)?.onend?.() };
  class Utterance { constructor(text) { this.text = text; } }
  const speech = createSpeechController({ synth, Utterance });
  let oldEnds = 0;
  let newEnds = 0;
  speech.speak('first', { onEnd: () => { oldEnds += 1; } });
  const old = spoken[0];
  speech.speak('second', { onEnd: () => { newEnds += 1; } });
  old.onerror();
  assert.equal(oldEnds, 0);
  assert.equal(speech.isSpeaking, true);
  spoken[1].onend();
  spoken[1].onerror();
  assert.equal(newEnds, 1);
  assert.equal(speech.isSpeaking, false);
});

test('route location remains in the HUD after any HUD refresh', async () => {
  const { updateHud } = await import('../src/ui/hud.js');
  const dom = new JSDOM('<div id="hud"></div>');
  const elements = Object.fromEntries(['region', 'level', 'location', 'playerLevel', 'xp', 'xpBar', 'hp', 'hpBar', 'coins', 'spirits', 'battles', 'streak', 'status'].map(name => [name, dom.window.document.createElement('span')]));
  const levelPackage = { label: 'P2', region: { id: 'r1', name: 'Scholar Village' }, map: { name: 'Mistwood Road', route: true } };
  const state = { player: { level: 1, xp: 0, hp: 20, maxHp: 20, coins: 0 }, progress: { words: {}, energy: { day: '', used: 0 } }, settings: { dailyBattles: 30 } };
  updateHud(elements, levelPackage, state);
  assert.equal(elements.region.textContent, 'Mistwood Road');
  assert.equal(elements.region.title, 'Mistwood Road');
  levelPackage.map = { name: 'Scholar Village', route: false };
  updateHud(elements, levelPackage, state);
  assert.equal(elements.region.textContent, 'Scholar Village');
  dom.window.close();
});
