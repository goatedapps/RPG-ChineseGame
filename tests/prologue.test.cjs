const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

test('startup prologue carries the core story and packaged media', async () => {
  const { PROLOGUE_SLIDES } = await import('../src/ui/prologue.js');
  const story = PROLOGUE_SLIDES.map(slide => `${slide.title} ${slide.body}`).join(' ');
  assert.equal(PROLOGUE_SLIDES.length, 5);
  for (const phrase of ['Word Spirit', '字灵', 'Great Dictionary Tree', '字典树', 'Great Forgetter', '遗忘大王', 'Spirit Brush']) assert.match(story, new RegExp(phrase));
  for (const image of new Set(PROLOGUE_SLIDES.map(slide => slide.image))) assert.equal(fs.existsSync(path.join(root, image.replace('../', ''))), true, image);
  assert.equal(fs.existsSync(path.join(root, 'assets/audio/prologue-bg.mp3')), true);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /id="prologue"/);
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

test('prologue artwork resolves relative to the hosted app, not the CSS folder', async () => {
  const { createPrologue, PROLOGUE_SLIDES } = await import('../src/ui/prologue.js');
  const dom = new JSDOM('<div id="prologue"></div>', { url: 'https://example.com/RPG-ChineseGame/?level=p5' });
  const root = dom.window.document.querySelector('#prologue');
  const prologue = createPrologue({ root, audio: { unlock() {}, setScene() {} }, onComplete() {} });
  assert.match(root.querySelector('.prologue-screen').style.getPropertyValue('--prologue-image'), /\/RPG-ChineseGame\/assets\/images\/intro\/dictionary-tree\.jpg/);
  root.querySelector('[data-prologue-begin]').click();
  for (const slide of PROLOGUE_SLIDES) {
    const image = root.querySelector('.prologue-screen').style.getPropertyValue('--prologue-image');
    assert.ok(image.includes(`https://example.com/RPG-ChineseGame/${slide.image}`), image);
    root.querySelector('[data-prologue-next]').click();
    root.querySelector('[data-prologue-next]').click();
  }
  prologue.finish();
});

test('the opening subtitle carries a StegZero compatibility frame with the hidden message', async () => {
  const { createPrologue } = await import('../src/ui/prologue.js');
  const dom = new JSDOM('<div id="prologue"></div>', { url: 'https://example.com/' });
  const root = dom.window.document.querySelector('#prologue');
  createPrologue({ root, audio: {}, onComplete() {} });
  const subtitle = root.querySelector('.prologue-title-lockup span');
  const visible = 'A story about the words only you can save';
  const source = fs.readFileSync(path.resolve(__dirname, '../src/ui/prologue.js'), 'utf8');
  const hidden = [...subtitle.textContent].filter(character => character === '\u200B' || character === '\u200C');
  const bits = hidden.map(character => character === '\u200B' ? '0' : '1').join('');
  const bytes = bits.match(/.{8}/g).map(byte => Number.parseInt(byte, 2));
  const messageLength = (bytes[5] << 8) | bytes[6];
  let state = ((bytes[3] << 24) | (bytes[4] << 16) | 0xB100) >>> 0;
  let mask = 0;
  let maskBits = 0;
  const decoded = [];
  for (let offset = 11; offset < bytes.length; offset += 1) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      if (maskBits === 0) {
        if (state === 0) state = 0x9E3779B9;
        state ^= state << 13;
        state >>>= 0;
        state ^= state >>> 17;
        state >>>= 0;
        state ^= state << 5;
        state >>>= 0;
        mask = state;
        maskBits = 32;
      }
      const encodedBit = Number(bits[(offset * 8) + bit]);
      byte = (byte << 1) | (encodedBit ^ (mask & 1));
      mask >>>= 1;
      maskBits -= 1;
    }
    decoded.push(byte);
  }
  const message = new TextDecoder().decode(new Uint8Array(decoded));
  let fingerprint = 0x811c9dc5;
  for (const character of message) {
    fingerprint ^= character.charCodeAt(0);
    fingerprint = Math.imul(fingerprint, 0x01000193) >>> 0;
  }
  assert.equal(message.length, 165);
  assert.equal(fingerprint.toString(16), 'db00b089');
  assert.equal(source.includes(message), false);
  assert.equal(subtitle.childNodes.length, 1);
  const selection = dom.window.document.createRange();
  selection.selectNodeContents(subtitle);
  assert.equal(selection.toString(), subtitle.textContent);
  assert.equal(subtitle.textContent.replace(/[\u200B\u200C]/g, ''), visible);
  for (const word of subtitle.textContent.split(' ')) assert.match(word, /^[^\u200B\u200C]+[\u200B\u200C]*$/);
  assert.equal(subtitle.getAttribute('aria-label'), visible);
  assert.equal(bytes[0], 0xB1);
  assert.equal(bytes[1], 0x00);
  assert.equal(bytes[2], 1);
  assert.equal(messageLength, 165);
  assert.equal(hidden.length, (11 + messageLength) * 8);
  assert.ok(subtitle.outerHTML.includes('\u200B'));
});
