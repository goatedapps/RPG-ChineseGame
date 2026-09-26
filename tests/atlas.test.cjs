const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('Scholar Atlas is limited to the first two regions', async () => {
  const { setAtlasRegion } = await import('../src/ui/atlas.js');
  const shell = new JSDOM('<main class="game-shell"></main>').window.document.querySelector('main');

  setAtlasRegion(shell, 'r1');
  assert.ok(shell.classList.contains('atlas-enabled'));
  assert.ok(shell.classList.contains('atlas-region-r1'));

  setAtlasRegion(shell, 'r2');
  assert.ok(shell.classList.contains('atlas-enabled'));
  assert.ok(shell.classList.contains('atlas-region-r2'));
  assert.ok(!shell.classList.contains('atlas-region-r1'));

  setAtlasRegion(shell, 'r3');
  assert.ok(!shell.classList.contains('atlas-enabled'));
  assert.ok(!shell.classList.contains('atlas-region-r2'));
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

  const shellHtml = fs.readFileSync('game/index.html', 'utf8');
  assert.match(shellHtml, /id="dpad"/);
  assert.match(shellHtml, /id="atlas-menu-toggle"/);
  assert.match(shellHtml, /atlas\.css/);
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
