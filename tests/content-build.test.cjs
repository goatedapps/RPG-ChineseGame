const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('P2 and P5 generated packs match their source lesson counts', () => {
  const expected = {
    p2: { lessons: 19, words: 460, stories: 19 },
    p5: { lessons: 17, words: 327, stories: 17 }
  };
  for (const [level, counts] of Object.entries(expected)) {
    const content = readJson(`content/generated/${level}.content.json`);
    assert.equal(content.schemaVersion, 1);
    assert.match(content.contentVersion, /^[a-f0-9]{12}$/);
    assert.equal(content.level, level);
    assert.equal(content.lessons.length, counts.lessons);
    assert.equal(content.words.length, counts.words);
    assert.equal(content.stories.length, counts.stories);
    assert.ok(content.questions.single.length > 0);
    assert.ok(content.questions.groups.length > 0);
  }
});

test('every vocabulary Hanzi has packaged stroke data without radical metadata', () => {
  for (const level of ['p2', 'p5']) {
    const content = readJson(`content/generated/${level}.content.json`);
    const characters = readJson(`content/generated/${level}.chars.json`);
    assert.equal(characters.level, level);
    const needed = new Set(content.words.flatMap(word => [...word.w]).filter(character => /\p{Script=Han}/u.test(character)));
    for (const character of needed) {
      assert.ok(characters.characters[character], `${level} is missing ${character}`);
      assert.equal('radStrokes' in characters.characters[character], false);
    }
  }
});

test('one shared campaign accepts complete non-overlapping lesson mappings', () => {
  const regions = readJson('content/authored/campaign/regions.json');
  assert.equal(regions.length, 7);
  assert.equal(new Set(regions.map(region => region.id)).size, 7);
  for (const [level, lessonCount] of [['p2', 19], ['p5', 17]]) {
    const config = readJson(`content/authored/levels/${level}/level.json`);
    assert.deepEqual(Object.keys(config.regionLessons), regions.map(region => region.id));
    const lessons = Object.values(config.regionLessons).flat();
    assert.equal(lessons.length, lessonCount);
    assert.equal(new Set(lessons).size, lessonCount);
    assert.deepEqual([...lessons].sort((a, b) => a - b), Array.from({ length: lessonCount }, (_, index) => index + 1));
  }
});

test('the modular build vendors Hanzi Writer and both required licenses', () => {
  for (const file of ['hanzi-writer.min.js', 'LICENSE', 'ARPHICPL.TXT']) {
    const stat = fs.statSync(path.join(root, 'vendor', 'hanzi-writer', file));
    assert.ok(stat.size > 500, `${file} should not be empty`);
  }
});
