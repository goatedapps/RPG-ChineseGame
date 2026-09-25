const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const silver = { collected: true, ticks: { m: 2, p: 2, h: 2, u: 0, w: 0 } };

test('daily quests are deterministic, reset at midnight, and award one chest', async () => {
  const { claimDailyChest, dailyChestReady, normalizeDaily, recordDailyEvent } = await import('../src/systems/daily.js');
  const templates = readJson('content/authored/campaign/daily-quests.json');
  let daily = normalizeDaily({}, '2026-09-24', templates, 'p5');
  assert.equal(daily.quests.length, 3);
  assert.deepEqual(daily.quests.map(quest => quest.id), normalizeDaily({}, '2026-09-24', templates, 'p5').quests.map(quest => quest.id));
  for (const quest of daily.quests) daily = recordDailyEvent(daily, quest.event, quest.target);
  assert.equal(dailyChestReady(daily), true);
  const claimed = claimDailyChest(daily);
  assert.equal(claimed.ok, true);
  assert.equal(claimDailyChest(claimed.daily).ok, false);
  const tomorrow = normalizeDaily(claimed.daily, '2026-09-25', templates, 'p5');
  assert.equal(tomorrow.chestClaimed, false);
  assert.ok(tomorrow.quests.every(quest => quest.progress === 0));
});

test('Lantern Streak uses one silent weekly freeze and then resets after another miss', async () => {
  const { advanceLanternStreak } = await import('../src/systems/daily.js');
  let result = advanceLanternStreak({}, '2026-09-21');
  result = advanceLanternStreak(result.streak, '2026-09-23');
  assert.equal(result.usedFreeze, true);
  assert.equal(result.streak.count, 2);
  result = advanceLanternStreak(result.streak, '2026-09-25');
  assert.equal(result.usedFreeze, false);
  assert.equal(result.streak.count, 1);
  result = advanceLanternStreak(result.streak, '2026-09-26');
  assert.equal(result.streak.count, 2);
});

test('one deterministic Mystery Scroll can be unlocked per day', async () => {
  const { dailyScrollSpot, unlockDailyScroll } = await import('../src/systems/daily.js');
  const spots = readJson('content/authored/campaign/r1-story.json').scrollSpots;
  assert.deepEqual(dailyScrollSpot('2026-09-24', spots, 'p5'), dailyScrollSpot('2026-09-24', spots, 'p5'));
  const first = unlockDailyScroll({}, '2026-09-24', { title: '露营', text: 'Camping' });
  const duplicate = unlockDailyScroll(first, '2026-09-24', { title: 'Other' });
  assert.equal(duplicate.unlocked.length, 1);
  assert.equal(duplicate.unlocked[0].title, '露营');
});

test('Region 1 gate derives 22 percent and also requires the Cave Lantern', async () => {
  const { gateStatus } = await import('../src/systems/story.js');
  const content = readJson('content/generated/p5.content.json');
  const config = readJson('content/authored/levels/p5/level.json');
  const words = content.words.filter(word => config.regionLessons.r1.includes(word.lesson));
  assert.equal(words.length, 54);
  const progress = { words: Object.fromEntries(words.slice(0, 12).map(word => [word.w, silver])) };
  const closed = gateStatus({ content, config }, progress, { keyItems: [] }, 0.22);
  assert.equal(closed.required, 12);
  assert.equal(closed.open, false);
  assert.equal(gateStatus({ content, config }, progress, { keyItems: ['cave-lantern'] }, 0.22).open, true);
});

test('all three villager chains expose their authored completion conditions', async () => {
  const { requestReady } = await import('../src/systems/story.js');
  const progress = { words: { '贵重': { collected: true }, '探险': { collected: true }, '狼吞虎咽': silver, '模糊': silver, '眼圈': silver, '调味料': silver, '材料': silver } };
  const story = { flags: { treasureFound: true }, counters: { creatures: { 'twin-shade': 3, 'ink-imp': 2 }, writing: { '距离': 1 }, tingxieLesson3: 3 } };
  for (const id of ['xiaoqiang', 'mr-lin', 'chef-mei']) for (let step = 0; step < 3; step += 1) assert.equal(requestReady(id, step, progress, story), true);
});

test('Muddle King has all four authored phases and awards Dawn Stroke through commands', async () => {
  const { applyStoryCommands, bossGateQueue } = await import('../src/systems/story.js');
  const content = readJson('content/generated/p5.content.json');
  const story = readJson('content/authored/campaign/r1-story.json');
  const queue = bossGateQueue(content);
  assert.equal(queue.length, 12);
  assert.deepEqual([...new Set(queue.map(task => task.phase))], ['Chain Spell', 'Scramble Spell', 'Ink Spell', 'Muddle Scroll']);
  const standaloneQuestionIds = new Set(content.questions.single.map(item => item.id));
  assert.ok(queue.filter(task => task.kind === 'question').every(task => standaloneQuestionIds.has(task.item.id)));
  assert.ok(queue.filter(task => task.phase === 'Muddle Scroll').every(task => task.item.id));
  const result = applyStoryCommands({}, story.scenes.reform);
  assert.equal(result.story.bossDefeated, true);
  assert.deepEqual(result.rewards, ['dawn-stroke']);
});

test('regional bosses are one level above the strongest regional creature', async () => {
  const { createBoss } = await import('../src/battle/creatures.js');
  const balance = readJson('content/authored/shared/balance.json');
  const boss = createBoss(balance, [1, 2, 3]);
  assert.equal(boss.level, 13);
  assert.equal(boss.maxHp, balance.combat.baseEnemyHp + boss.level * balance.combat.hpPerLevel);
  assert.ok(boss.attack > balance.combat.baseEnemyAttack);
  assert.ok(boss.defense > balance.combat.baseEnemyDefense);
});

test('P6 and P7 surfaces and Region 1 characters are present in the modular shell', () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'game', 'index.html'), 'utf8'));
  assert.ok(dom.window.document.querySelector('#daily-button'));
  assert.ok(dom.window.document.querySelector('#story-button'));
  const map = readJson('content/authored/campaign/maps/r1-hub.json');
  const ids = new Set(map.objects.map(object => object.id));
  for (const id of ['quest-board', 'storyteller', 'xiaoqiang', 'mr-lin', 'chef-mei', 'ah-dong', 'treasure-chest', 'gatekeeper']) assert.ok(ids.has(id), id);
});
