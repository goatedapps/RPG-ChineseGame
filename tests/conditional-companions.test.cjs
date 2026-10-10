const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const definitions = JSON.parse(fs.readFileSync('content/authored/shared/companions.json', 'utf8'));
const api = () => import('../src/systems/companions.js');
async function battleFor(id, level = 14, heroLevel = level, maxHp = 80) {
  const { activeCompanion } = await api();
  return { creature: { maxHp, attack: 7 }, companion: activeCompanion({ creatures: { partner: id, collection: { [id]: { level } } } }, definitions, heroLevel) };
}
test('healing waits for two correct attacks and missing HP, then helps only once', async () => {
  const { companionStrike } = await api();
  const battle = await battleFor('chaff-sprite');
  const player = { level: 14, hp: 46, maxHp: 46 };
  companionStrike(battle, player, 10, { skill: 'm' });
  companionStrike(battle, player, 10, { skill: 'm' });
  assert.equal(battle.companionUsed, undefined);
  player.hp = 20;
  companionStrike(battle, player, 0, { skill: 'm' });
  assert.equal(player.hp, 20);
  companionStrike(battle, player, 10, { skill: 'm' });
  assert.equal(player.hp, 29);
  assert.equal(battle.companionUsed, true);
  companionStrike(battle, player, 10, { skill: 'm' });
  assert.equal(player.hp, 29);
  const nearFull = await battleFor('chaff-sprite');
  nearFull.companionCorrect = 1; player.hp = 45;
  companionStrike(nearFull, player, 10, { skill: 'm' });
  assert.equal(player.hp, 46);
});
test('skill and variety triggers require correct attacks and share a finite total damage budget', async () => {
  const { companionStrike } = await api();
  const player = { level: 8, hp: 34, maxHp: 34 };
  const echo = await battleFor('echo-bat', 8, 8, 40);
  assert.equal(companionStrike(echo, player, 8, { skill: 'm' }), 8);
  assert.equal(companionStrike(echo, player, 0, { skill: 'p' }), 0);
  assert.equal(echo.companionUsed, undefined);
  assert.equal(companionStrike(echo, player, 8, { skill: 'p' }), 14);
  assert.equal(companionStrike(echo, player, 8, { skill: 'p' }), 8);
  const twin = await battleFor('twin-shade', 8, 8, 40);
  for (let n = 0; n < 3; n++) assert.equal(companionStrike(twin, player, 8, { skill: 'm' }), 8);
  assert.equal(twin.companionUsed, undefined);
  assert.equal(companionStrike(twin, player, 0, { skill: 'h' }), 0);
  assert.equal(companionStrike(twin, player, 8, { skill: 'h' }), 10);
  assert.equal(companionStrike(twin, player, 0, { skill: 'h' }), 0);
  assert.equal(twin.companionEffect.hits, 1);
  assert.equal(companionStrike(twin, player, 8, { skill: 'u' }), 10);
  assert.equal(companionStrike(twin, player, 8, { skill: 'm' }), 8);
});
test('danger support waits for a damaging hit, can prevent defeat, and does not retrigger', async () => {
  const { companionCounterattack } = await api();
  const battle = await battleFor('fogling', 1);
  let player = { level: 1, hp: 20, maxHp: 20 };
  const dodge = companionCounterattack(battle, player, () => 0, { evasionBonus: .5 });
  assert.equal(dodge.damage, 0); assert.equal(battle.companionUsed, undefined);
  player = companionCounterattack(battle, player, () => .5, {}).player;
  assert.equal(player.hp, 13); assert.equal(battle.companionUsed, undefined);
  const guarded = companionCounterattack(battle, player, () => .5, {});
  assert.equal(guarded.absorbed, 4); assert.equal(guarded.player.hp, 10);
  assert.equal(battle.companionUsed, true);
  const again = companionCounterattack(battle, guarded.player, () => .5, {});
  assert.equal(again.absorbed, 0);
  const rescue = await battleFor('fogling', 1); rescue.creature.attack = 4;
  const saved = companionCounterattack(rescue, { level: 1, hp: 4, maxHp: 20 }, () => 1, {});
  assert.equal(saved.player.hp, 3);
});
test('higher-level captures stay bounded by the hero and all authored support budgets are safe', async () => {
  const { creatureAbility } = await api();
  for (const [id, definition] of Object.entries(definitions)) {
    const low = creatureAbility(definition, 1, 14);
    const equal = creatureAbility(definition, 14, 14);
    const high = creatureAbility(definition, 200, 14);
    for (const stat of ['heal', 'shield', 'damage']) {
      assert.ok(low[stat] <= equal[stat], id);
      assert.equal(high[stat], equal[stat], id);
    }
    assert.ok(equal.heal + equal.shield <= .2000001, id);
    assert.ok(equal.damage <= .15, id);
    if (definition.trigger.kind === 'skill') assert.ok(['m','p','h','u','w'].includes(definition.trigger.skill), id);
    if (definition.trigger.kind === 'variety' || definition.trigger.kind === 'answers') assert.ok(definition.trigger.count >= 2, id);
  }
});
test('every species respects the final boss cap and bosses survive nine correct answers', async () => {
  const { companionStrike, companionCounterattack } = await api();
  for (const id of Object.keys(definitions)) {
    for (const maxHp of [31, 40, 97, 250]) {
      const battle = await battleFor(id, 70, 1, maxHp); battle.maxHp = maxHp;
      const player = { level: 1, hp: 10, maxHp: 20 };
      let hp = maxHp;
      for (let answer = 0; answer < 9; answer++) {
        const damage = companionStrike(battle, player, 9999, { skill: ['m','p','h','u','w'][answer % 5], boss: true });
        assert.ok(damage <= Math.floor(maxHp / 10), `${id}: ${maxHp}`);
        hp -= damage;
      }
      assert.ok(hp > 0, `${id}: boss survives nine answers`);
      battle.creature.attack = 2;
      companionCounterattack(battle, player, () => 1, {});
      assert.equal(companionStrike(battle, player, 0, { skill: 'p', boss: true }), 0);
    }
  }
  const echo = await battleFor('echo-bat', 8, 8, 100); echo.maxHp = 100;
  const player = { level: 8, hp: 34, maxHp: 34 };
  assert.equal(companionStrike(echo, player, 1000, { skill: 'p', boss: true }), 10);
  assert.equal(echo.companionEffect.damage, 15);
  assert.equal(echo.companionEffect.hits, 1);
  assert.equal(companionStrike(echo, player, 1, { skill: 'p', boss: true }), 10);
  assert.equal(echo.companionEffect.damage, 0);
});
test('guided battles suppress support and every new battle has fresh trigger progress', async () => {
  const { companionStrike, companionCounterattack } = await api();
  const player = { level: 14, hp: 10, maxHp: 46 };
  const battle = await battleFor('chaff-sprite'); battle.guided = true;
  for (let n = 0; n < 5; n++) companionStrike(battle, player, 10, { skill: 'm' });
  assert.equal(player.hp, 10); assert.equal(battle.companionUsed, undefined);
  const danger = await battleFor('fogling'); danger.guided = true;
  assert.equal(companionCounterattack(danger, player, () => 1, {}).absorbed, 0);
  const fresh = await battleFor('chaff-sprite');
  companionStrike(fresh, player, 10, { skill: 'm' });
  assert.equal(fresh.companionUsed, undefined);
});
test('battle support cards show triggers and actual feedback without an activation control', async () => {
  const { companionBattleCard } = await import('../src/ui/companion.js');
  const { companionStrike } = await api();
  const battle = await battleFor('chaff-sprite');
  const player = { level: 14, hp: 10, maxHp: 46 };
  const ready = new JSDOM(companionBattleCard(battle.companion, battle));
  assert.equal(ready.window.document.querySelector('button'), null);
  assert.match(ready.window.document.body.textContent, /After 2 correct attacks/);
  companionStrike(battle, player, 10); companionStrike(battle, player, 10);
  const done = new JSDOM(companionBattleCard(battle.companion, battle));
  assert.ok(done.window.document.querySelector('[data-companion-used]'));
  assert.match(done.window.document.querySelector('[role=status]').textContent, /restored 9 HP/);
  ready.window.close(); done.window.close();
});
test('real normal and boss battle controllers trigger support automatically and retain final boss caps', async () => {
  const path = require('node:path');
  const { createGameplay, makeBattleQuestion } = await import('../src/gameplay.js');
  const { createAdventure } = await import('../src/adventure.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue } = await import('../src/systems/story.js');
  const { makeExamQuestion } = await import('../src/learning/questions.js');
  const { createBoss } = await import('../src/battle/creatures.js');
  const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) });
  const pkg = await loadLevelPackage('p2', fetcher, '');
  const game = { levelPackage: pkg, state: createFreshState(pkg) };
  const dom = new JSDOM('<div class="stage"><div id="overlay"></div></div>');
  const previous = { document: global.document, timeout: global.setTimeout, random: Math.random, matchMedia: global.matchMedia };
  const pending = [];
  global.document = dom.window.document;
  global.matchMedia = () => ({ matches: true });
  global.setTimeout = callback => { pending.push(callback); return pending.length; };
  Math.random = () => .5;
  try {
    const root = document.querySelector('#overlay');
    const overlay = { open(html) { root.innerHTML = html; }, close() { root.innerHTML = ''; } };
    const shared = { getActive: () => game, overlay, persist() {}, render() {}, toast() {} };
    const gameplay = createGameplay({ ...shared, storage: { getItem() { return null; }, setItem() {} } });
    const word = pkg.content.words.find(word => word.lesson === 1);
    game.state.progress.baits = [{ lesson: 1, word: word.w }];
    game.state.progress.creatures = { partner: 'echo-bat', collection: { 'echo-bat': { level: 1, variant: 'normal' } } };
    assert.equal(gameplay.startBattle({ lesson: 1, encounter: { types: { fogling: 1 } } }), true);
    pending.shift()(); pending.shift()(); root.querySelector('[data-fight]').click();
    assert.equal(root.querySelector('[data-companion-skill]'), null);
    assert.ok(root.querySelector('[data-companion-ready]'));
    root.querySelector('[data-attack="p"]').click();
    const expected = makeBattleQuestion(word, 'p', pkg.content.words, pkg.content.questions.single);
    [...root.querySelectorAll('[data-answer]')].find(button => button.textContent === expected.correct).click();
    root.querySelector('[data-question-next]').click();
    assert.ok(root.querySelector('[data-companion-used]'));
    assert.match(root.querySelector('.companion-notice').textContent, /Echo Bat added 1 damage/);
    Math.random = () => 0;
    root.querySelector('[data-run]').click();
    Math.random = () => .5;
    assert.equal(gameplay.battleInProgress(), false, root.textContent);
    game.state.player = { ...game.state.player, level: 100, hp: 218, maxHp: 218 };
    game.state.progress.creatures.collection['echo-bat'].level = 100;
    const adventure = createAdventure({ ...shared, gameplay });
    const tasks = bossGateQueue(pkg.content, pkg.config, pkg.config.regionLessons.r1);
    const boss = createBoss(pkg.balance, pkg.config.regionLessons.r1);
    const limit = Math.floor(boss.maxHp / 10);
    adventure.startBoss();
    assert.equal(root.querySelector('[data-companion-skill]'), null);
    root.querySelector('[data-boss-next]').click();
    for (const task of tasks.slice(0, 5)) {
      assert.equal(task.kind, 'question');
      const question = makeExamQuestion(task.item);
      [...root.querySelectorAll('[data-answer]')].find(button => button.textContent === question.correct).click();
      root.querySelector('[data-question-next]').click();
      assert.match(root.textContent, new RegExp(`You dealt ${limit} damage`));
      assert.ok(root.querySelector('[data-boss-next]'));
      if (task !== tasks[4]) root.querySelector('[data-boss-next]').click();
    }
    assert.ok(root.querySelector('[data-companion-used]'));
    assert.match(root.textContent, /Echo Bat used Echo Strike/);
  } finally {
    global.document = previous.document; global.setTimeout = previous.timeout; Math.random = previous.random; global.matchMedia = previous.matchMedia;
    dom.window.close();
  }
});
