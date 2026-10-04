const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const definitions = JSON.parse(fs.readFileSync('content/authored/shared/companions.json', 'utf8'));
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) });
const api = () => import('../src/systems/companions.js');

test('encounters discover creatures immediately, keep the highest level, and upgrade the selected partner', async () => {
  const { discoverCreature, chooseCompanion, activeCompanion } = await api();
  const progress = {};
  assert.equal(chooseCompanion(progress, 'fogling'), false);
  assert.match(discoverCreature(progress, { id: 'fogling', name: 'Fogling', level: 3 }), /discovered/);
  assert.equal(chooseCompanion(progress, 'fogling'), true);
  const before = activeCompanion(progress, definitions);
  assert.equal(discoverCreature(progress, { id: 'fogling', name: 'Fogling', level: 2 }), '');
  assert.equal(discoverCreature(progress, { id: 'fogling', name: 'Fogling', level: 3 }), '');
  assert.match(discoverCreature(progress, { id: 'fogling', name: 'Fogling', level: 8 }), /Lv. 3 → Lv. 8/);
  assert.equal(activeCompanion(progress, definitions).ability.shield, before.ability.shield + 10);
  discoverCreature(progress, { id: 'echo-bat', name: 'Echo Bat', level: 5 });
  chooseCompanion(progress, 'echo-bat');
  assert.equal(progress.creatures.partner, 'echo-bat');
  assert.equal(Object.keys(progress.creatures.collection).length, 2);
  assert.equal(chooseCompanion(progress, 'muddle-king'), false);
  assert.equal(chooseCompanion(progress, null), true);
  assert.equal(activeCompanion(progress, definitions), null);
});

test('all 35 species have distinct named abilities that grow at every level and use packaged art', async () => {
  const { CREATURES } = await import('../src/battle/creatures.js');
  const { creatureAbility } = await api();
  assert.deepEqual(Object.keys(definitions).sort(), CREATURES.map(item => item.id).sort());
  assert.equal(new Set(Object.values(definitions).map(item => item.ability)).size, CREATURES.length);
  const offline = fs.readFileSync('sw.js', 'utf8');
  for (const creature of CREATURES) {
    assert.ok(definitions[creature.id].personality);
    for (let level = 1; level < 70; level++) {
      const current = creatureAbility(definitions[creature.id], level);
      const next = creatureAbility(definitions[creature.id], level + 1);
      assert.notEqual(current.description, next.description, `${creature.id} level ${level}`);
      for (const stat of ['heal', 'shield', 'strike', 'echo', 'leech']) assert.ok(next[stat] >= current[stat]);
    }
    assert.ok(fs.existsSync(`assets/images/creatures/${creature.id}.webp`));
    assert.ok(offline.includes(`assets/images/creatures/${creature.id}.webp`));
  }
  for (const file of ['src/systems/companions.js', 'src/ui/companion.js', 'src/ui/creatureCollection.js', 'content/authored/shared/companions.json']) assert.ok(offline.includes(file));
});

test('abilities activate once, successful attacks consume charges, and healing never exceeds maximum HP', async () => {
  const { activateCompanion, companionStrike, creatureAbility } = await api();
  const battle = {};
  const player = { hp: 10, maxHp: 20 };
  const companion = { ability: creatureAbility(definitions['quarrel-macaque'], 4) };
  assert.equal(activateCompanion(battle, player, companion), true);
  assert.equal(activateCompanion(battle, player, companion), false);
  assert.equal(companionStrike(battle, player, 0), 0);
  assert.equal(battle.companionEffect.hits, 2);
  assert.equal(player.hp, 10);
  assert.equal(companionStrike(battle, player, 7), 12);
  assert.equal(player.hp, 15);
  assert.equal(companionStrike(battle, player, 7), 12);
  assert.equal(player.hp, 20);
  assert.equal(companionStrike(battle, player, 7), 7);
  const healing = { ability: creatureAbility(definitions['chaff-sprite'], 20) };
  activateCompanion({}, player, healing);
  assert.equal(player.hp, 20);
  const echo = {};
  activateCompanion(echo, player, { ability: creatureAbility(definitions['echo-bat'], 5) });
  assert.equal(companionStrike(echo, player, 20), 27);
});

test('shield absorbs a finite pool across hits, prevents lethal damage, and survives dodges', async () => {
  const { companionCounterattack } = await api();
  const creature = { attack: 20 };
  const battle = { creature, companionShield: 30 };
  const player = { level: 1, hp: 2, maxHp: 20 };
  const dodged = companionCounterattack(battle, player, () => 0, { evasionBonus: 0.5 });
  assert.equal(dodged.damage, 0);
  assert.equal(battle.companionShield, 30);
  const guarded = companionCounterattack(battle, player, () => 1, {});
  assert.equal(guarded.player.hp, 2);
  assert.equal(guarded.damage, 0);
  assert.ok(guarded.absorbed > 0);
  const second = companionCounterattack(battle, guarded.player, () => 1, {}, creature);
  assert.ok(second.damage > 0);
  assert.equal(second.player.hp, 0);
  assert.equal(battle.companionShield, 0);
});

