const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

test('route access closes exactly at the daily cap and reopens after parent credit or midnight', async () => {
  const { battlesLeft, useBattle } = await import('../src/systems/energy.js');
  const day = '2026-09-27';
  const last = useBattle({ day, used: 29 }, day, 30);
  assert.equal(last.allowed, true);
  assert.equal(battlesLeft(last.energy, day, 30), 0);
  assert.equal(useBattle(last.energy, day, 30).allowed, false);
  assert.equal(battlesLeft({ day, used: 25 }, day, 30), 5);
  assert.equal(battlesLeft(last.energy, '2026-09-28', 30), 30);
  assert.equal(battlesLeft(last.energy, day, 0), Infinity);
});

test('the final field battle returns to the Inn and zero quota blocks re-entry', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  assert.match(main, /function showBattleQuotaNotice\(\)/);
  assert.match(main, /if \(active\.levelPackage\.map\.route\) changeRoute\('rest'\)/);
  assert.match(main, /direction === 'enter' \|\| direction === 'back'/);
  assert.match(main, /active\.levelPackage\.map\.route && gameplay\.battlesLeft\(\) === 0/);
  assert.match(gameplay, /battle\.lastDailyBattle = !guided && cap !== 0 && energy\.energy\.used >= cap/);
  assert.match(gameplay, /battleInProgress: \(\) => battleActive/);
  assert.match(main, /if \(gameplay\?\.battleInProgress\(\)\) return;[\s\S]*?gameplay\.battlesLeft\(\) === 0/);
  assert.match(gameplay, /data-battle-win-next/);
});

test('the quota Continue button closes its non-dismissible notice', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<button id="return-focus">Map</button><div id="overlay" hidden></div>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
    overlay.open('<div class="panel"><button data-close-overlay>Continue at the Inn</button></div>', { dismissible: false });
    assert.equal(overlay.isOpen, true);
    dom.window.document.querySelector('[data-close-overlay]').click();
    assert.equal(overlay.isOpen, false);
  } finally {
    global.document = previousDocument;
  }
});
