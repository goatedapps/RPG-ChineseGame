const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const items = JSON.parse(fs.readFileSync('content/authored/shared/items.json', 'utf8'));
const catalog = JSON.parse(fs.readFileSync('content/authored/shared/cosmetics.json', 'utf8'));
const fetcher = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', url), 'utf8')) });

test('regional shops retain two foods, add one, and share the final full-heal selection', async () => {
  const { shopItemsForRegion } = await import('../src/systems/shop.js');
  const expected = [
    ['rice-ball', 'instant-noodles', 'seaweed-broth'],
    ['instant-noodles', 'seaweed-broth', 'harvest-stew'],
    ['seaweed-broth', 'harvest-stew', 'tidewater-congee'],
    ['harvest-stew', 'tidewater-congee', 'lantern-tea'],
    ['tidewater-congee', 'lantern-tea', 'mooncake'],
    ['lantern-tea', 'mooncake', 'grove-brew'],
    ['lantern-tea', 'mooncake', 'grove-brew']
  ];
  for (let index = 0; index < 7; index++) {
    const shelf = shopItemsForRegion(items, `r${index + 1}`);
    assert.deepEqual(shelf.filter(item => item.regions).map(item => item.id), expected[index]);
    assert(shelf.some(item => item.id === 'forest-repellent'));
    assert(shelf.some(item => item.id === 'scholars-lantern'));
  }
});

test('food restores fixed HP, Grove Brew fills equipped maximum HP, and quantities are consumed once', async () => {
  const { applyHealing, useConsumable } = await import('../src/systems/inventory.js');
  const expected = { 'rice-ball': [10, 25], 'instant-noodles': [20, 50], 'seaweed-broth': [40, 70], 'harvest-stew': [50, 90], 'tidewater-congee': [60, 110], 'lantern-tea': [70, 130], mooncake: [80, 150] };
  for (const [id, [heal, price]] of Object.entries(expected)) {
    const item = items.find(item => item.id === id);
    assert.equal(item.price, price);
    assert.equal(applyHealing({ hp: 1, maxHp: 200 }, item).hp, 1 + heal);
    assert.equal(applyHealing({ hp: 198, maxHp: 200 }, item).hp, 200);
  }
  const brew = items.find(item => item.id === 'grove-brew');
  assert.equal(brew.price, 200);
  assert.equal(applyHealing({ hp: 1, maxHp: 103 }, brew).hp, 103);
  const inventory = { 'grove-brew': 1, mooncake: 4 };
  const used = useConsumable(inventory, brew.id);
  assert.equal(used.inventory['grove-brew'], 0);
  assert.equal(used.inventory.mooncake, 4);
  assert.equal(useConsumable(used.inventory, brew.id).ok, false);
  assert.equal(inventory['grove-brew'], 1);
});

test('cosmetic purchases enforce village, affordability, ownership and dependency without changing stats', async () => {
  const { normalizeCosmetics, purchaseCosmetic, arrangeCosmetic } = await import('../src/systems/cosmetics.js');
  const empty = normalizeCosmetics(null, catalog);
  const player = { coins: 1000, hp: 37, maxHp: 46, level: 14 };
  const nest = catalog.find(item => item.id === 'companion-nest');
  const ribbon = catalog.find(item => item.id === 'companion-ribbon');
  assert.equal(purchaseCosmetic(player, empty, nest, 'r1').ok, false);
  assert.equal(purchaseCosmetic({ ...player, coins: 1 }, empty, nest, 'r2').ok, false);
  assert.equal(purchaseCosmetic(player, empty, ribbon, 'r2').ok, false);
  const purchased = purchaseCosmetic(player, empty, nest, 'r2');
  assert.equal(purchased.player.coins, 760);
  assert.deepEqual({ ...purchased.player, coins: 1000 }, player);
  assert.deepEqual(purchased.cosmetics.room, [nest.id]);
  assert.equal(purchaseCosmetic(purchased.player, purchased.cosmetics, nest, 'r2').ok, false);
  const withRibbon = purchaseCosmetic(purchased.player, arrangeCosmetic(purchased.cosmetics, nest), ribbon, 'r2');
  assert.deepEqual(withRibbon.cosmetics.room, [nest.id, ribbon.id]);
  assert.deepEqual(arrangeCosmetic(withRibbon.cosmetics, nest).room, []);
  assert.equal(withRibbon.player.coins, 680);
  const robe = catalog.find(item => item.id === 'jade-traveller-robe');
  const dressed = purchaseCosmetic(withRibbon.player, withRibbon.cosmetics, robe, 'r2');
  assert.equal(dressed.cosmetics.outfit, robe.id);
  assert.equal(arrangeCosmetic(dressed.cosmetics, robe).outfit, null);
  assert.equal(arrangeCosmetic(empty, robe), empty);
});

