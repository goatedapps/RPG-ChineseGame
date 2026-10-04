const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('Scholar Atlas stays active across all seven regions', async () => {
  const { setAtlasRegion } = await import('../src/ui/atlas.js');
  const shell = new JSDOM('<main class="game-shell"></main>').window.document.querySelector('main');

  setAtlasRegion(shell, 'r1');
  assert.ok(shell.classList.contains('atlas-enabled'));
  assert.ok(shell.classList.contains('atlas-region-r1'));

  setAtlasRegion(shell, 'r2');
  assert.ok(shell.classList.contains('atlas-enabled'));
  assert.ok(shell.classList.contains('atlas-region-r2'));
  assert.ok(!shell.classList.contains('atlas-region-r1'));

  for (const id of ['r3', 'r4', 'r5', 'r6', 'r7']) {
    setAtlasRegion(shell, id);
    assert.ok(shell.classList.contains('atlas-enabled'));
    assert.ok(shell.classList.contains(`atlas-region-${id}`));
    assert.equal([...shell.classList].filter(name => name.startsWith('atlas-region-')).length, 1);
  }
  setAtlasRegion(shell, 'unknown');
  assert.ok(!shell.classList.contains('atlas-enabled'));
});

test('Atlas menu expands accessibly while preserving the world controls', async () => {
  const { bindAtlasMenu } = await import('../src/ui/atlas.js');
  const dom = new JSDOM('<main class="game-shell"><button aria-expanded="false" aria-label="Expand menu"><span class="atlas-menu-chevron">›</span><span class="atlas-menu-label">Expand menu</span></button></main>');
  const shell = dom.window.document.querySelector('main');
  const button = dom.window.document.querySelector('button');
  let resizeCount = 0;
  bindAtlasMenu(shell, button, () => { resizeCount += 1; });

  button.click();
  assert.ok(shell.classList.contains('atlas-menu-expanded'));
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'Collapse menu');
  button.click();
  assert.ok(!shell.classList.contains('atlas-menu-expanded'));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(resizeCount, 2);

  const shellHtml = fs.readFileSync('index.html', 'utf8');
  assert.match(shellHtml, /id="dpad"/);
  assert.match(shellHtml, /id="atlas-menu-toggle"/);
  assert.match(shellHtml, /atlas\.css/);
});

test('sidebar panels explain why they cannot replace a live battle or locked activity', async () => {
  const { guardAtlasPanels } = await import('../src/ui/atlas.js');
  const dom = new JSDOM('<nav id="game-menus"><button id="atlas-menu-toggle"></button><button id="book-button"></button><button id="character-button"></button><button id="bag-button"></button><button id="room-button"></button><button id="daily-button"></button><button id="story-button"></button><button id="dictation-button"></button><button id="parent-button"></button><button id="sound-button"></button></nav>');
  const menu = dom.window.document.querySelector('#game-menus');
  let battleActive = false;
  let lockedOverlay = false;
  let opened = 0;
  let blocked = 0;
  guardAtlasPanels(menu, () => !battleActive && !lockedOverlay, () => { blocked += 1; });
  const panels = [...menu.querySelectorAll('button:not(#atlas-menu-toggle):not(#sound-button)')];
  panels.forEach(button => button.addEventListener('click', () => { opened += 1; }));
  const book = dom.window.document.querySelector('#book-button');
  book.click();
  assert.equal(opened, 1);
  battleActive = true;
  panels.forEach(button => button.click());
  assert.equal(opened, 1);
  assert.equal(blocked, panels.length);
  battleActive = false;
  lockedOverlay = true;
  panels.forEach(button => button.click());
  assert.equal(opened, 1);
  assert.equal(blocked, panels.length * 2);
  dom.window.document.querySelector('#sound-button').click();
  lockedOverlay = false;
  panels.forEach(button => button.click());
  assert.equal(opened, panels.length + 1);
  assert.equal(blocked, panels.length * 2);
});

test('wide layouts can start with the Atlas menu expanded', async () => {
  const { bindAtlasMenu } = await import('../src/ui/atlas.js');
  const dom = new JSDOM('<main class="game-shell"><button><span class="atlas-menu-chevron"></span><span class="atlas-menu-label"></span></button></main>');
  const shell = dom.window.document.querySelector('main');
  const button = dom.window.document.querySelector('button');
  bindAtlasMenu(shell, button, () => {}, true);
  assert.ok(shell.classList.contains('atlas-menu-expanded'));
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'Collapse menu');
});

test('curriculum selection uses Atlas chrome without placeholder player stats', async () => {
  const { setAtlasRegion } = await import('../src/ui/atlas.js');
  const html = fs.readFileSync('index.html', 'utf8');
  const styles = fs.readFileSync('css/atlas.css', 'utf8');
  const shell = new JSDOM(html).window.document.querySelector('.game-shell');
  assert.ok(shell.classList.contains('atlas-pregame'));
  assert.match(styles, /\.atlas-pregame \.hud-status,[\s\S]*?\.atlas-pregame \.hud-actions,[\s\S]*?display: none/);
  setAtlasRegion(shell, 'r3');
  assert.ok(!shell.classList.contains('atlas-pregame'));
  assert.ok(shell.classList.contains('atlas-region-r3'));
});
