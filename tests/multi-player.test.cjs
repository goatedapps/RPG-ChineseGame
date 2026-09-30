const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, url), 'utf8')) });
const memoryStorage = entries => {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test('existing single-player saves become a selectable profile without moving save keys', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { encodeSave, listPlayers, loadLevelState, renamePlayer, saveKey } = await import('../src/core/save.js');
  const level = await (await import('../src/content/loader.js')).loadLevelPackage('p5', fetcher, '');
  const state = createFreshState(level);
  state.player.coins = 73;
  const oldSave = encodeSave(state);
  const storage = memoryStorage([[saveKey('p5'), oldSave]]);
  assert.deepEqual(listPlayers(storage, ['p2', 'p5']), [{ id: 'legacy', name: 'Player 1' }]);
  const renamed = renamePlayer(storage, 'legacy', 'Mei', ['p2', 'p5']);
  assert.equal(renamed.name, 'Mei');
  assert.equal(storage.getItem(saveKey('p5')), oldSave);
  assert.equal(loadLevelState(storage, level, renamed.id).state.player.coins, 73);
});

test('players keep independent saves, backups, and curriculum progress', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { backupKey, createPlayer, listPlayers, loadLevelState, saveKey, saveLevelState, saveProfile, startFreshLevelState } = await import('../src/core/save.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const p2 = await loadLevelPackage('p2', fetcher, '');
  const p5 = await loadLevelPackage('p5', fetcher, '');
  const storage = memoryStorage();
  const mei = createPlayer(storage, ' Mei ', ['p2', 'p5']);
  const jun = createPlayer(storage, 'Jun', ['p2', 'p5']);
  assert.equal(listPlayers(storage, ['p2', 'p5']).length, 2);
  assert.throws(() => createPlayer(storage, 'mei', ['p2', 'p5']), /already in use/);
  const meiP2 = createFreshState(p2);
  meiP2.player.coins = 41;
  const junP2 = createFreshState(p2);
  junP2.player.coins = 82;
  const meiP5 = createFreshState(p5);
  meiP5.player.coins = 123;
  saveLevelState(storage, meiP2, mei.id);
  saveLevelState(storage, junP2, jun.id);
  saveLevelState(storage, meiP5, mei.id);
  assert.equal(loadLevelState(storage, p2, mei.id).state.player.coins, 41);
  assert.equal(loadLevelState(storage, p2, jun.id).state.player.coins, 82);
  assert.equal(loadLevelState(storage, p5, mei.id).state.player.coins, 123);
  assert.equal(storage.getItem(saveKey('p2')), null);
  meiP2.player.coins = 50;
  saveLevelState(storage, meiP2, mei.id);
  assert.ok(storage.getItem(backupKey('p2', mei.id)));
  assert.equal(storage.getItem(backupKey('p2', jun.id)), null);
  startFreshLevelState(storage, p2, mei.id);
  assert.equal(loadLevelState(storage, p2, mei.id).state.player.coins, createFreshState(p2).player.coins);
  assert.equal(loadLevelState(storage, p2, jun.id).state.player.coins, 82);
  assert.equal(loadLevelState(storage, p5, mei.id).state.player.coins, 123);
  saveProfile(storage, 'p2', jun.id);
  assert.equal(listPlayers(storage, ['p2', 'p5']).length, 2);
});

test('new players do not inherit a legacy prototype save', async () => {
  const { createPlayer, encodeSave, listPlayers, loadLevelState } = await import('../src/core/save.js');
  const { createFreshState } = await import('../src/core/state.js');
  const level = await (await import('../src/content/loader.js')).loadLevelPackage('p5', fetcher, '');
  const old = createFreshState(level);
  old.player.coins = 999;
  const storage = memoryStorage([['zilin-save-v1', encodeSave(old)]]);
  const newPlayer = createPlayer(storage, 'New player', ['p2', 'p5']);
  assert.deepEqual(listPlayers(storage, ['p2', 'p5']).map(player => player.name), ['Player 1', 'New player']);
  assert.notEqual(loadLevelState(storage, level, newPlayer.id).state.player.coins, 999);
});

test('an unreadable player list is preserved instead of being replaced', async () => {
  const { createPlayer, listPlayers, PLAYERS_KEY } = await import('../src/core/save.js');
  const storage = memoryStorage([[PLAYERS_KEY, '{broken']]);
  assert.throws(() => listPlayers(storage, ['p2', 'p5']), /left in place/);
  assert.throws(() => createPlayer(storage, 'Mei', ['p2', 'p5']), /left in place/);
  assert.equal(storage.getItem(PLAYERS_KEY), '{broken');
});
