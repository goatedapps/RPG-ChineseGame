const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('the game uses the generated logo for its header, favicon and install icon', () => {
  const game = read('game/index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const cache = read('sw.js');
  assert.match(game, /class="game-logo"[^>]+word-spirit-logo\.webp/);
  assert.match(game, /rel="icon"[^>]+favicon-32\.png/);
  assert.match(game, /rel="apple-touch-icon"[^>]+apple-touch-icon\.png/);
  assert.equal(manifest.icons.length, 2);
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src);
  for (const asset of ['word-spirit-logo.webp', 'favicon-32.png', 'apple-touch-icon.png', 'app-icon-192.png', 'app-icon-512.png']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/images/brand', asset)), asset);
    assert.ok(cache.includes(asset), `${asset} should be available offline`);
  }
  assert.doesNotMatch(game, /atlas-region-emblem/);
});

test('building label studies are a standalone HTML preview using existing sprites and live text', () => {
  const preview = read('design-previews/building-labels.html');
  assert.match(preview, /assets\/images\/atlas\/buildings\.webp/);
  for (const look of ['Hanging plaque', 'Paper scroll', 'Side pennant']) assert.ok(preview.includes(look));
  assert.match(preview, /textContent = names\[selected\]/);
});
