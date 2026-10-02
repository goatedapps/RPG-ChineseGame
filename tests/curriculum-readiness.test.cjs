const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { playableLevels } = require('./support/levels.cjs');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fetcher = async url => ({ ok: true, json: async () => read(url.replace(/^\//, '')) });

test('every playable curriculum has complete seven-region teaching and progression pools', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue, gateStatus } = await import('../src/systems/story.js');
  const { gateDictationPool, gateDictationRules } = await import('../src/systems/dictation.js');
  const { setProgress } = await import('../src/systems/sets.js');
  const { saveKey } = await import('../src/core/save.js');
  assert.ok(playableLevels.length > 0);
  assert.equal(new Set(playableLevels.map(level => level.id)).size, playableLevels.length);
  assert.equal(new Set(playableLevels.map(level => saveKey(level.id))).size, playableLevels.length);
  for (const level of playableLevels) {
    const game = await loadLevelPackage(level.id, fetcher, '');
    assert.ok(game.campaigns.r1.sets.length > 0, `${level.id}: tutorial region has Restoration Sets`);
    for (const set of game.campaigns.r1.sets) {
      assert.ok(setProgress(set, {}, game.content.words).words.length >= 3, `${level.id}: ${set.id} has at least three curriculum words`);
    }
    const assignedLessons = Object.values(game.config.regionLessons).flat();
    assert.equal(assignedLessons.length, new Set(assignedLessons).size, `${level.id}: a lesson belongs to only one region`);
    assert.deepEqual([...assignedLessons].sort((a, b) => a - b), game.content.lessons.map(lesson => lesson.id).sort((a, b) => a - b), `${level.id}: every lesson has a region`);
    const { count } = gateDictationRules({});
    for (let number = 1; number <= 7; number += 1) {
      const id = `r${number}`;
      const campaign = game.campaigns[id];
      const lessons = game.config.regionLessons[id];
      const words = game.content.words.filter(word => lessons.includes(word.lesson));
      assert.ok(campaign?.map && campaign.regionStory, `${level.id} ${id}: shared campaign exists`);
      assert.ok(new Set(words.map(word => word.w)).size >= count, `${level.id} ${id}: enough distinct words for gate dictation`);
      assert.ok(lessons.every(lesson => game.content.stories.some(story => story.lesson === lesson)), `${level.id} ${id}: stories cover every lesson`);
      const queue = bossGateQueue(game.content, game.config, lessons);
      assert.equal(queue.length, 12, `${level.id} ${id}: complete boss challenge`);
      assert.equal(new Set(queue.filter(task => task.kind === 'question').map(task => task.item.id)).size, 10, `${level.id} ${id}: boss questions do not repeat`);
      assert.ok(queue.every(task => task.kind === 'writing' || (task.item?.o?.includes(task.item.c) && !task.item.passage)), `${level.id} ${id}: boss prompts stand alone`);
      const eligible = words.slice(0, Math.ceil(words.length * campaign.regionStory.gateBronzePct));
      const progress = { words: Object.fromEntries(eligible.map(word => [word.w, { collected: true, ticks: { m: 1, p: 1, h: 1 } }])) };
      assert.ok(gateStatus({ ...game, ...campaign }, progress, { keyItems: [campaign.regionStory.readingKeyItem || 'cave-lantern'] }, campaign.regionStory.gateBronzePct).open, `${level.id} ${id}: attainable boss gate`);
      assert.ok(gateDictationPool(words, progress.words).length >= count, `${level.id} ${id}: default gate dictation is possible at the boss threshold`);
    }
  }
});

test('repeated words in Primary 2 Region 2 count once toward the boss gate', async () => {
  const { loadLevelPackage, activateRegion } = await import('../src/content/loader.js');
  const { gateStatus, regionWords } = await import('../src/systems/story.js');
  const { gateDictationPool } = await import('../src/systems/dictation.js');
  const game = activateRegion(await loadLevelPackage('p2', fetcher, ''), 'r2');
  const distinct = [...new Set(regionWords(game).map(word => word.w))];
  const required = Math.ceil(distinct.length * game.regionStory.gateBronzePct);
  const selected = ['从', '想', ...distinct.filter(word => word !== '从' && word !== '想')].slice(0, required - 1);
  const progress = { words: Object.fromEntries(selected.map(word => [word, { collected: true }])) };
  const status = gateStatus(game, progress, { keyItems: [game.regionStory.readingKeyItem] }, game.regionStory.gateBronzePct);
  assert.equal(status.total, distinct.length);
  assert.equal(status.bronze, required - 1);
  assert.equal(status.open, false);
  assert.equal(gateDictationPool(regionWords(game), progress.words).length, required - 1);
});
