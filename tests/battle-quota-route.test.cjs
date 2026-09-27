const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  assert.match(gameplay, /battle\.lastDailyBattle = cap !== 0 && energy\.energy\.used >= cap/);
  assert.match(gameplay, /data-battle-win-next/);
});
