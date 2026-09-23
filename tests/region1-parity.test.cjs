const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('modular game shell exposes Region 1 services and local writing runtime', () => {
  const html = fs.readFileSync(path.join(root, 'game', 'index.html'), 'utf8');
  const dom = new JSDOM(html);
  assert.ok(dom.window.document.querySelector('#book-button'));
  assert.ok(dom.window.document.querySelector('#parent-button'));
  assert.equal(dom.window.document.querySelector('script[src*="hanzi-writer.min.js"]').getAttribute('src'), '../vendor/hanzi-writer/hanzi-writer.min.js');
});

test('creature difficulty rises sharply across the three Region 1 lessons', async () => {
  const { createCreature } = await import('../src/battle/creatures.js');
  const balance = readJson('content/authored/shared/balance.json');
  const first = createCreature(1, balance, () => 0);
  const second = createCreature(2, balance, () => 0);
  const third = createCreature(3, balance, () => 0);
  assert.equal(first.level, 1);
  assert.equal(second.level, 5);
  assert.equal(third.level, 9);
  assert.ok(first.maxHp < second.maxHp && second.maxHp < third.maxHp);
  assert.ok(first.attack < second.attack && second.attack < third.attack);
  assert.ok(first.defense < second.defense && second.defense < third.defense);
});

test('combat damage uses attacker, defender, move bonus, and a roll', async () => {
  const { calculateDamage } = await import('../src/battle/damage.js');
  const base = calculateDamage({ attack: 12, defense: 6, roll: 0 });
  assert.equal(calculateDamage({ attack: 12, defense: 10, roll: 0 }) < base, true);
  assert.equal(calculateDamage({ attack: 12, defense: 6, moveBonus: 3, roll: 0 }), base + 3);
  assert.equal(calculateDamage({ attack: 1, defense: 99, roll: 0 }), 1);
});

test('daily energy blocks only battles after the parent cap', async () => {
  const { battlesLeft, useBattle } = await import('../src/systems/energy.js');
  let energy = { day: '', used: 99 };
  for (let count = 0; count < 3; count += 1) {
    const result = useBattle(energy, '2026-09-24', 3);
    assert.equal(result.allowed, true);
    energy = result.energy;
  }
  assert.equal(battlesLeft(energy, '2026-09-24', 3), 0);
  assert.equal(useBattle(energy, '2026-09-24', 3).allowed, false);
  assert.equal(battlesLeft(energy, '2026-09-25', 3), 3);
});

test('School rewards only the first three daily runs while XP can continue', async () => {
  const { schoolRun } = await import('../src/systems/school.js');
  let school;
  const rewarded = [];
  for (let count = 0; count < 5; count += 1) {
    const result = schoolRun(school, '2026-09-24', 3);
    school = result.school;
    rewarded.push(result.rewarded);
  }
  assert.deepEqual(rewarded, [true, true, true, false, false]);
  assert.equal(school.runs, 5);
});

test('Rice Balls use coins, stack in inventory, and never overheal', async () => {
  const { buyItem, useHealingItem } = await import('../src/systems/economy.js');
  const item = readJson('content/authored/shared/balance.json').items['rice-ball'];
  const purchase = buyItem({ coins: 30, hp: 4, maxHp: 20 }, {}, 'rice-ball', item);
  assert.equal(purchase.ok, true);
  assert.equal(purchase.player.coins, 5);
  assert.equal(purchase.inventory['rice-ball'], 1);
  const used = useHealingItem(purchase.player, purchase.inventory, 'rice-ball', item);
  assert.equal(used.player.hp, 14);
  assert.equal(used.inventory['rice-ball'], 0);
});

test('finishing a passage chain records completion and grants the Cave Lantern once', async () => {
  const { completePassage } = await import('../src/systems/reading.js');
  const first = completePassage({}, 'CH-G1', 'cave-lantern', { keyItems: [] });
  const second = completePassage(first.reading, 'CH-G1', 'cave-lantern', first.inventory);
  assert.deepEqual(second.reading.completed, ['CH-G1']);
  assert.deepEqual(second.inventory.keyItems, ['cave-lantern']);
});

test('schema 2 modular saves migrate without losing progress', async () => {
  const { migrateState, SAVE_SCHEMA_VERSION } = await import('../src/core/state.js');
  const levelPackage = {
    id: 'p5', content: { contentVersion: 'new' },
    map: { id: 'r1-hub', width: 40, height: 28, spawn: { x: 20, y: 14 } }
  };
  const old = {
    schemaVersion: 2, level: 'p5', player: { level: 4, coins: 77, x: 18, y: 12 },
    progress: { words: { '露营': { collected: true } }, battles: 9 }, settings: { dailyBattles: 20 }
  };
  const migrated = migrateState(old, levelPackage);
  assert.equal(SAVE_SCHEMA_VERSION, 3);
  assert.equal(migrated.player.level, 4);
  assert.equal(migrated.player.coins, 77);
  assert.equal(migrated.progress.words['露营'].collected, true);
  assert.equal(migrated.progress.battles, 9);
  assert.equal(migrated.settings.dailyBattles, 20);
  assert.equal(migrated.progress.inventory['rice-ball'], 1);
});
