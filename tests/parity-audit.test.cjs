const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(read(file));

test('battle variants and answer streaks change combat behavior', async () => {
  const { createCreature } = await import('../src/battle/creatures.js');
  const { createBattleState, playerAttack } = await import('../src/battle/battle.js');
  const balance = readJson('content/authored/shared/balance.json');
  const rolls = values => {
    let index = 0;
    return () => values[index++] ?? values.at(-1);
  };
  const golden = createCreature(1, balance, rolls([0, 0, 0.04]));
  const elite = createCreature(1, balance, rolls([0, 0, 0.08]));
  const normal = createCreature(1, balance, rolls([0, 0, 0.5]));
  assert.equal(golden.variant, 'golden');
  assert.equal(golden.fleeAfter, 4);
  assert.equal(elite.variant, 'elite');
  assert.ok(elite.attack > normal.attack && elite.defense > normal.defense);

  const word = { w: '露营' };
  const player = { level: 3 };
  const base = createBattleState(word, { ...normal, maxHp: 999, weak: 'm' });
  const one = playerAttack(base, player, 'm', { correct: true, random: () => 0 });
  const two = playerAttack(one.battle, player, 'm', { correct: true, random: () => 0 });
  const three = playerAttack(two.battle, player, 'm', { correct: true, random: () => 0 });
  assert.equal(three.damage, two.damage + 1);
  assert.equal(playerAttack(three.battle, player, 'm', { correct: false }).battle.streak, 0);
});

test('passages are selected randomly and reset their active villager chain on completion', async () => {
  const { completePassage, selectPassage } = await import('../src/systems/reading.js');
  const groups = [
    { id: 'standard-a', subject: 'Chinese', items: [{}] },
    { id: 'standard-b', subject: 'Chinese', items: [{}] },
    { id: 'higher', subject: 'Higher Chinese', items: [{}] }
  ];
  assert.equal(selectPassage(groups, {}, { random: () => 0.99 }).id, 'standard-b');
  assert.equal(selectPassage(groups, { completed: ['standard-a'] }, { random: () => 0 }).id, 'standard-b');
  const completed = completePassage({ active: 'standard-a', questionCount: 3, results: { 0: {} } }, 'standard-a', 'cave-lantern', { keyItems: [] });
  assert.equal(completed.reading.active, null);
  assert.equal(completed.reading.questionCount, 0);
  assert.deepEqual(completed.reading.results, {});
});

test('wandering villagers restore valid positions and never walk onto the player', async () => {
  const { restoreNpcPositions, wanderNpcs } = await import('../src/world/npcs.js');
  const map = readJson('content/authored/campaign/maps/r1-hub.json');
  const wanderer = map.objects.find(object => object.wander);
  restoreNpcPositions(map, { [wanderer.id]: { x: 15, y: 12, direction: 'right' } });
  assert.deepEqual({ x: wanderer.x, y: wanderer.y, direction: wanderer.direction }, { x: 15, y: 12, direction: 'right' });
  const before = { x: wanderer.x, y: wanderer.y };
  wanderNpcs(map, { x: 16, y: 12 }, {}, () => 0);
  assert.notDeepEqual({ x: wanderer.x, y: wanderer.y }, { x: 16, y: 12 });
  assert.ok(wanderer.x >= 10 && wanderer.x <= 29 && wanderer.y >= 10 && wanderer.y <= 17);
  assert.ok(before.x !== undefined);
});

test('modular shell wires the remaining prototype parity surfaces', () => {
  const gameplay = read('src/gameplay.js');
  const main = read('src/main.js');
  const input = read('src/world/input.js');
  const renderer = read('src/world/renderer.js');
  const css = read('css/stage.css');
  const map = readJson('content/authored/campaign/maps/r1-hub.json');
  assert.ok(map.objects.filter(object => object.wander).length >= 5);
  assert.ok(map.passageVillagers.length >= 3);
  for (const feature of ['enemySpell', 'data-higher-chinese', 'levelUpMarkup', 'item-icon', 'Most-missed words']) assert.match(gameplay, new RegExp(feature));
  assert.match(main, /60000/);
  assert.match(main, /wanderNpcs/);
  assert.match(input, /setInterval\(\(\) => move/);
  assert.match(renderer, /fillText\('\?'/);
  assert.match(css, /creature-card\.golden/);
  assert.match(css, /passage-scroll/);
});
