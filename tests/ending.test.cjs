const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mapFiles = ['r1-hub', 'r2-harvest-crossing', 'r3-tidewater-bay', 'r4-lantern-theatre', 'r5-festival-city', 'r6-ancient-grove', 'r7-treehouse-summit'];

test('the restored world adds one reachable Word Portal to each village', async () => {
  const { activateVillagePortals } = await import('../src/systems/ending.js');
  const { isWalkable, attemptStep } = await import('../src/world/map.js');
  const campaigns = Object.fromEntries(mapFiles.map((file, index) => [`r${index + 1}`, { map: JSON.parse(read(`content/authored/campaign/maps/${file}.json`)) }]));
  activateVillagePortals(campaigns);
  activateVillagePortals(campaigns);
  for (const campaign of Object.values(campaigns)) {
    const map = campaign.map;
    const portals = map.objects.filter(object => object.id === 'word-portal');
    assert.equal(portals.length, 1, map.name);
    const portal = portals[0];
    assert.equal(isWalkable(map, portal.x, portal.y), false);
    const approach = [{ x: portal.x - 1, y: portal.y, direction: 'right' }, { x: portal.x + 1, y: portal.y, direction: 'left' }, { x: portal.x, y: portal.y - 1, direction: 'down' }, { x: portal.x, y: portal.y + 1, direction: 'up' }].find(tile => isWalkable(map, tile.x, tile.y));
    assert.ok(approach, `${map.name} portal needs an approach`);
    assert.equal(attemptStep(approach, map, approach.direction).interaction.id, 'word-portal');
  }
});

test('finale ledger distinguishes collected and unfinished optional discoveries', async () => {
  const { finaleLedger } = await import('../src/systems/ending.js');
  const regions = JSON.parse(read('content/authored/campaign/regions.json'));
  const campaigns = Object.fromEntries(regions.map(region => [region.id, {
    region,
    regionStory: JSON.parse(read(`content/authored/campaign/${region.id}-story.json`)),
    sets: []
  }]));
  const ledger = finaleLedger({ region: regions[6], campaigns }, { progress: {
    story: { requests: {} }, regions: { r1: { story: { flags: { hiddenGrove: true }, requests: { xiaoqiang: 3 } } } },
    scrolls: { unlocked: [{ type: 'Idiom Scroll' }] }, sets: {}, room: { decorations: ['forest-shapes'], trophies: [] }
  } });
  assert.equal(ledger.chapters.length, 7);
  assert.ok(ledger.completed.some(entry => entry.name === 'Hidden Grove scroll'));
  assert.ok(ledger.completed.some(entry => entry.name.includes('Xiaoqiang')));
  assert.ok(ledger.missing.some(entry => entry.name.includes('Chef Mei')));
  for (const chapter of ledger.chapters) assert.ok(fs.existsSync(path.join(root, chapter.image)), chapter.image);
  const notCollected = finaleLedger({ region: regions[6], campaigns }, { progress: {
    story: { requests: {} }, regions: { r1: { story: { flags: { hiddenGrove: true }, requests: {} } } },
    scrolls: { unlocked: [] }, sets: {}, room: { decorations: [], trophies: [] }
  } });
  assert.ok(notCollected.missing.some(entry => entry.name === 'Hidden Grove scroll'));
});

test('finishing the Dictionary Heart awards the finale once and persists portals', async () => {
  const { completeDictionaryHeart } = await import('../src/systems/ending.js');
  const campaigns = Object.fromEntries(mapFiles.map((file, index) => [`r${index + 1}`, { map: JSON.parse(read(`content/authored/campaign/maps/${file}.json`)) }]));
  const state = { player: { coins: 20 }, progress: { story: { bossDefeated: true, flags: {} }, flags: {}, scrolls: { unlocked: [] } } };
  assert.equal(completeDictionaryHeart({ campaigns }, state, '2026-09-28'), true);
  assert.equal(completeDictionaryHeart({ campaigns }, state, '2026-09-29'), true);
  assert.equal(state.player.coins, 140);
  assert.equal(state.progress.scrolls.unlocked.length, 1);
  assert.equal(state.progress.flags.worldRestored, true);
  assert.ok(Object.values(campaigns).every(campaign => campaign.map.objects.filter(object => object.id === 'word-portal').length === 1));
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(saved.progress.flags.worldRestored, true);
});

test('the final blow splits the boss before the story scenes and automatic full-screen credits', async () => {
  const { showFinalBlow, showFinale } = await import('../src/ui/ending.js');
  const dom = new JSDOM('<div id="overlay"></div>', { url: 'http://localhost/' });
  const previousDocument = global.document;
  const previousRaf = global.requestAnimationFrame;
  global.document = dom.window.document;
  global.requestAnimationFrame = () => 0;
  try {
    let returned = 0;
    let storyStarted = 0;
    showFinalBlow({ open(html) { dom.window.document.querySelector('#overlay').innerHTML = html; } }, '<div class="hero-avatar"></div>', '<div class="creature-portrait"></div>', () => { storyStarted += 1; });
    assert.ok(dom.window.document.querySelector('.finale-screen .final-blow-left'));
    assert.ok(dom.window.document.querySelector('.finale-screen .final-blow-right'));
    dom.window.document.querySelector('[data-final-blow-continue]').click();
    assert.equal(storyStarted, 1);
    showFinale({ open(html) { dom.window.document.querySelector('#overlay').innerHTML = html; } }, {
      chapters: [{ region: 'Scholar Village', boss: 'Muddle King', image: 'assets/images/creatures/muddle-king.webp', fragment: 'Dawn Stroke' }],
      completed: [{ region: 'Scholar Village', name: 'Hidden Grove scroll' }], missing: [], decorations: [], trophies: []
    }, () => { returned += 1; });
    assert.match(dom.window.document.body.textContent, /The last seal breaks/);
    for (let index = 0; index < 3; index += 1) dom.window.document.querySelector('[data-ending-next]').click();
    assert.match(dom.window.document.body.textContent, /Every word has a place again/);
    assert.match(dom.window.document.body.textContent, /Muddle King/);
    assert.ok(dom.window.document.querySelector('.ending-credits-viewport'));
    assert.equal(dom.window.document.querySelector('[data-ending-scroll]'), null);
    assert.match(read('css/stage.css'), /\.overlay\.full-screen-overlay \{ position: fixed/);
    dom.window.document.querySelector('[data-ending-return]').click();
    assert.equal(returned, 1);
    assert.ok(fs.statSync(path.join(root, 'assets/images/ending/dictionary-tree-restored.webp')).size < 400_000);
    assert.match(read('sw.js'), /dictionary-tree-restored\.webp/);
  } finally {
    global.document = previousDocument;
    global.requestAnimationFrame = previousRaf;
  }
});

test('homecoming keeps a scrollable message and a separate visible action footer', async () => {
  const { createOverlay } = await import('../src/ui/overlay.js');
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    const element = dom.window.document.querySelector('#overlay');
    const overlay = createOverlay(element);
    overlay.open('<div class="panel homecoming-panel"><div class="homecoming-copy"><details><summary>Optional discoveries</summary></details></div><div class="homecoming-actions"><button data-close-overlay>Explore</button></div></div>');
    assert.ok(element.classList.contains('full-screen-overlay'));
    assert.ok(element.querySelector('.homecoming-copy'));
    assert.ok(element.querySelector('.homecoming-actions'));
    overlay.close();
    assert.equal(element.classList.contains('full-screen-overlay'), false);
  } finally {
    global.document = previousDocument;
  }
});
