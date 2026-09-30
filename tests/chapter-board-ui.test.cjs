const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8')) });

test('chapter regions show a story path on the Daily Board and an integrated Journal checklist', async () => {
  const { activateRegion, loadLevelPackage } = await import('../src/content/loader.js');
  const { createFreshState } = await import('../src/core/state.js');
  const { createOverlay } = await import('../src/ui/overlay.js');
  const { createAdventure } = await import('../src/adventure.js');
  const base = await loadLevelPackage('p5', fetcher, '');
  const dom = new JSDOM('<div id="overlay" hidden></div>');
  const oldWindow = global.window;
  const oldDocument = global.document;
  const oldMatchMedia = global.matchMedia;
  global.window = dom.window;
  global.document = dom.window.document;
  global.matchMedia = () => ({ matches: true });
  try {
    for (const [region, title] of [['r3', 'Help the stranded whale'], ['r4', 'Bring the play together'], ['r6', 'Reconstruct the ancient account']]) {
      const game = activateRegion(base, region);
      const state = createFreshState(game);
      state.progress.story.flags.arrival = true;
      const active = { levelPackage: game, state };
      const overlay = createOverlay(dom.window.document.querySelector('#overlay'));
      const adventure = createAdventure({ overlay, getActive: () => active, persist() {}, render() {}, toast() {}, gameplay: { battlesLeft: () => 30 }, audio: { sfx() {} } });
      adventure.questBoard();
      const board = dom.window.document.querySelector('.daily-board-panel');
      assert.match(board.querySelector('.daily-chapter').textContent, new RegExp(title));
      assert.equal(board.querySelectorAll('.quest-card').length, 3);
      assert.ok(board.querySelector('.daily-chapter').compareDocumentPosition(board.querySelector('.daily-quests')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
      board.querySelector('[data-board-journal]').click();
      const journal = dom.window.document.querySelector('.rescue-journal');
      assert.match(journal.textContent, new RegExp(title));
      assert.ok(journal.querySelectorAll('.chapter-journal-list li').length >= 5);
      assert.doesNotMatch(journal.textContent, /dictation|from memory|2\/3/i);
    }
  } finally {
    global.window = oldWindow;
    global.document = oldDocument;
    global.matchMedia = oldMatchMedia;
    dom.window.close();
  }
});

test('the three chapter walkthroughs introduce the village before the story and route reference', async () => {
  for (const region of [3, 4, 6]) {
    const dom = new JSDOM(`<body data-region="r${region}"><div id="guide-root"></div></body>`, { url: `http://localhost/walkthrough/walkthrough-region-${region}.html?level=p5` });
    const oldDocument = global.document;
    const oldLocation = global.location;
    const oldFetch = global.fetch;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.fetch = async url => {
      const file = path.resolve(root, 'walkthrough', url);
      return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
    };
    try {
      await import(`../walkthrough/walkthrough.js?chapter-order-${region}-${Date.now()}`);
      for (let attempt = 0; attempt < 20 && !dom.window.document.querySelector('.story-preview'); attempt += 1) await new Promise(resolve => setTimeout(resolve, 5));
      const ids = [...dom.window.document.querySelectorAll('main > section')].map(section => section.id);
      assert.equal(ids[0], 'town');
      assert.ok(ids.indexOf('route') > ids.indexOf('town'));
      assert.ok(dom.window.document.querySelector('.story-preview').compareDocumentPosition(dom.window.document.querySelector('#route')) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
      assert.equal(dom.window.document.querySelector('.journal-sample'), null);
    } finally {
      global.document = oldDocument;
      global.location = oldLocation;
      global.fetch = oldFetch;
      dom.window.close();
    }
  }
});
