const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(url.replace(/^\//, ''), 'utf8')) });

test('P6 single-lesson regions keep full bosses, local writing data and valid route lessons', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { bossGateQueue } = await import('../src/systems/story.js');
  const game = await loadLevelPackage('p6', fetcher, '');
  assert.equal(game.content.lessons.length, 12);
  assert.equal(game.content.words.length, 300);
  assert.deepEqual(game.config.singleLessonRegions, ['r5', 'r6', 'r7']);
  assert.ok(game.content.questions.groups.some(group => group.subject !== 'Higher Chinese' && group.passage && group.items.length));
  for (const word of game.content.words) {
    assert.ok(word.sb.some(sentence => sentence[0].includes(word.w)), `${word.w} has a usable sentence bank`);
    for (const character of [...word.w].filter(value => /\p{Script=Han}/u.test(value))) assert.ok(game.characters.characters[character], `${character} has offline strokes`);
  }
  for (const [id, lessons] of Object.entries(game.config.regionLessons)) {
    const queue = bossGateQueue(game.content, game.config, lessons);
    const writing = queue.filter(task => task.kind === 'writing');
    assert.equal(writing.length, 2);
    assert.equal(new Set(writing.map(task => task.word.w)).size, 2, `${id} uses two distinct writing prompts`);
    for (const lesson of lessons) assert.ok(queue.some(task => task.kind === 'question' && task.item.lessons.includes(lesson)));
    for (const map of [game.campaigns[id].map, game.campaigns[id].route]) assert.ok(map.zones.every(zone => lessons.includes(zone.lesson)));
  }
});

test('P6 Grove evidence reserves nine distinct words across its three tests in Lesson 11', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { chapterTask, chapterDictationWords } = await import('../src/systems/chapterQuests.js');
  const game = await loadLevelPackage('p6', fetcher, '');
  const words = game.content.words.filter(word => word.lesson === 11).slice(0, 9);
  const progress = { words: Object.fromEntries(words.map(word => [word.w, { collected: true }])) };
  const tasks = Object.keys(game.campaigns.r6.regionStory.chapter.tasks);
  const selected = tasks.flatMap(id => {
    assert.equal(chapterTask(game, 'r6', id).lesson, 11);
    const chosen = chapterDictationWords(game, progress, 'r6', id, () => 0);
    assert.equal(chosen.length, 3);
    return chosen;
  });
  assert.equal(selected.length, 9);
  assert.equal(new Set(selected.map(word => word.w ?? word)).size, 9);
});