test('schema 15 migration preserves food counts and earned keepsakes; cosmetic state survives save export/import', async () => {
  const { createFreshState, migrateState } = await import('../src/core/state.js');
  const { encodeSave, decodeSave } = await import('../src/core/save.js');
  const { loadLevelPackage } = await import('../src/content/loader.js');
  const pkg = await loadLevelPackage('p6', fetcher, '');
  const old = createFreshState(pkg); old.schemaVersion = 15; delete old.progress.cosmetics;
  old.progress.inventory.mooncake = 7; old.progress.inventory['instant-noodles'] = 4;
  old.progress.room.decorations.push('forest-shapes'); old.progress.room.trophies.push('Word Sage');
  const migrated = migrateState(old, pkg);
  assert.equal(migrated.schemaVersion, 16);
  assert.equal(migrated.progress.inventory.mooncake, 7);
  assert.equal(migrated.progress.inventory['instant-noodles'], 4);
  assert.deepEqual(migrated.progress.room, old.progress.room);
  assert.deepEqual(migrated.progress.cosmetics, { owned: [], room: [], outfit: null });
  migrated.progress.cosmetics = { owned: ['jade-garden-rug', 'festival-robe'], room: ['jade-garden-rug'], outfit: 'festival-robe' };
  assert.deepEqual(migrateState(decodeSave(encodeSave(migrated)), pkg).progress.cosmetics, migrated.progress.cosmetics);
  const invalid = { ...migrated, progress: { ...migrated.progress, cosmetics: { owned: ['festival-robe'], room: ['jade-garden-rug'], outfit: 'tidewater-robe' } } };
  assert.deepEqual(migrateState(invalid, pkg).progress.cosmetics, { owned: ['festival-robe'], room: [], outfit: null });
});

test('real shop buys once, wardrobe switches freely and room combines fitted throw with rug', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { loadLevelPackage, activateRegion } = await import('../src/content/loader.js');
  const { createGameplay } = await import('../src/gameplay.js');
  const { createCollection } = await import('../src/collection.js');
  const pkg = await loadLevelPackage('p6', fetcher, '');
  const game = { levelPackage: activateRegion(pkg, 'r2'), state: createFreshState(pkg) };
  game.state.player.coins = 1000;
  const dom = new JSDOM('<main id="overlay"></main>', { url: 'http://localhost/' });
  const originalDocument = global.document; const originalWindow = global.window;
  global.document = dom.window.document; global.window = dom.window;
  let writes = 0;
  const dependencies = { overlay: { open: html => { dom.window.document.querySelector('main').innerHTML = html; }, close() {} }, storage: dom.window.localStorage, getActive: () => game, persist: () => { writes++; }, render() {}, toast() {} };
  try {
    const gameplay = createGameplay(dependencies); const collection = createCollection(dependencies);
    gameplay.shop();
    assert.equal(document.querySelectorAll('[data-buy-cosmetic]').length, 4);
    document.querySelector('[data-buy-cosmetic="jade-traveller-robe"]').click();
    assert.equal(game.state.player.coins, 760);
    assert.equal(game.state.progress.cosmetics.outfit, 'jade-traveller-robe');
    document.querySelector('[data-buy-cosmetic="jade-traveller-robe"]').click();
    assert.equal(game.state.player.coins, 760);
    collection.character();
    assert.match(document.querySelector('.character-preview img').src, /jade-traveller-robe/);
    document.querySelector('[data-arrange-cosmetic="jade-traveller-robe"]').click();
    assert.equal(game.state.progress.cosmetics.outfit, null);
    assert.equal(game.state.player.coins, 760);
    game.state.progress.cosmetics.owned.push('jade-garden-rug', 'crimson-bed-throw');
    game.state.progress.cosmetics.room.push('jade-garden-rug', 'crimson-bed-throw');
    collection.room();
    assert.match(document.querySelector('.room-scene').style.backgroundImage, /room-crimson-no-rug/);
    assert(document.querySelector('.room-cosmetic-art image[href$="jade-garden-rug.webp"]'));
    document.querySelector('[data-arrange-cosmetic="crimson-bed-throw"]').click();
    assert.match(document.querySelector('.room-scene').style.backgroundImage, /room-no-rug/);
    assert.equal(game.state.player.coins, 760);
    assert(writes >= 3);
  } finally { global.document = originalDocument; global.window = originalWindow; dom.window.close(); }
});
