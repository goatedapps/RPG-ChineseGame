const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const silver = { collected: true, ticks: { m: 2, p: 2, h: 2, u: 0, w: 0 } };
const gold = { collected: true, ticks: { m: 2, p: 2, h: 2, u: 2, w: 2 } };

test('all ten shop consumables are authored and inventory use is immutable', async () => {
  const items = readJson('content/authored/shared/items.json');
  const { applyHealing, useConsumable } = await import('../src/systems/inventory.js');
  assert.deepEqual(items.map(item => item.effect), ['heal', 'heal', 'full-heal', 'remove-option', 'writing-retry', 'escape', 'double-coins', 'attack-boost', 'defense-boost', 'repellent']);
  const used = useConsumable({ 'rice-ball': 2 }, 'rice-ball');
  assert.equal(used.ok, true);
  assert.equal(used.inventory['rice-ball'], 1);
  assert.equal(applyHealing({ hp: 5, maxHp: 20 }, items[0]).hp, 15);
  assert.equal(applyHealing({ hp: 5, maxHp: 20 }, items[2]).hp, 20);
});

test('gear can only be equipped when owned and every mechanical bonus is exposed', async () => {
  const gear = readJson('content/authored/shared/gear.json');
  const { equipGear, gearBonuses } = await import('../src/systems/gear.js');
  let equipment = { owned: gear.map(item => item.id), equipped: {} };
  for (const item of gear) equipment = equipGear(equipment, item);
  const bonuses = gearBonuses(equipment, gear);
  assert.equal(equipment.equipped.brush, 'jade-brush');
  assert.equal(equipment.equipped.charm, 'fog-lantern-charm');
  assert.equal(equipment.equipped.hat, 'gold-crown');
  const unowned = equipGear({ owned: ['bamboo-brush'], equipped: {} }, gear.find(item => item.id === 'red-cap'));
  assert.equal(unowned.equipped.hat, null);
  assert.equal(gearBonuses({ owned: gear.map(item => item.id), equipped: { brush: 'jade-brush', charm: 'echo-bell', hat: 'scholars-cap' } }, gear).xp, 0.1);
  assert.equal(bonuses.spellDefense, 2);
});

test('crafting consumes its exact recipe once and grants permanent gear', async () => {
  const recipe = readJson('content/authored/shared/recipes.json')[0];
  const { craft } = await import('../src/systems/crafting.js');
  const first = craft(recipe, { coins: 40 }, { 'mist-drop': 3, 'ink-bead': 2 }, { owned: ['bamboo-brush'], equipped: {} });
  assert.equal(first.ok, true);
  assert.equal(first.player.coins, 20);
  assert.equal(first.materials['mist-drop'], 0);
  assert.ok(first.equipment.owned.includes('jade-brush'));
  assert.equal(craft(recipe, first.player, first.materials, first.equipment).ok, false);
});

test('partners require Silver, stop at three, and Gold unlocks authored or idiom moves', async () => {
  const { eligiblePartners, partnerBonuses, partnerMove, setPartners } = await import('../src/systems/partners.js');
  const words = [
    { id: 'one', w: '露营' }, { id: 'two', w: '绑' }, { id: 'three', w: '黄瓜' }, { id: 'four', w: '狼吞虎咽' }
  ];
  const progress = { '露营': silver, '绑': gold, '黄瓜': silver, '狼吞虎咽': gold };
  const eligible = eligiblePartners(words, progress);
  const selected = setPartners([], eligible.map(word => word.id), eligible.map(word => word.id));
  assert.deepEqual(selected, ['one', 'two', 'three']);
  assert.equal(partnerBonuses(selected, Object.fromEntries(words.map(word => [word.id, word])), progress).maxHp, 4);
  assert.equal(partnerMove(words[0], silver, { '露营': 'Outdoors' }), null);
  assert.equal(partnerMove(words[1], gold, { '绑': 'Actions' }).id, 'damage-1');
  assert.equal(partnerMove(words[3], gold, {}).id, 'full-heal');
});

test('the Campfire set requires Silver words and can only be offered when ready', async () => {
  const [set] = readJson('content/authored/campaign/r1-sets.json');
  const { offerSet, setProgress } = await import('../src/systems/sets.js');
  const available = set.words.map(w => ({ w }));
  const progress = Object.fromEntries(set.words.map(w => [w, silver]));
  const ready = setProgress(set, progress, available);
  assert.equal(ready.ready, true);
  assert.equal(offerSet(set, ready).completed, true);
  assert.equal(setProgress(set, { ...progress, '露营': { collected: true } }, available).ready, false);
});

test('collection milestones are claimed once and battle XP supports gear multipliers', async () => {
  const milestones = readJson('content/authored/shared/milestones.json');
  const { claimMilestones } = await import('../src/systems/milestones.js');
  const { gainBattleRewards } = await import('../src/battle/battle.js');
  const first = claimMilestones(20, milestones, []);
  assert.deepEqual(first.due.map(item => item.count), [10, 20]);
  assert.equal(claimMilestones(20, milestones, first.claimed).due.length, 0);
  const player = gainBattleRewards({ level: 2, xp: 55, hp: 22, maxHp: 25, coins: 0 }, { combat: { battleXp: 12, battleCoins: 8 } }, { xpMultiplier: 1.1, maxHpBonus: 3 });
  assert.equal(player.level, 3);
  assert.equal(player.maxHp, 27);
  assert.equal(player.hp, 27);
  assert.equal(player.xp, 8);
});

test('collecting each lesson once keeps player level near the next lesson band', async () => {
  const { gainBattleRewards } = await import('../src/battle/battle.js');
  const shared = readJson('content/authored/shared/balance.json');
  const expected = { p2: [4, 6], p5: [4, 7] };
  for (const level of ['p2', 'p5']) {
    const content = readJson(`content/generated/${level}.content.json`);
    const config = readJson(`content/authored/levels/${level}/level.json`);
    const combat = { ...shared.combat, ...(config.tuning?.balance?.combat || {}) };
    const balance = { ...shared, combat };
    let player = { level: 1, xp: 0, hp: 20, maxHp: 20, coins: 0 };
    for (const lesson of [1, 2]) {
      const [minimum, maximum] = combat.lessonLevels[String(lesson)];
      const count = content.words.filter(word => word.lesson === lesson).length;
      for (let index = 0; index < count; index += 1) {
        player = gainBattleRewards(player, balance, { creatureLevel: minimum + index % (maximum - minimum + 1) });
      }
      assert.equal(player.level, expected[level][lesson - 1], `${level} lesson ${lesson}`);
    }
  }
});

test('fresh saves and the game shell expose the P4 and P5 collection surfaces', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const state = createFreshState({ id: 'p5', content: { contentVersion: 'test' }, map: { id: 'r1-hub', spawn: { x: 1, y: 1 } } });
  assert.deepEqual(state.progress.partners, []);
  assert.equal(state.progress.equipment.equipped.brush, 'bamboo-brush');
  assert.equal(state.settings.dailyBattles, 30);
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'game', 'index.html'), 'utf8'));
  assert.ok(dom.window.document.querySelector('#character-button'));
  assert.equal(dom.window.document.querySelector('#bag-button span').textContent, 'Bag');
  assert.ok(dom.window.document.querySelector('#room-button'));
});
