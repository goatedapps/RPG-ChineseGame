const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('prologue types its heading before the body and keeps a permanent skip link', async () => {
  const { createPrologue, PROLOGUE_SLIDES } = await import('../src/ui/prologue.js');
  const dom = new JSDOM('<div id="prologue"></div>', { url: 'https://example.test/game/' });
  const root = dom.window.document.querySelector('#prologue');
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let tick;
  globalThis.setInterval = callback => { tick = callback; return 1; };
  globalThis.clearInterval = () => {};
  try {
    let completed;
    createPrologue({ root, audio: { unlock() {}, setScene() {} }, onComplete: result => { completed = result; } });
    const splashSkip = root.querySelector('a[data-prologue-skip]');
    assert.equal(splashSkip.textContent, 'Skip intro');
    root.querySelector('[data-prologue-begin]').click();
    const heading = root.querySelector('[data-prologue-heading]');
    const body = root.querySelector('[data-prologue-copy]');
    assert.equal(heading.textContent, '');
    assert.equal(body.textContent, '');
    tick();
    assert.equal(heading.textContent, PROLOGUE_SLIDES[0].title.slice(0, 1));
    assert.equal(body.textContent, '');
    for (let index = 1; index < PROLOGUE_SLIDES[0].title.length; index += 1) tick();
    assert.equal(heading.textContent, PROLOGUE_SLIDES[0].title);
    assert.equal(body.textContent, '');
    tick();
    assert.equal(body.textContent, PROLOGUE_SLIDES[0].body.slice(0, 1));
    assert.equal(root.querySelector('a[data-prologue-skip]').textContent, 'Skip intro');
    root.querySelector('a[data-prologue-skip]').click();
    assert.deepEqual(completed, { skipped: true });
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    dom.window.close();
  }
});

test('region guide suggests a path without closing the others', async () => {
  const { regionPathGuide } = await import('../src/systems/regionGuide.js');
  const config = JSON.parse(fs.readFileSync('content/authored/levels/p5/level.json', 'utf8'));
  const balance = JSON.parse(fs.readFileSync('content/authored/shared/balance.json', 'utf8'));
  const content = JSON.parse(fs.readFileSync('content/generated/p5.content.json', 'utf8'));
  const map = JSON.parse(fs.readFileSync('content/authored/campaign/maps/r1-hub.json', 'utf8'));
  const levelPackage = { region: { id: 'r1' }, config, balance, content, map };
  const progress = { words: {} };
  const first = regionPathGuide(levelPackage, progress, 1);
  assert.equal(first.length, 3);
  assert.equal(first.filter(path => path.suggested).length, 1);
  assert.equal(first[0].name, 'Camping Forest');
  assert.equal(first[0].direction, 'west');
  const firstWords = content.words.filter(word => word.lesson === 1);
  for (const word of firstWords.slice(0, Math.ceil(firstWords.length * .7))) progress.words[word.w] = { collected: true };
  const next = regionPathGuide(levelPackage, progress, 1);
  assert.equal(next.find(path => path.suggested).lesson, 2);
  assert.equal(next.length, 3);
});

test('music pauses on visibility loss and resumes the same scene', async () => {
  const tracks = [];
  class FakeAudio {
    constructor(source) { this.source = source; this.currentTime = 0; this.volume = 0; this.playing = false; tracks.push(this); }
    play() { this.playing = true; this.plays = (this.plays || 0) + 1; return Promise.resolve(); }
    pause() { this.playing = false; }
    cloneNode() { return new FakeAudio(this.source); }
  }
  const { createAudioManager } = await import('../src/core/audio.js');
  const audio = createAudioManager({ AudioClass: FakeAudio });
  const village = tracks.find(track => track.source.includes('scholar-village-bg.mp3'));
  audio.unlock();
  village.currentTime = 19;
  audio.setVisible(false);
  assert.equal(village.playing, false);
  assert.equal(village.currentTime, 19);
  audio.setVisible(true);
  assert.equal(village.playing, true);
  assert.equal(village.currentTime, 19);
  audio.setEnabled(false);
});

test('ordinary and boss defeats play non-looping recovery music until the recovery panel closes', async () => {
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  const adventure = fs.readFileSync('src/adventure.js', 'utf8');
  assert.match(gameplay, /function faint\(battle\)[\s\S]*?setScene\('defeat'\)[\s\S]*?onClose: \(\) => audio\?\.setScene\('village'\)/);
  assert.match(adventure, /if \(game\.state\.player\.hp === 0\)[\s\S]*?setScene\('defeat'\)[\s\S]*?onClose: \(\) => audio\?\.setScene\('village'\)/);
  const tracks = [];
  class FakeAudio {
    constructor(source) { this.source = source; this.currentTime = 0; this.playing = false; tracks.push(this); }
    play() { this.playing = true; return Promise.resolve(); }
    pause() { this.playing = false; }
    cloneNode() { return new FakeAudio(this.source); }
  }
  const { createAudioManager } = await import('../src/core/audio.js');
  const audio = createAudioManager({ AudioClass: FakeAudio });
  const defeat = tracks.find(track => track.source.includes('need-improvement.mp3'));
  const village = tracks.find(track => track.source.includes('scholar-village-bg.mp3'));
  const battle = tracks.find(track => track.source.includes('battle.mp3'));
  const prologueTracks = tracks.filter(track => track.source.includes('prologue-bg.mp3'));
  assert.ok(battle);
  assert.equal(tracks.some(track => track.source.includes('music-battle.wav')), false);
  assert.equal(tracks.some(track => track.source.includes('music-boss.wav')), false);
  assert.equal(prologueTracks.length, 2);
  assert.equal(defeat.loop, false);
  audio.unlock();
  audio.setScene('battle');
  assert.equal(battle.playing, true);
  audio.setScene('boss');
  assert.equal(prologueTracks[1].playing, true);
  audio.setScene('defeat');
  assert.equal(defeat.playing, true);
  audio.setScene('village');
  assert.equal(defeat.playing, false);
  assert.equal(village.playing, true);
  audio.setScene('defeat');
  assert.equal(defeat.playing, true);
  audio.setEnabled(false);
});

test('background image warming deduplicates decode work', async () => {
  let decodes = 0;
  class FakeImage {
    decode() { decodes += 1; return Promise.resolve(); }
  }
  const { warmImage } = await import('../src/core/assets.js');
  const [first, second] = await Promise.all([
    warmImage('test-room.jpg', { ImageClass: FakeImage }),
    warmImage('test-room.jpg', { ImageClass: FakeImage })
  ]);
  assert.equal(first, second);
  assert.equal(decodes, 1);
  assert.equal(first.src, 'test-room.jpg');
});
