const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('every creature has a named defensive spell', async () => {
  const { CREATURES, creatureSpellName } = await import('../src/battle/creatures.js');
  for (const creature of CREATURES) {
    const name = creatureSpellName(creature);
    assert.ok(name && !name.includes('undefined'), creature.id);
  }
  assert.equal(creatureSpellName(CREATURES.find(creature => creature.id === 'minute-mite')), 'Hanzi Hex');
  assert.equal(creatureSpellName({ id: 'future-creature' }), 'Word Spell');
  assert.match(read('src/gameplay.js'), /const spell = creatureSpellName\(battle\.creature\)/);
});

test('collection and daily panels use optimized artwork', () => {
  const gameplay = read('src/gameplay.js');
  const collection = read('src/collection.js');
  const adventure = read('src/adventure.js');
  assert.match(gameplay, /ui\/spirit-book\.webp/);
  assert.match(collection, /gearImage\(gear\.id\)/);
  assert.match(adventure, /ui\/daily-board\.webp/);
  for (const file of ['spirit-book.webp', 'traveler-bag.webp', 'daily-board.webp']) {
    const stat = fs.statSync(path.join(root, 'assets/images/ui', file));
    assert.ok(stat.size < 80_000, file);
  }
  for (const gear of JSON.parse(read('content/authored/shared/gear.json'))) {
    assert.ok(fs.existsSync(path.join(root, 'assets/images/gear', `${gear.id}.webp`)), gear.id);
  }
});
