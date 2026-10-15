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

test('every curriculum walkthrough matches village shops, cosmetics and lessons without invalid references', async () => {
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const { shopItemsForRegion } = await import('../src/systems/shop.js');
  for (const level of require('./support/levels.cjs').playableIds) {
    const config = JSON.parse(read(`content/authored/levels/${level}/level.json`));
    const game = await loadLevelPackage(level, async url => ({ ok: true, json: async () => JSON.parse(read(url.replace(/^\//, ''))) }), '');
    for (let number = 0; number <= 7; number += 1) {
      const region = number ? `r${number}` : 'intro';
      const file = number ? `walkthrough-region-${number}.html` : 'index.html';
      const dom = new JSDOM(read(`walkthrough/${file}`), { url: `http://localhost/walkthrough/${file}?level=${level}` });
      const previousDocument = global.document;
      const previousLocation = global.location;
      const previousFetch = global.fetch;
      global.document = dom.window.document;
      global.location = dom.window.location;
      global.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.resolve(root, 'walkthrough', url), 'utf8')) });
      try {
        await import(`../walkthrough/walkthrough.js?lesson-label-${level}-${region}`);
        for (let attempt = 0; attempt < 20 && !dom.window.document.querySelector(number ? '#route' : 'main'); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
        const main = dom.window.document.querySelector('main');
        assert.ok(main, `${level} ${region} rendered`);
        assert.doesNotMatch(dom.window.document.body.textContent, /\b(?:undefined|null|NaN)\b/, `${level} ${region}: no invalid text, including closed disclosures`);
        for (const element of dom.window.document.querySelectorAll('*')) {
          for (const attribute of element.attributes) assert.doesNotMatch(attribute.value, /\b(?:undefined|null|NaN)\b/, `${level} ${region}: valid ${attribute.name}`);
        }
        for (const image of main.querySelectorAll('img')) {
          assert.ok(fs.existsSync(path.resolve(root, 'walkthrough', image.getAttribute('src'))), `${level} ${region}: image exists`);
        }
        assert.match(main.textContent, /room decorations/i);
        assert.match(main.textContent, /outfits/i);
        if (!number) continue;
        const stock = main.querySelector('#shop-stock');
        assert.ok(stock, `${level} ${region}: village shop list`);
        const expectedItems = shopItemsForRegion(game.items, region);
        const actualItems = [...stock.querySelectorAll('[data-shop-item]')];
        assert.deepEqual(actualItems.map(row => row.dataset.shopItem).sort(), expectedItems.map(item => item.id).sort());
        for (const item of expectedItems) {
          const row = actualItems.find(row => row.dataset.shopItem === item.id);
          assert.equal(row.cells[0].textContent, item.name);
          assert.equal(row.cells[1].textContent, `${item.price} coins`);
          if (item.effect === 'heal') assert.equal(row.cells[2].textContent, `Restore ${item.amount} HP during battle, up to maximum HP.`);
          if (item.effect === 'full-heal') assert.equal(row.cells[2].textContent, 'Restore all HP during battle.');
        }
        const expectedCosmetics = game.cosmetics.filter(item => item.region === region);
        const actualCosmetics = [...stock.querySelectorAll('[data-shop-cosmetic]')];
        assert.deepEqual(actualCosmetics.map(row => row.dataset.shopCosmetic).sort(), expectedCosmetics.map(item => item.id).sort());
        for (const item of expectedCosmetics) {
          const row = actualCosmetics.find(row => row.dataset.shopCosmetic === item.id);
          assert.equal(row.cells[0].textContent, item.name);
          assert.equal(row.cells[1].textContent, `${item.price} coins`);
          assert.ok(row.cells[2].textContent.includes(item.description));
          if (item.requires) assert.ok(row.cells[2].textContent.includes(game.cosmetics.find(candidate => candidate.id === item.requires).name));
        }
        if (!expectedCosmetics.length) assert.match(stock.textContent, /No room decorations are sold.*No outfits are sold/);
        const cap = game.gear.find(item => item.id === 'red-cap');
        assert.equal(stock.querySelector('[data-shop-gear]').cells[1].textContent, `${cap.price} coins`);
        assert.deepEqual([...stock.querySelectorAll('[data-shop-bait]')].map(row => Number(row.dataset.shopBait)), config.regionLessons[region]);
        const bossLevel = Math.max(...config.regionLessons[region].map(lesson => game.balance.combat.lessonLevels[String(lesson)][1])) + 1;
        assert.ok(main.querySelector('#boss .checkpoint').textContent.includes(`Level ${bossLevel}`), `${level} ${region}: tuned boss level`);
        assert.match(main.textContent, /Choose the sentence that uses the word correctly/);
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
