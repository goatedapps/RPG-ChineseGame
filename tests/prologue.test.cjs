const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('startup prologue carries the core story and packaged media', async () => {
  const { PROLOGUE_SLIDES } = await import('../src/ui/prologue.js');
  const story = PROLOGUE_SLIDES.map(slide => `${slide.title} ${slide.body}`).join(' ');
  assert.equal(PROLOGUE_SLIDES.length, 5);
  for (const phrase of ['Word Spirit', '字灵', 'Great Dictionary Tree', '字典树', 'Great Forgetter', '遗忘大王', 'Spirit Brush']) assert.match(story, new RegExp(phrase));
  for (const image of new Set(PROLOGUE_SLIDES.map(slide => slide.image))) assert.equal(fs.existsSync(path.join(root, image.replace('../', ''))), true, image);
  assert.equal(fs.existsSync(path.join(root, 'assets/audio/prologue-bg.mp3')), true);
  assert.match(fs.readFileSync(path.join(root, 'game/index.html'), 'utf8'), /id="prologue"/);
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const prologue = fs.readFileSync(path.join(root, 'src/ui/prologue.js'), 'utf8');
  const audio = fs.readFileSync(path.join(root, 'src/core/audio.js'), 'utf8');
  assert.match(main, /createPrologue/);
  assert.match(main, /if \(!active\.state\.progress\.story\.flags\.arrival\) adventure\.storyJournal\(\)/);
  assert.match(prologue, /setInterval/);
  assert.match(prologue, /data-prologue-copy/);
  for (const track of ['prologue-bg.mp3', 'scholar-village-bg.mp3', 'harvest-crossing-bg.mp3', 'tidewater-bg.mp3']) assert.match(audio, new RegExp(track.replace('.', '\\.')));
  assert.match(audio, /setWorld\(regionId\)/);
});
