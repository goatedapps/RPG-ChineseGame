const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

test('dialogue types each line and the first Next press reveals it without skipping', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<button id="return">Return</button><div id="overlay" hidden></div>');
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
    overlay.dialogue({ title: 'Grandma Wang', lines: ['Welcome to Scholar Village.', 'Take the Spirit Brush handle.'] });
    const line = dom.window.document.querySelector('.dialog-card > p:not(.speaker)');
    assert.equal(line.textContent, '');
    dom.window.document.querySelector('[data-dialogue-next]').click();
    assert.equal(line.textContent, 'Welcome to Scholar Village.');
    dom.window.document.querySelector('[data-dialogue-next]').click();
    assert.equal(dom.window.document.querySelector('.dialog-card > p:not(.speaker)').getAttribute('aria-label'), 'Take the Spirit Brush handle.');
    overlay.close();
  } finally {
    globalThis.document = previousDocument;
    dom.window.close();
  }
});

test('the opening story and onward gate identify the brush handle and Muddle King', () => {
  const story = JSON.parse(fs.readFileSync(path.join(root, 'content/authored/campaign/r1-story.json'), 'utf8'));
  const arrival = story.scenes.arrival.map(command => command.say || '').join(' ');
  assert.match(arrival, /Take this Spirit Brush handle, and use it to bring the Word Spirits home/);
  assert.doesNotMatch(arrival, /Fogling bursts/);
  assert.doesNotMatch(arrival, /attic|upstairs/i);
  assert.equal(story.bossName, 'Muddle King');
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  assert.match(adventure, /!fragmentReady \? `Defeat the \$\{bossName\}/);
});

test('battle question badges and route labels are present without bitmap requests', () => {
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(gameplay, /battleQuestionBadge\('attack'\)/);
  assert.match(gameplay, /battleQuestionBadge\('defense'\)/);
  assert.match(main, /zoneLabel\.textContent = currentZone \? `\$\{currentZone\.name\} · Lesson \$\{currentZone\.lesson\}`/);
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /audio\/earn\.mp3/);
});
