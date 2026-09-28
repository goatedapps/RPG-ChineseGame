const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('root homepage is playable and old game links preserve their query and hash', () => {
  const page = new JSDOM(read('index.html'));
  assert.ok(page.window.document.querySelector('#world'));
  assert.match(page.window.document.querySelector('script[type="module"]').getAttribute('src'), /^\.\/src\/main\.js/);
  assert.match(read('game/index.html'), /location\.replace\('\.\.\/' \+ location\.search \+ location\.hash\)/);
  assert.equal(JSON.parse(read('manifest.webmanifest')).start_url, './');
  assert.match(read('sw.js'), /'\.\/index\.html'/);
  assert.match(read('sw.js'), /caches\.match\(`\$\{url\.origin\}\$\{url\.pathname\}`\)/);
  assert.match(read('src/main.js'), /scope: new URL\('\.\.\/', import\.meta\.url\)\.href/);
});

test('the separate walkthrough has an introduction and one page for each region', () => {
  const intro = new JSDOM(read('walkthrough/index.html'));
  assert.equal(intro.window.document.body.dataset.region, 'intro');
  for (let number = 1; number <= 7; number += 1) {
    const file = `walkthrough/walkthrough-region-${number}.html`;
    const page = new JSDOM(read(file));
    assert.equal(page.window.document.body.dataset.region, `r${number}`);
    assert.match(read('sw.js'), new RegExp(`walkthrough-region-${number}\\.html`));
  }
  const guide = read('walkthrough/walkthrough.js');
  assert.match(guide, /Everything sold at/);
  assert.match(guide, /What each battle move practises/);
  assert.match(guide, /Creature levels/);
  assert.match(guide, /bossLevel/);
  assert.match(guide, /Tidewater Bay chapter/);
  assert.match(guide, /Fisher Yu[\s\S]*Maker Chen[\s\S]*Watcher An/);
  assert.match(guide, /tidewater-whale-rescue\.webp/);
  assert.match(guide, /entering again from town starts me at the route entrance/);
  assert.doesNotMatch(guide, /Useful now|default settings|What I learned/);
  assert.match(read('src/gameplay.js'), /parent-walkthrough-link[\s\S]*walkthrough\/index\.html/);
});
