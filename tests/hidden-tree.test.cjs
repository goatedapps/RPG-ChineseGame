const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const imagePath = 'assets/images/secrets/spirit-brush-whisper.png';

test('the lower-right Scholar Village tree opens a downloadable Spirit Brush picture', async () => {
  const { attemptStep, isWalkable } = await import('../src/world/map.js');
  const { createAdventure } = await import('../src/adventure.js');
  const map = JSON.parse(fs.readFileSync(path.join(root, 'content/authored/campaign/maps/r1-hub.json'), 'utf8'));
  const tree = map.objects.find(object => object.id === 'whispering-tree');
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

  const dom = new JSDOM('<div id="overlay"></div>');
  const panel = dom.window.document.querySelector('#overlay');
  const active = { levelPackage: { region: { id: 'r1' }, map, campaigns: {} }, state: {} };
  const adventure = createAdventure({ overlay: { open: html => { panel.innerHTML = html; } }, getActive: () => active });
  assert.equal(adventure.handleInteraction(tree), true);
  assert.equal(panel.querySelector('img').getAttribute('src'), imagePath);
  assert.equal(panel.querySelector('a[download]').getAttribute('href'), imagePath);
  assert.equal(panel.querySelector('a[download]').getAttribute('download'), 'spirit-brush-whisper.png');
  assert.ok(panel.querySelector('[data-close-overlay]'));
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /assets\/images\/secrets\/spirit-brush-whisper\.png/);
});

test('the optimized PNG keeps the encoded secret in portable PNG text metadata', () => {
  const png = fs.readFileSync(path.join(root, imagePath));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length < 500_000);
  const metadata = {};
  for (let offset = 8; offset + 12 <= png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'tEXt') {
      const data = png.subarray(offset + 8, offset + 8 + length);
      const separator = data.indexOf(0);
      metadata[data.toString('latin1', 0, separator)] = data.toString('latin1', separator + 1);
    }
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.equal(metadata.Encoding, 'ROT13, then Base64');
  const rot13 = text => text.replace(/[a-z]/gi, character => String.fromCharCode(
    character.charCodeAt(0) + (character.toLowerCase() <= 'm' ? 13 : -13)
  ));
  const secret = rot13(Buffer.from(metadata.Comment, 'base64').toString('utf8'));
  assert.equal(createHash('sha256').update(secret).digest('hex'), '5bf66220f0fc43d8e0f513da93fab962f4b157bc7075b69536765e8ea7ff5701');
  assert.equal(png.includes(Buffer.from(secret)), false);
});
