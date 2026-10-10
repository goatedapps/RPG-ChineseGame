const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const strings = JSON.parse(fs.readFileSync('content/authored/shared/strings.json', 'utf8'));
function setup(markup) {
  const dom = new JSDOM(`<div id="overlay">${markup}</div>`);
  const root = dom.window.document.querySelector('#overlay');
  const game = { state: { progress: { flags: {}, tutorial: { step: 16, partTwoIntroduced: true }, encounter: {} } }, levelPackage: { strings, map: { route: true } } };
  return { dom, root, game };
}
const targets = [
  ['companion', '<aside class="companion-battle-card"><button data-companion-skill>Help</button></aside>'],
  ['restoration', '<article class="set-card"><button data-offer="set">Restore</button></article>'],
  ['crafting', '<div class="craft-panel"><article class="craft-card"><button data-craft="gear">Craft</button></article></div>'],
  ['equipment', '<div class="hero-status-panel"><article class="gear-card"><button data-equip="gear">Equip</button></article></div>'],
  ['dailyChest', '<div class="daily-board-panel"><section class="daily-quests"><button data-daily-chest>Open</button></section></div>'],
  ['gateDictation', '<div class="button-row"><button data-gate-test>Test</button></div>'],
  ['repellent', '<div class="bag-panel"><div class="bag-list"><article><button data-use-repellent="forest-repellent">Use</button></article></div></div>']
];
test('Jun notes appear at available actions and retire persistently on feature use or dismissal', async () => {
  const { attachJunReminder } = await import('../src/ui/junReminder.js');
  for (const [key, markup] of targets) {
    for (const dismiss of [true, false]) {
      const { dom, root, game } = setup(markup);
      let saves = 0;
      attachJunReminder(game, root, () => saves++);
      assert.equal(root.querySelectorAll('.jun-reminder').length, 1, key);
      assert.equal(saves, 0);
      attachJunReminder(game, root, () => saves++);
      assert.equal(root.querySelectorAll('.jun-reminder').length, 1);
      const action = root.querySelector('button:not(.jun-reminder button)');
      let actions = 0;
      action.addEventListener('click', () => actions++);
      const button = dismiss ? root.querySelector('.jun-reminder button') : action;
      button.focus(); button.click();
      assert.equal(saves, 1);
      assert.equal(actions, dismiss ? 0 : 1);
      assert.equal(game.state.progress.flags[`jun-reminder-${key}`], true);
      assert.equal(root.querySelector('.jun-reminder'), null);
      if (dismiss) assert.equal(dom.window.document.activeElement, action);
      root.innerHTML = markup;
      const resumed = JSON.parse(JSON.stringify(game));
      attachJunReminder(resumed, root, () => saves++);
      assert.equal(root.querySelector('.jun-reminder'), null);
      dom.window.close();
    }
  }
});
test('Jun never interrupts incomplete, skipped, unenrolled, hidden, disabled or question screens', async () => {
  const { attachJunReminder } = await import('../src/ui/junReminder.js');
  for (const change of [g => g.state.progress.tutorial.step = 9, g => g.state.progress.tutorial.skipped = true, g => delete g.state.progress.tutorial.partTwoIntroduced, g => g.state.progress.tutorial.pending = 15]) {
    const { dom, root, game } = setup(targets[0][1]); change(game);
    attachJunReminder(game, root, () => assert.fail('Unexpected save'));
    assert.equal(root.querySelector('.jun-reminder'), null); dom.window.close();
  }
  for (const [, markup] of targets) {
    for (const exclusion of ['hidden', 'disabled', 'question-panel', 'writing-panel']) {
      const { dom, root, game } = setup(markup);
      if (exclusion === 'hidden') root.hidden = true;
      else if (exclusion === 'disabled') root.querySelector('button').disabled = true;
      else root.firstElementChild.classList.add(exclusion);
      attachJunReminder(game, root, () => assert.fail('Unexpected save'));
      assert.equal(root.querySelector('.jun-reminder'), null); dom.window.close();
    }
  }
});
test('Repellent note waits for the route and an inactive effect', async () => {
  const { attachJunReminder } = await import('../src/ui/junReminder.js');
  const { dom, root, game } = setup(targets.at(-1)[1]);
  game.levelPackage.map.route = false;
  attachJunReminder(game, root, () => {}); assert.equal(root.querySelector('.jun-reminder'), null);
  game.levelPackage.map.route = true; game.state.progress.encounter.repellentSteps = 12;
  attachJunReminder(game, root, () => {}); assert.equal(root.querySelector('.jun-reminder'), null);
  game.state.progress.encounter.repellentSteps = 0;
  attachJunReminder(game, root, () => {}); assert.ok(root.querySelector('.jun-reminder')); dom.window.close();
});
test('dismissed notes survive the existing save migration', async () => {
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const pkg = { id: 'p6', content: { contentVersion: 'test' }, map: { id: 'r1-hub', spawn: { x: 20, y: 14 } } };
  const state = createFreshState(pkg);
  state.progress.tutorial = { ...state.progress.tutorial, step: 16, partTwoIntroduced: true };
  state.progress.flags['jun-reminder-crafting'] = true;
  const migrated = migrateState(JSON.parse(JSON.stringify(state)), pkg);
  assert.equal(migrated.progress.flags['jun-reminder-crafting'], true);
  assert.equal(migrated.progress.tutorial.partTwoIntroduced, true);
});
