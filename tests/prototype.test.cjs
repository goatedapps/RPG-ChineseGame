const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'prototype', 'index.html'), 'utf8');
const dom = new JSDOM(html);
const scripts = [...dom.window.document.querySelectorAll('script')];
const gameSource = scripts.at(-1).textContent;

function jsonConstant(source, declaration, followingMarker) {
  const start = source.indexOf(declaration) + declaration.length;
  const end = source.indexOf(followingMarker, start);
  assert.ok(start >= declaration.length && end > start, `found ${declaration}`);
  return JSON.parse(source.slice(start, end).trim().replace(/;$/, ''));
}

test('prototype HTML and embedded game script parse successfully', () => {
  assert.equal(dom.window.document.querySelector('#cv')?.tagName, 'CANVAS');
  assert.ok(dom.window.document.querySelector('#objectiveText'));
  assert.ok(dom.window.document.querySelector('#hXpT'));
  assert.doesNotThrow(() => new vm.Script(gameSource));
});

test('prototype reaches the level picker without a startup error', async () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const runtime = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.speechSynthesis = { cancel() {}, speak() {} };
      window.SpeechSynthesisUtterance = class {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, {
        get(target, property) {
          if (property === 'createLinearGradient' || property === 'createRadialGradient') {
            return () => ({ addColorStop() {} });
          }
          if (property === 'measureText') return () => ({ width: 10 });
          return target[property] || (() => {});
        },
        set(target, property, value) {
          target[property] = value;
          return true;
        },
      });
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(runtime.window.document.querySelector('#ov').textContent, /Choose your level/);
  assert.deepEqual(errors.map(error => error.message), []);
  runtime.window.close();
});

test('all regional vocabulary and handwriting data remain embedded', () => {
  const data = jsonConstant(gameSource, 'const DATA = ', '\n/* ================= constants');
  const charData = jsonConstant(gameSource, 'const CHARDATA=', '\nconst REVIEW_DAYS');
  assert.equal(data.words.length, 54);
  assert.deepEqual([...new Set(data.words.map(word => word.l))], [1, 2, 3]);
  for (const word of data.words) {
    assert.equal(word.sb.length, 5, `${word.w} keeps five example sentences`);
    for (const character of [...word.w]) {
      assert.ok(charData[character], `${character} has embedded stroke data`);
    }
  }
});

test('save codec round-trips Unicode progress and detects edits', () => {
  const start = gameSource.indexOf("const SAVE_SALT=");
  const end = gameSource.indexOf('let profile=', start);
  const context = {
    TextEncoder,
    TextDecoder,
    Uint8Array,
    btoa,
    atob,
  };
  vm.createContext(context);
  vm.runInContext(`${gameSource.slice(start, end)}\nthis.codec={encodeSave,decodeSave};`, context);
  const state = { level: 'p5', words: { '齐心协力': { c: 1 } }, coins: 42 };
  const encoded = context.codec.encodeSave(state);
  assert.deepEqual(JSON.parse(JSON.stringify(context.codec.decodeSave(encoded))), state);
  const changed = encoded.replace(/.$/, encoded.endsWith('0') ? '1' : '0');
  assert.equal(context.codec.decodeSave(changed).tampered, true);
});

test('read-aloud buttons toggle to Stop and can cancel playback', () => {
  const start = gameSource.indexOf('let activeSpeechButton=');
  const end = gameSource.indexOf('window.speak=speak;', start) + 'window.speak=speak;'.length;
  class Utterance {}
  const synth = {
    cancelCount: 0,
    cancel() { this.cancelCount++; },
    speak(utterance) { this.last = utterance; },
  };
  const context = {
    window: { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance },
    speechSynthesis: synth,
    SpeechSynthesisUtterance: Utterance,
    toast() {},
  };
  vm.createContext(context);
  vm.runInContext(`${gameSource.slice(start, end)}\nthis.audio={speak,stopSpeaking};`, context);
  const button = {
    textContent: 'Read this page aloud',
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  assert.equal(context.audio.speak('你好', button), true);
  assert.equal(button.textContent, 'Stop');
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.equal(context.audio.speak('你好', button), false);
  assert.equal(button.textContent, 'Read this page aloud');
  assert.equal(button.attributes['aria-pressed'], 'false');
  context.audio.speak('再见', button);
  synth.last.onend();
  assert.equal(button.textContent, 'Read this page aloud');
});

test('approved progression and reward rules are wired into the prototype', () => {
  assert.match(gameSource, /const GATE_SILVER_PCT=\.22/);
  assert.match(gameSource, /Math\.ceil\(WORDS\.length\*GATE_SILVER_PCT\)/);
  assert.match(gameSource, /const REVIEW_DAYS=3, REVIEW_MAX_DAYS=30/);
  assert.match(gameSource, /Math\.min\(REVIEW_MAX_DAYS,/);
  assert.match(gameSource, /else record\(B\.word\.w,'w',false,B\.bid\)/);
  assert.match(gameSource, /S\.school=\{\.\.\.S\.school,day:today\(\),runs:0\}/);
  assert.match(gameSource, /Instant Noodles<small>\+20 HP/);
  assert.match(gameSource, /data-buy="noodles"[^>]*>50 coins/);
  assert.match(gameSource, /Higher Chinese Challenge/);
  assert.match(gameSource, /this does not affect the Cave Lantern or any gate/);
  assert.match(gameSource, /showLevelUp\(up,/);
  assert.match(gameSource, /function openOv\(html,dim\)\{stopSpeaking\(\)/);
  assert.match(gameSource, /function closeOv\(\)\{stopSpeaking\(\)/);
});

test('primary controls meet the 44 pixel touch target baseline', () => {
  const css = [...dom.window.document.querySelectorAll('style')].map(node => node.textContent).join('\n');
  assert.match(css, /\.hbtn\{[^}]*min-height:44px/);
  assert.match(css, /\.close\{[^}]*width:44px;height:44px/);
  assert.match(css, /\.speak\{[^}]*min-height:44px/);
});
