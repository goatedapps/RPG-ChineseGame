const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const playable = read('content/authored/shared/levels.json').filter(level => level.worldMappingReady);
const fetcher = async url => ({ ok: true, json: async () => read(url.replace(/^\//, '')) });

test('every playable curriculum has complete seven-region teaching and progression pools', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue, gateStatus } = await import('../src/systems/story.js');
  const { gateDictationRules } = await import('../src/systems/dictation.js');
  const { saveKey } = await import('../src/core/save.js');
  assert.ok(playable.length > 0);
  assert.equal(new Set(playable.map(level => level.id)).size, playable.length);
  assert.equal(new Set(playable.map(level => saveKey(level.id))).size, playable.length);
  for (const level of playable) {
    const game = await loadLevelPackage(level.id, fetcher, '');
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
      assert.ok(words.length >= count, `${level.id} ${id}: enough words for gate dictation`);
      assert.ok(lessons.every(lesson => game.content.stories.some(story => story.lesson === lesson)), `${level.id} ${id}: stories cover every lesson`);
      const queue = bossGateQueue(game.content, game.config, lessons);
      assert.equal(queue.length, 12, `${level.id} ${id}: complete boss challenge`);
      assert.equal(new Set(queue.filter(task => task.kind === 'question').map(task => task.item.id)).size, 10, `${level.id} ${id}: boss questions do not repeat`);
      assert.ok(queue.every(task => task.kind === 'writing' || (task.item?.o?.includes(task.item.c) && !task.item.passage)), `${level.id} ${id}: boss prompts stand alone`);
      const eligible = words.slice(0, Math.ceil(words.length * campaign.regionStory.gateBronzePct));
      const progress = { words: Object.fromEntries(eligible.map(word => [word.w, { collected: true, ticks: { m: 1, p: 1, h: 1 } }])) };
      assert.ok(gateStatus({ ...game, ...campaign }, progress, { keyItems: [campaign.regionStory.readingKeyItem || 'cave-lantern'] }, campaign.regionStory.gateBronzePct).open, `${level.id} ${id}: attainable boss gate`);
    }
  }
});
