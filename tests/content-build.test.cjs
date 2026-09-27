const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load: loadYaml } = require('js-yaml');
const { playableIds } = require('./support/levels.cjs');

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

test('every playable curriculum has a complete generated pack matching its source', () => {
  for (const level of playableIds) {
    const sourceRoot = path.join(root, 'content', 'source', level);
    const meta = loadYaml(fs.readFileSync(path.join(sourceRoot, 'meta.yaml'), 'utf8'));
    const content = readJson(`content/generated/${level}.content.json`);
    const sourceWordCount = Array.from({ length: meta.lessonCount }, (_, index) => index + 1)
      .reduce((total, lesson) => total + (loadYaml(fs.readFileSync(path.join(sourceRoot, 'tingxie', `${lesson}.yaml`), 'utf8')).vocab || []).length, 0);
    assert.equal(content.level, level);
    assert.equal(content.lessons.length, meta.lessonCount, `${level}: generated lesson count`);
    assert.equal(content.stories.length, meta.lessonCount, `${level}: generated story count`);
    assert.equal(content.words.length, sourceWordCount, `${level}: generated word count`);
    assert.ok(content.questions.single.length > 0, `${level}: generated standalone questions`);
  }
});

test('every playable curriculum packages its vocabulary Hanzi without radical metadata', () => {
  for (const level of playableIds) {
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
  for (const level of playableIds) {
    const config = readJson(`content/authored/levels/${level}/level.json`);
    const lessonCount = readJson(`content/generated/${level}.content.json`).lessons.length;
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
