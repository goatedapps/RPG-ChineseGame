const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const imageRoot = path.join(root, 'assets', 'images');
const illustratedFolders = ['creatures', 'rewards', 'shop', 'hero', 'story', 'atlas'];

test('illustrated game art stays compact and available offline', () => {
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  let illustratedCount = 0;

  for (const folder of illustratedFolders) {
    const names = fs.readdirSync(path.join(imageRoot, folder));
    assert.equal(names.filter(name => name.endsWith('.png')).length, 0, `${folder} still has unoptimised PNGs`);
    for (const name of names.filter(name => name.endsWith('.webp'))) {
      const relativePath = `assets/images/${folder}/${name}`;
      const size = fs.statSync(path.join(imageRoot, folder, name)).size;
      assert.ok(size <= 500 * 1024, `${relativePath} exceeds the art size budget`);
      assert.ok(serviceWorker.includes(`./${relativePath}`), `${relativePath} is missing from offline cache`);
      illustratedCount += 1;
    }
  }

  assert.ok(illustratedCount >= 73, 'expected the existing illustrated art collection');
  const cachedImages = [...serviceWorker.matchAll(/'\.\/(assets\/images\/[^']+)'/g)].map(match => match[1]);
  const cachedBytes = cachedImages.reduce((total, relativePath) => {
    const fullPath = path.join(root, relativePath);
    assert.ok(fs.existsSync(fullPath), `${relativePath} is missing`);
    return total + fs.statSync(fullPath).size;
  }, 0);
  assert.ok(cachedBytes <= 20 * 1024 * 1024, 'offline image cache exceeds 20 MiB');
});
