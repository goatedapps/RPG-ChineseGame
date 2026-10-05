const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(read(file));

test('P5 practical content excludes passages whose source poster is missing', () => {
  const source = read('content/source/p5/questions/practical.yaml');
  const generated = read('content/generated/p5.content.json');
  assert.doesNotMatch(source, /儿童歌唱训练班/);
  assert.doesNotMatch(generated, /儿童歌唱训练班/);
  assert.doesNotMatch(generated, /本题根据相关通告\/海报内容作答/);
});

test('battle variants and answer streaks change combat behavior', async () => {
  const { CREATURE_VARIANTS, createCreature, creatureVariantNote } = await import('../src/battle/creatures.js');
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
  assert.equal(CREATURE_VARIANTS.golden.chance, 0.05);
  assert.equal(CREATURE_VARIANTS.elite.chance, 0.08);
  assert.equal(createCreature(1, balance, rolls([0, 0, 0.05])).variant, 'elite');
  assert.equal(createCreature(1, balance, rolls([0, 0, 0.13])).variant, 'normal');
  assert.match(creatureVariantNote('elite'), /8 extra HP.*2 extra ATK.*1 extra DEF.*6 bonus coins/);
  assert.match(creatureVariantNote('golden'), /fourth attack.*12 bonus coins/);

  const word = { w: '露营' };
  const player = { level: 3 };
  const base = createBattleState(word, { ...normal, maxHp: 999, weak: 'm' });
  const one = playerAttack(base, player, 'm', { correct: true, random: () => 0 });
  const two = playerAttack(one.battle, player, 'm', { correct: true, random: () => 0 });
  const three = playerAttack(two.battle, player, 'm', { correct: true, random: () => 0 });
  assert.equal(three.damage, two.damage + 1);
  assert.equal(playerAttack(three.battle, player, 'm', { correct: false }).battle.streak, 0);
});

test('rare creature rules are explained at the encounter and in the collection', async () => {
  const { creatureCollectionMarkup } = await import('../src/ui/creatureCollection.js');
  const markup = creatureCollectionMarkup({ state: { progress: { creatures: {} } }, levelPackage: { companions: {}, campaigns: {}, region: { id: 'r1' } } });
  assert.match(markup, /Elite and Golden creatures/);
  assert.match(markup, /about 8% of encounters/);
  assert.match(markup, /about 5%/);
  assert.match(markup, /Win the battle to add that creature to your collection/);
  const gameplay = read('src/gameplay.js');
  assert.match(gameplay, /class="battle-variant-note">\$\{creatureVariantNote\(creature\.variant\)\}/);
});

test('passages are selected randomly, repair stale counts, and reset their villager chain', async () => {
  const { completePassage, repairActiveReading, selectPassage } = await import('../src/systems/reading.js');
  const groups = [
    { id: 'standard-a', subject: 'Chinese', items: [{}] },
    { id: 'standard-b', subject: 'Chinese', items: [{}] },
    { id: 'higher', subject: 'Higher Chinese', items: [{}] }
  ];
  assert.equal(selectPassage(groups, {}, { random: () => 0.99 }).id, 'standard-b');
  assert.equal(selectPassage(groups, { completed: ['standard-a'] }, { random: () => 0 }).id, 'standard-b');
  const repaired = repairActiveReading({ active: 'standard-a', questionCount: 0, results: { 0: { correct: true }, 1: { correct: false }, 2: { correct: true }, 9: { correct: true } } }, { id: 'standard-a', items: [{}, {}, {}] }, 7);
  assert.equal(repaired.questionCount, 3);
  assert.deepEqual(Object.keys(repaired.results), ['0', '2']);
  const completed = completePassage({ active: 'standard-a', questionCount: 3, results: { 0: {} } }, 'standard-a', 'cave-lantern', { keyItems: [] });
  assert.equal(completed.reading.active, null);
  assert.equal(completed.reading.questionCount, 0);
  assert.deepEqual(completed.reading.results, {});
});

test('wandering villagers restore valid positions and never walk onto the player', async () => {
  const { restoreNpcPositions, wanderNpcs } = await import('../src/world/npcs.js');
  const map = readJson('content/authored/campaign/maps/r1-hub.json');
  const wanderer = map.objects.find(object => object.wander);
  const home = { x: wanderer.x, y: wanderer.y };
  restoreNpcPositions(map, { [wanderer.id]: { x: home.x + 1, y: home.y, direction: 'right' } });
  assert.deepEqual({ x: wanderer.x, y: wanderer.y, direction: wanderer.direction }, { x: home.x + 1, y: home.y, direction: 'right' });
  const before = { x: wanderer.x, y: wanderer.y };
  wanderNpcs(map, { x: home.x + 2, y: home.y }, {}, () => 0);
  assert.notDeepEqual({ x: wanderer.x, y: wanderer.y }, { x: home.x + 2, y: home.y });
  assert.ok(Math.abs(wanderer.x - home.x) + Math.abs(wanderer.y - home.y) <= 4);
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
  assert.match(main, /const step = tutorial\?\.objective\(\) \|\| nextStep\(active\.levelPackage, active\.state\)/);
  assert.match(main, /wanderNpcs/);
  assert.match(input, /setInterval\(\(\) => move/);
  assert.match(renderer, /fillText\('\?'/);
  assert.match(css, /creature-card\.golden/);
  assert.match(css, /passage-scroll/);
});
