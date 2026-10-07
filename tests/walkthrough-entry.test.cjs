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
  assert.match(guide, /records a creature only after I defeat it/);
  assert.match(guide, /Elite cards sparkle violet; Golden cards sparkle gold/);
  assert.match(guide, /An Elite partner earns 6 extra coins.*Golden partner earns 12/);
  assert.doesNotMatch(guide, /Useful now|default settings|What I learned/);
  assert.match(read('src/gameplay.js'), /parent-walkthrough-link[\s\S]*walkthrough\/index\.html/);
});

test('every curriculum walkthrough resolves lesson labels from its region mapping', async () => {
  for (const level of require('./support/levels.cjs').playableIds) {
    const config = JSON.parse(read(`content/authored/levels/${level}/level.json`));
    for (let number = 1; number <= 7; number += 1) {
      const region = `r${number}`;
      const dom = new JSDOM(read(`walkthrough/walkthrough-region-${number}.html`), { url: `http://localhost/walkthrough/walkthrough-region-${number}.html?level=${level}` });
      const previousDocument = global.document;
      const previousLocation = global.location;
      const previousFetch = global.fetch;
      global.document = dom.window.document;
      global.location = dom.window.location;
      global.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.resolve(root, 'walkthrough', url), 'utf8')) });
      try {
        await import(`../walkthrough/walkthrough.js?lesson-label-${level}-${region}`);
        for (let attempt = 0; attempt < 20 && !dom.window.document.querySelector('#route'); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
        const main = dom.window.document.querySelector('main');
        assert.ok(main, `${level} ${region} rendered`);
        assert.doesNotMatch(main.textContent, /Lesson (?:undefined|null|NaN)/, `${level} ${region} has resolved lesson labels`);
        for (const lesson of config.regionLessons[region]) assert.match(main.textContent, new RegExp(`Lesson ${lesson}\\b`), `${level} ${region} names Lesson ${lesson}`);
        if (region === 'r3') {
          for (const lesson of config.regionLessons.r3) assert.match(dom.window.document.querySelector('#rescue-story').textContent, new RegExp(`Lesson ${lesson}\\b`));
        }
      } finally {
        global.document = previousDocument;
        global.location = previousLocation;
        global.fetch = previousFetch;
        dom.window.close();
      }
    }
  }
});
