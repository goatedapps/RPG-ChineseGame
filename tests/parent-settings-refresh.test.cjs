const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('the new parent PIN replaces the former default and preserves a custom PIN', async () => {
  const { ensureParentPin, parentPinMatches, setParentPin } = await import('../src/systems/parent.js');
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  ensureParentPin(storage);
  assert.equal(parentPinMatches(storage, '0000'), true);
  assert.equal(parentPinMatches(storage, '1056'), false);
  const legacyValues = new Map();
  const legacyStorage = { getItem: key => legacyValues.get(key) ?? null, setItem: (key, value) => legacyValues.set(key, value) };
  setParentPin(legacyStorage, '1056');
  ensureParentPin(legacyStorage);
  assert.equal(parentPinMatches(legacyStorage, '0000'), true);
  setParentPin(storage, '1056');
  ensureParentPin(storage);
  assert.equal(parentPinMatches(storage, '1056'), true);
  setParentPin(storage, '4382');
  ensureParentPin(storage);
  assert.equal(parentPinMatches(storage, '4382'), true);
  assert.equal(parentPinMatches(storage, '0000'), false);
});

test('ordinary overlays focus their content while tutorial buttons remain ready for keyboard use', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<body><div id="overlay" hidden></div></body>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const element = dom.window.document.querySelector('#overlay');
    const overlay = createOverlay(element);
    overlay.open('<div class="dialog-card"><p class="speaker">Mayor Shen</p><p>Story</p><button>Continue</button></div>');
    assert.equal(dom.window.document.activeElement.textContent, 'Mayor Shen');
    overlay.open('<div class="panel"><h1>Wild encounter</h1><button>Fight!</button></div>');
    assert.equal(dom.window.document.activeElement.textContent, 'Wild encounter');
    overlay.open('<div class="dialog-card tutorial-dialog-card"><p class="speaker">Jun</p><button>Continue</button></div>');
    assert.equal(dom.window.document.activeElement.textContent, 'Continue');
    overlay.close();
  } finally {
    global.document = previousDocument;
    dom.window.close();
  }
});

test('parent settings follow the new order and omit retired controls', () => {
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  const adventure = fs.readFileSync('src/adventure.js', 'utf8');
  const freshState = fs.readFileSync('src/core/state.js', 'utf8');
  const sectionStart = gameplay.indexOf('const settingsHtml =');
  const sectionEnd = gameplay.indexOf('const summaryHtml =', sectionStart);
  const settings = gameplay.slice(sectionStart, sectionEnd);
  const headings = ['<h2>Shortcuts</h2>', '<h2>Parent Tools</h2>', '<h2>Play and Learning</h2>', '<summary>Change Parent PIN</summary>'];
  assert.deepEqual(headings.map(heading => settings.indexOf(heading)).every((index, position, indexes) => index >= 0 && (position === 0 || index > indexes[position - 1])), true);
  assert.match(settings, /data-parent-coins-give/);
  assert.match(settings, /<details class="parent-gift"[^>]*><summary><span><b>Give Spirit Card\(s\)<\/b>/);
  assert.doesNotMatch(settings, /data-sound|data-region-unlock|data-test-mode|Testing Shortcuts/);
  assert.doesNotMatch(adventure, /settings\.testMode/);
  assert.doesNotMatch(freshState, /testMode/);
  assert.doesNotMatch(adventure, /Where to explore|pathGuideMarkup|path-guide/);
});
