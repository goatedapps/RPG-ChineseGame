const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load: loadYaml } = require('js-yaml');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('both curricula have a complete seven-region story and lesson mapping', async () => {
  const { bossGateQueue } = await import('../src/systems/story.js');
  const regions = readJson('content/authored/campaign/regions.json');
  for (const level of ['p2', 'p5']) {
    const config = readJson(`content/authored/levels/${level}/level.json`);
    const content = readJson(`content/generated/${level}.content.json`);
    const assigned = Object.values(config.regionLessons).flat();
    assert.deepEqual([...assigned].sort((a, b) => a - b), Array.from({ length: content.lessons.length }, (_, index) => index + 1));
    assert.deepEqual(Object.keys(config.regionLessons), regions.map(region => region.id));
    for (const region of regions) {
      const lessons = config.regionLessons[region.id];
      const story = readJson(`content/authored/campaign/${region.id}-story.json`);
      const mapName = region.id === 'r1' ? 'r1-hub' : region.id === 'r2' ? 'r2-harvest-crossing' : region.id === 'r3' ? 'r3-tidewater-bay' : region.id === 'r4' ? 'r4-lantern-theatre' : region.id === 'r5' ? 'r5-festival-city' : region.id === 'r6' ? 'r6-ancient-grove' : 'r7-treehouse-summit';
      const map = readJson(`content/authored/campaign/maps/${mapName}.json`);
      assert.ok(lessons.length >= 2, `${level} ${region.id} mapped lessons`);
      assert.deepEqual(content.stories.filter(item => lessons.includes(item.lesson)).map(item => item.lesson), lessons);
      assert.ok(map.zones.every(zone => lessons.includes(Number.isInteger(zone.lessonSlot) ? lessons[zone.lessonSlot] ?? lessons.at(-1) : zone.lesson)), `${region.id} encounter lessons`);
      assert.ok(story.scenes?.reform && (region.id === 'r1' || (story.readingKeyItem && story.fragmentKey)), `${region.id} completion route`);
      const queue = bossGateQueue(content, config, lessons);
      assert.equal(queue.length, 12, `${level} ${region.id} boss tasks`);
      const ids = queue.filter(task => task.kind === 'question').map(task => task.item.id);
      assert.equal(new Set(ids).size, ids.length, `${level} ${region.id} unique boss questions`);
      assert.ok(queue.every(task => task.kind === 'writing' ? lessons.includes(task.word.lesson) : task.item.lessons.some(lesson => lessons.includes(lesson))), `${level} ${region.id} regional boss content`);
      for (const lesson of lessons) assert.ok(queue.some(task => task.kind === 'writing' ? task.word.lesson === lesson : task.item.lessons.includes(lesson)), `${level} ${region.id} includes Lesson ${lesson}`);
    }
  }
});

test('approved P5 final questions are playable and included in the final boss', async () => {
  const { bossGateQueue } = await import('../src/systems/story.js');
  const config = readJson('content/authored/levels/p5/level.json');
  const content = readJson('content/generated/p5.content.json');
  const approved = ['pinyin', 'conjunction', 'sentence'].flatMap(kind =>
    loadYaml(fs.readFileSync(path.join(root, `content/source/p5/questions/${kind}.yaml`), 'utf8'))
      .filter(question => question.questionID.startsWith('WSQ-P5-L'))
      .map(question => ({ ...question, kind }))
  );
  assert.equal(approved.length, 12);
  const playable = new Set(content.questions.single.map(question => question.id));
  assert.ok(approved.every(question => playable.has(question.questionID)));
  assert.ok(approved.every(question => question.options.length === 4 && new Set(question.options).size === 4 && question.options.includes(question.correct)));
  assert.deepEqual(approved.reduce((counts, question) => ({ ...counts, [question.kind]: (counts[question.kind] || 0) + 1 }), {}), { pinyin: 4, conjunction: 4, sentence: 4 });
  assert.equal(approved.find(question => question.questionID === 'WSQ-P5-L17-CJ1').correct, '虽然……仍然……');
  const queue = bossGateQueue(content, config, config.regionLessons.r7);
  assert.ok(queue.some(task => task.kind === 'question' && task.item.kind === 'conjunction'));
  assert.ok(queue.some(task => task.kind === 'question' && task.item.kind === 'sentence'));
});

test('full late-lesson collection stays close to the creature level band', async () => {
  const { gainBattleRewards } = await import('../src/battle/battle.js');
  const shared = readJson('content/authored/shared/balance.json');
  for (const [level, firstLateLesson] of [['p2', 16], ['p5', 13]]) {
    const config = readJson(`content/authored/levels/${level}/level.json`);
    const content = readJson(`content/generated/${level}.content.json`);
    const combat = { ...shared.combat, ...(config.tuning?.balance?.combat || {}) };
    const balance = { ...shared, combat };
    let player = { level: 1, xp: 0, hp: 20, maxHp: 20, coins: 0 };
    for (let lesson = 1; lesson <= content.lessons.length; lesson += 1) {
      const [minimum, maximum] = combat.lessonLevels[String(lesson)];
      const words = content.words.filter(word => word.lesson === lesson).length;
      for (let index = 0; index < words * 3; index += 1) {
        player = gainBattleRewards(player, balance, { creatureLevel: minimum + index % (maximum - minimum + 1) });
      }
      if (lesson >= firstLateLesson) {
        assert.ok(player.level >= minimum - 1 && player.level <= maximum + 3, `${level} Lesson ${lesson}: hero ${player.level}, creature ${minimum}–${maximum}`);
      }
    }
  }
});

test('Daily Quest Board only presents a chest button when it can be opened', () => {
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  assert.match(adventure, /ready\s*\? '<button class="primary" data-daily-chest>Open Daily Chest<\/button>'/);
  assert.match(adventure, /<span class="quest-chest-status" role="status">/);
  assert.doesNotMatch(adventure, /data-daily-chest \$\{ready \? '' : 'disabled'\}/);
});

test('correct villager passage answers sound correct and testing shortcuts stay compact', () => {
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/stage.css'), 'utf8');
  assert.match(gameplay, /if \(correct\) audio\?\.sfx\('correct'\)/);
  assert.match(gameplay, /data-parent-jump>Jump now/);
  assert.match(gameplay, /data-parent-level-save>Apply level/);
  assert.match(gameplay, /class="secondary parent-shortcut-button"/);
  assert.match(css, /\.parent-shortcut-button \{[^}]*min-height: 44px/);
});
