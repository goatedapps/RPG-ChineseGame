const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const prototypeRoot = path.join(root, 'prototype');
const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(prototypeRoot, 'styles.css'), 'utf8');
const gameSource = fs.readFileSync(path.join(prototypeRoot, 'app.js'), 'utf8');
const audioSource = fs.readFileSync(path.join(prototypeRoot, 'audio.js'), 'utf8');
const contentSource = fs.readFileSync(path.join(prototypeRoot, 'data', 'content.js'), 'utf8');
const hanziSource = fs.readFileSync(path.join(prototypeRoot, 'data', 'hanzi.js'), 'utf8');
const vendorSource = fs.readFileSync(path.join(prototypeRoot, 'vendor', 'hanzi-writer.min.js'), 'utf8');
const agentsSource = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
const dom = new JSDOM(html);

function assignedJson(source, declaration) {
  assert.ok(source.startsWith(declaration), `found ${declaration}`);
  return JSON.parse(source.slice(declaration.length).trim().replace(/;$/, ''));
}

test('prototype shell and modular scripts parse successfully', () => {
  assert.equal(dom.window.document.querySelector('#cv')?.tagName, 'CANVAS');
  assert.ok(dom.window.document.querySelector('#objectiveText'));
  assert.ok(dom.window.document.querySelector('#hXpT'));
  assert.equal(dom.window.document.querySelectorAll('#dpad button').length, 4);
  assert.doesNotThrow(() => new vm.Script(gameSource));
  assert.doesNotThrow(() => new vm.Script(audioSource));
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('script[src]')].map(script => script.getAttribute('src')),
    ['vendor/hanzi-writer.min.js', 'data/content.js', 'data/hanzi.js', 'audio.js', 'app.js'],
  );
});