test('schema 14 preserves vocabulary, tutorial and creature state through save transfer and region changes', async () => {
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { exportSaveEnvelope, importSaveEnvelope } = await import('../src/core/save.js');
  const { enterRegion } = await import('../src/systems/regions.js');
  const { discoverCreature, chooseCompanion, normalizeCreatures } = await api();
  for (const id of ['p2', 'p5']) {
    const pkg = await loadLevelPackage(id, fetcher, '');
    const old = createFreshState(pkg);
    old.schemaVersion = 13;
    old.progress.partners = ['old-word'];
    delete old.progress.creatures;
    old.progress.words.example = { collected: true, ticks: { m: 1 } };
    old.progress.tutorial.step = 8;
    const state = migrateState(old, pkg);
    assert.equal(state.schemaVersion, 14);
    assert.equal(state.progress.tutorial.step, 8);
    assert.deepEqual(state.progress.words, old.progress.words);
    assert.equal(state.progress.partners, undefined);
    assert.deepEqual(state.progress.creatures, { collection: {}, partner: null });
    discoverCreature(state.progress, { id: 'fogling', name: 'Fogling', level: 7 });
    chooseCompanion(state.progress, 'fogling');
    const transferred = importSaveEnvelope(exportSaveEnvelope(state), pkg);
    enterRegion(transferred, pkg.campaigns.r2);
    assert.deepEqual(transferred.progress.creatures, state.progress.creatures);
    assert.equal(createFreshState(pkg).progress.creatures.partner, null);
  }
  assert.deepEqual(normalizeCreatures({ collection: { fogling: { level: -2 }, 'echo-bat': { level: '7' }, unknown: { level: 20 } }, partner: 'unknown' }), { collection: {}, partner: null });
  assert.deepEqual(normalizeCreatures(null), { collection: {}, partner: null });
});

test('collection cards show exact abilities, select one partner and keep defeated bosses separate', async () => {
  const { createCollection } = await import('../src/collection.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { discoverCreature } = await api();
  const pkg = await loadLevelPackage('p2', fetcher, '');
  const game = { levelPackage: pkg, state: createFreshState(pkg) };
  game.state.progress.story.bossDefeated = true;
  discoverCreature(game.state.progress, { id: 'fogling', name: 'Fogling', level: 3 });
  discoverCreature(game.state.progress, { id: 'echo-bat', name: 'Echo Bat', level: 4 });
  const dom = new JSDOM('<div id="overlay"></div>');
  const before = global.document;
  global.document = dom.window.document;
  try {
    const element = document.querySelector('#overlay');
    let saves = 0;
    const collection = createCollection({ getActive: () => game, overlay: { open(html) { element.innerHTML = html; } }, persist: () => saves++, render() {}, toast() {} });
    collection.creatures();
    assert.match(element.textContent, /Absorb the next 10 damage/);
    assert.match(element.textContent, /Absorb the next 12 damage/);
    assert.match(element.textContent, /cannot be a partner/);
    assert.equal(element.querySelectorAll('[data-choose-creature]').length, 2);
    element.querySelector('[data-choose-creature="fogling"]').click();
    assert.equal(game.state.progress.creatures.partner, 'fogling');
    element.querySelector('[data-choose-creature="echo-bat"]').click();
    assert.equal(game.state.progress.creatures.partner, 'echo-bat');
    assert.equal(element.querySelectorAll('[aria-pressed="true"]').length, 1);
    element.querySelector('[data-release-creature]').click();
    assert.equal(game.state.progress.creatures.partner, null);
    assert.equal(saves, 3);
  } finally {
    global.document = before;
    dom.window.close();
  }
});

test('the Creatures sidebar action cannot replace a battle or another locked activity', async () => {
  const { guardAtlasPanels } = await import('../src/ui/atlas.js');
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'));
  const menu = dom.window.document.querySelector('#game-menus');
  const button = dom.window.document.querySelector('#creatures-button');
  let locked = true;
  let openings = 0;
  guardAtlasPanels(menu, () => !locked);
  button.addEventListener('click', () => openings++);
  button.click();
  assert.equal(openings, 0);
  locked = false;
  button.click();
  assert.equal(openings, 1);
  dom.window.close();
});

test('a real encounter saves its discovery before fighting and retains it after escape', async () => {
  const { createGameplay } = await import('../src/gameplay.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const pkg = await loadLevelPackage('p2', fetcher, '');
  const game = { levelPackage: pkg, state: createFreshState(pkg) };
  const dom = new JSDOM('<div class="stage"><div id="overlay"></div></div>');
  const previous = { document: global.document, timeout: global.setTimeout, random: Math.random };
  const pending = [];
  const saves = [];
  global.document = dom.window.document;
  global.setTimeout = callback => { pending.push(callback); return pending.length; };
  Math.random = () => 0;
  try {
    const element = document.querySelector('#overlay');
    const overlay = { open(html) { element.innerHTML = html; }, close() { element.innerHTML = ''; } };
    const gameplay = createGameplay({ getActive: () => game, overlay, storage: { getItem() { return null; }, setItem() {} }, persist() { saves.push(structuredClone(game.state)); }, render() {}, toast() {} });
    assert.equal(gameplay.startBattle({ lesson: 1, encounter: { types: { fogling: 1 } } }), true);
    assert.ok(saves[0].progress.creatures.collection.fogling.level >= 1);
    assert.equal(gameplay.battleInProgress(), true);
    pending.shift()();
    pending.shift()();
    assert.match(element.textContent, /Fogling discovered/);
    element.querySelector('[data-fight]').click();
    element.querySelector('[data-run]').click();
    assert.equal(gameplay.battleInProgress(), false);
    assert.equal(game.state.progress.words && Object.keys(game.state.progress.words).length, 0);
    assert.deepEqual(saves.at(-1).progress.creatures, saves[0].progress.creatures);
  } finally {
    global.document = previous.document;
    global.setTimeout = previous.timeout;
    Math.random = previous.random;
    dom.window.close();
  }
});
