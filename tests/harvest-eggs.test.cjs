const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'content/authored/campaign/maps/r2-harvest-crossing.json'), 'utf8'));

test('the lower-right Harvest Crossing tree gives the decoy reply', async () => {
  const { attemptStep, isWalkable } = await import('../src/world/map.js');
  const { createAdventure } = await import('../src/adventure.js');
  const tree = map.objects.find(object => object.id === 'harvest-decoy-tree');
  assert.deepEqual([tree.x, tree.y], [map.width - 1, map.height - 2]);
  assert.equal(isWalkable(map, tree.x - 1, tree.y), true);
  const visited = new Set([`${map.spawn.x},${map.spawn.y}`]);
  const queue = [map.spawn];
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: x + dx, y: y + dy };
      const key = `${next.x},${next.y}`;
      if (!visited.has(key) && isWalkable(map, next.x, next.y)) { visited.add(key); queue.push(next); }
    }
  }
  assert.ok(visited.has(`${tree.x - 1},${tree.y}`));
  assert.equal(attemptStep({ x: tree.x - 1, y: tree.y, direction: 'right' }, map, 'right').interaction.id, tree.id);
  let dialogue;
  const active = { levelPackage: { region: { id: 'r2' }, map, campaigns: {} }, state: {} };
  const adventure = createAdventure({ overlay: { dialogue: value => { dialogue = value; } }, getActive: () => active });
  assert.equal(adventure.handleInteraction(tree), true);
  assert.deepEqual(dialogue.lines, ['Not so easy! The real easter egg is somewhere else in this town']);
});

test('the pond passage copies its complete message through homoglyphs', async () => {
  const { createAdventure } = await import('../src/adventure.js');
  const { harvestPondPassage } = await import('../src/content/harvestPond.js');
  assert.equal(map.tiles[13][5], 'w');
  assert.equal(map.objects.find(object => object.id === 'school').rect.x, 10);
  const dom = new JSDOM('<div id="overlay"></div>');
  const panel = dom.window.document.querySelector('#overlay');
  const active = { levelPackage: { region: { id: 'r2' }, map, campaigns: {} }, state: {} };
  createAdventure({ overlay: { open: html => { panel.innerHTML = html; } }, getActive: () => active }).harvestPond();
  assert.equal(panel.querySelector('.pond-passage').textContent, harvestPondPassage);
  const ascii = 'abcdefghijklmnopqrstuvwxyz';
  const lookalikes = 'аЬсԁе𝖿ɡһіϳκӏ𝗆ոорԛ𝗋ѕτυνԝхуᴢ';
  const reverse = new Map([...lookalikes].map((glyph, index) => [glyph, ascii[index]]));
  for (const [glyph, letter] of [['Ԍ', 'G'], ['І', 'I'], ['С', 'C'], ['\u00a0', ' '], ['‚', ','], ['ǃ', '!'], ['ʼ', "'"], ['‐', '-'], ['․', '.']]) reverse.set(glyph, letter);
  const decoded = [...panel.querySelector('.pond-passage').textContent].filter(glyph => glyph.codePointAt(0) > 127).map(glyph => reverse.get(glyph)).join('');
  assert.equal(decoded.length, 157);
  assert.equal(createHash('sha256').update(decoded).digest('hex'), '23894c2b89d82c8175a45f8060fb9df573feee4c8e31db82610008069abab297');
  assert.equal(fs.readFileSync(path.join(root, 'src/content/harvestPond.js'), 'utf8').includes(decoded), false);
});

test('pond hit testing follows the rendered camera and CSS scaling', async () => {
  const { createRenderer } = await import('../src/world/renderer.js');
  const { isHarvestPondCenter } = await import('../src/world/harvestPond.js');
  const canvas = {
    width: 800,
    height: 600,
    getContext: () => ({}),
    getBoundingClientRect: () => ({ left: 20, top: 40, right: 420, bottom: 340, width: 400, height: 300 })
  };
  const renderer = createRenderer(canvas, map);
  const center = renderer.tileAtClientPoint(108, 158, { x: 9, y: 15 });
  assert.deepEqual(center, { x: 5, y: 13 });
  assert.equal(isHarvestPondCenter(map, center), true);
  assert.equal(isHarvestPondCenter(map, { x: 4, y: 12 }), true);
  assert.equal(isHarvestPondCenter(map, { x: 6, y: 14 }), true);
  assert.equal(isHarvestPondCenter(map, { x: 3, y: 13 }), false);
  assert.equal(isHarvestPondCenter(map, { x: 5, y: 11 }), false);
  assert.equal(renderer.tileAtClientPoint(10, 158, { x: 9, y: 15 }), null);
  renderer.dispose();
});