test('prototype reaches the level picker without a startup error', async () => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const runtime = new JSDOM(html, {
    runScripts: 'outside-only',
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
  runtime.window.eval(vendorSource);
  runtime.window.eval(contentSource);
  runtime.window.eval(hanziSource);
  runtime.window.eval(audioSource);
  runtime.window.eval(gameSource);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(errors.map(error => error.message), []);
  assert.match(runtime.window.document.querySelector('#ov').textContent, /Choose your level/);
  runtime.window.document.querySelector('[data-l="p5"]').click();
  assert.match(runtime.window.document.querySelector('#ov').textContent, /Grandma Wang/);
  assert.equal(runtime.window.document.querySelector('#hLevel').textContent, 'P5');
  runtime.window.document.querySelector('#bParent').click();
  assert.match(runtime.window.document.querySelector('#ov').textContent, /Parent PIN/);
  runtime.window.document.querySelector('#parentPin').value = '1056';
  runtime.window.document.querySelector('#unlockParent').click();
  assert.match(runtime.window.document.querySelector('#ov').textContent, /Parent Panel/);
  runtime.window.document.querySelector('#chgPin').click();
  runtime.window.document.querySelector('#oldPin').value = '1056';
  runtime.window.document.querySelector('#newPin').value = '2468';
  runtime.window.document.querySelector('#confirmPin').value = '2468';
  runtime.window.document.querySelector('#savePin').click();
  const storedPin = runtime.window.localStorage.getItem('wsq-parent-pin-v1');
  assert.match(storedPin, /^PIN1\.[0-9a-f]{8}$/);
  assert.doesNotMatch(storedPin, /1056|2468/);
  assert.deepEqual(errors.map(error => error.message), []);
  runtime.window.close();
});

test('all regional vocabulary and handwriting data remain available externally', () => {
  const data = assignedJson(contentSource, 'window.GAME_DATA=');
  const charData = assignedJson(hanziSource, 'window.HANZI_DATA=');
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
  assert.match(gameSource, /2:\{minCreature:5,maxCreature:8\}/);
  assert.match(gameSource, /3:\{minCreature:9,maxCreature:12\}/);
  assert.match(gameSource, /const heroStats=.*attack:3\+level\*3.*defense:level\*2.*evasion:/);
  assert.match(gameSource, /function damageRoll\(attack,defense,bonus=0\)/);
  assert.match(gameSource, /mitigation=Math\.floor\(defense\*\.65\)/);
  assert.match(gameSource, /damageRoll\(hero\.attack,B\.defense,bonus\)/);
  assert.match(gameSource, /damageRoll\(B\.attack,hero\.defense\)/);
  assert.match(gameSource, /`HP \$\{B\.hp\}\/\$\{B\.max\}`/);
  assert.doesNotMatch(gameSource, /lessonUnlocked|lessonGateText|LESSON_GATE_PCT/);
  assert.doesNotMatch(gameSource, /map\[16\]\[28\]='2'|map\[22\]\[20\]='3'/);
  assert.match(gameSource, /S\.baits\.splice\(baitIndex,1\)/);
  assert.match(gameSource, /data-bait=/);
  assert.match(gameSource, /function objectiveTasks\(\)/);
  assert.match(gameSource, /Explore \$\{z\.n\} and collect Lesson \$\{z\.l\} spirits/);
  assert.match(gameSource, /Take a rewarded quiz or tingxie session at School/);
  assert.match(gameSource, /Hear an unread story from the Storyteller/);
  assert.match(gameSource, /setInterval\(\(\)=>\{if\(LEVEL\)updateObjective\(true\)\},60000\)/);
});

test('primary controls meet the 44 pixel touch target baseline', () => {
  assert.match(css, /\.hbtn\{[^}]*min-height:44px/);
  assert.match(css, /\.close\{[^}]*width:44px;height:44px/);
  assert.match(css, /\.speak\{[^}]*min-height:44px/);
});

test('tablet d-pad, expanded world, and scene audio are connected', () => {
  assert.equal(dom.window.document.querySelectorAll('#dpad button').length, 4);
  assert.equal(dom.window.document.querySelector('#joystick'), null);
  assert.match(css, /\.dpad\{[^}]*position:absolute[^}]*touch-action:none/);
  assert.match(css, /\.dpad button\{[^}]*font-size:23px/);
  assert.match(gameSource, /document\.querySelectorAll\('#dpad button'\)/);
  assert.match(gameSource, /MW=52, MH=38/);
  assert.match(gameSource, /rect\(29,6,MW-31,MH-8,'b'\)/);
  assert.match(gameSource, /GameAudio\.setScene\('battle'\)/);
  assert.match(gameSource, /GameAudio\.setScene\('boss'\)/);
  assert.match(gameSource, /GameAudio\.setScene\('village'\)/);
  assert.match(audioSource, /village:/);
  assert.match(audioSource, /battle:/);
  assert.match(audioSource, /boss:/);
  assert.doesNotMatch(audioSource, /createOscillator|setInterval\(musicTick/);
});

test('Scholar Village has a larger lore and guidance cast', () => {
  for (const name of ['Auntie Bao', 'Old Chen', 'Ranger Rui', 'Postman Bo', 'Little Min', 'Gardener Lan', 'Apprentice Jun']) {
    assert.match(gameSource, new RegExp(name));
  }
  assert.match(gameSource, /const AMBIENT_DIALOGUE=/);
  assert.match(gameSource, /const AMBIENT_AFTER_BOSS=/);
  assert.match(gameSource, /seven great settlements/);
  assert.match(gameSource, /Muddle King once forgot his birthday/);
  assert.match(gameSource, /S\.boss&&AMBIENT_AFTER_BOSS\[n\.id\]/);
  assert.match(gameSource, /if\(ambient\)dialog\(n\.n,pick\(ambient\)\)/);
  assert.match(gameSource, /wander:true/);
  assert.match(gameSource, /function updateNPCs\(\)/);
  assert.match(gameSource, /n\.step\+=\.04/);
});

test('shop uses the generated item icon atlas', () => {
  const atlas = fs.readFileSync(path.join(prototypeRoot, 'assets', 'item-icons.png'));
  assert.equal(atlas.subarray(1, 4).toString(), 'PNG');
  assert.equal(atlas[25], 6, 'atlas uses RGBA transparency');
  assert.ok(atlas.length > 500_000);
  assert.match(css, /background-image:url\('assets\/item-icons\.png'\)/);
  assert.match(gameSource, /item-icon rice/);
  assert.match(gameSource, /item-icon noodles/);
  assert.match(gameSource, /item-icon bait-\$\{zone\}/);
  assert.match(gameSource, /item-icon hat-\$\{k\}/);
  for (const name of ['rice', 'noodles', 'bait-a', 'bait-b', 'bait-c', 'hat-red', 'hat-bamboo', 'hat-crown'])assert.match(css,new RegExp(`\\.item-icon\\.${name}`));
});

test('parent panel requires an encoded changeable PIN', () => {
  assert.match(gameSource, /DEFAULT_PARENT_PIN='1056'/);
  assert.match(gameSource, /encodeParentPin=pin=>'PIN1\.'\+fnv\(PARENT_PIN_SALT\+pin\)/);
  assert.match(gameSource, /function openParentGate\(\)/);
  assert.match(gameSource, /function openChangeParentPin\(\)/);
  assert.match(gameSource, /localStorage\.setItem\(PARENT_PIN_KEY,encodeParentPin\(pin\)\)/);
});

test('wild encounters transition into battle and creature hits have audio feedback', () => {
  assert.match(gameSource, /function playEncounterTransition\(type,onReady\)/);
  assert.match(gameSource, /encounter-callout/);
  assert.match(gameSource, /playEncounterTransition\(type,\(\)=>\{openOv/);
  assert.match(css, /@keyframes encounter-open/);
  assert.match(css, /@keyframes encounter-pop/);
  assert.match(gameSource, /function hitMon\(\)\{GameAudio\.sfx\('hit'\)/);
  assert.match(audioSource, /hit: 'sounds\/creature-hit\.wav'/);
  const hit = fs.readFileSync(path.join(prototypeRoot, 'sounds', 'creature-hit.wav'));
  assert.equal(hit.subarray(0, 4).toString(), 'RIFF');
  assert.equal(hit.subarray(8, 12).toString(), 'WAVE');
  assert.ok(hit.length > 20_000);
});

test('agent guidance provides a concise operational handoff', () => {
  assert.ok(agentsSource.split(/\r?\n/).length <= 200);
  assert.match(agentsSource, /## Start here/);
  assert.match(agentsSource, /## Repository map/);
  assert.match(agentsSource, /## Product invariants/);
  assert.match(agentsSource, /physical child-and-parent tablet pilot/);
  assert.match(agentsSource, /content\/authored\/campaign/);
});

test('packaged sound effects and mixed music loops are available', () => {
  const sounds = path.join(prototypeRoot, 'sounds');
  const effects = [
    'bag-open.mp3', 'button.mp3', 'correct.mp3', 'enter-shop.mp3', 'good-result.mp3',
    'level-up.mp3', 'need-improvement.mp3', 'purchase.mp3', 'wrong-answer.mp3',
  ];
  for (const name of effects) {
    const file = path.join(sounds, name);
    assert.ok(fs.statSync(file).size > 4000, `${name} is a non-empty packaged effect`);
    assert.match(audioSource, new RegExp(name.replace('.', '\\.')));
  }
  for (const name of ['music-village.wav', 'music-battle.wav', 'music-boss.wav']) {
    const file = path.join(sounds, name);
    const buffer = fs.readFileSync(file);
    assert.equal(buffer.subarray(0, 4).toString(), 'RIFF');
    assert.equal(buffer.subarray(8, 12).toString(), 'WAVE');
    assert.ok(buffer.length > 1_000_000, `${name} contains the full mixed loop`);
    assert.match(audioSource, new RegExp(name.replace('.', '\\.')));
  }
});
