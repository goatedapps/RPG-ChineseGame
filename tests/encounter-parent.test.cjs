const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('wild zones trigger deterministic step encounters with a three-step cooldown', async () => {
  const { encounterStep, weightedCreature, zoneAt } = await import('../src/world/encounters.js');
  const map = JSON.parse(fs.readFileSync('content/authored/campaign/maps/r1-hub.json', 'utf8'));
  const zone = zoneAt(map, 2, 2);
  assert.equal(zone.id, 'camping-forest');
  const first = encounterStep({ cooldown: 0, zone: null }, map, { x: 2, y: 2 }, () => 0);
  assert.equal(first.encounter, true);
  assert.equal(first.state.cooldown, 3);
  assert.equal(encounterStep(first.state, map, { x: 3, y: 2 }, () => 0).encounter, false);
  assert.equal(weightedCreature({ fogling: 4, 'echo-bat': 1 }, () => 0), 'fogling');
});

test('forest repellent suppresses encounters and counts down only in encounter grass', async () => {
  const { encounterStep } = await import('../src/world/encounters.js');
  const map = JSON.parse(fs.readFileSync('content/authored/campaign/maps/r1-hub.json', 'utf8'));
  const protectedStep = encounterStep({ cooldown: 0, zone: null, repellentSteps: 2 }, map, { x: 2, y: 2 }, () => 0);
  assert.equal(protectedStep.encounter, false);
  assert.equal(protectedStep.state.repellentSteps, 1);
  const villageStep = encounterStep(protectedStep.state, map, { x: 20, y: 14 }, () => 0);
  assert.equal(villageStep.state.repellentSteps, 1);
});

test('parent goals, bulk Spirit gifting, weekly summaries and activity tracking are state-only', async () => {
  const { giftSpiritCard, giftSpiritCards, goalProgress, recordActivity, weeklySummary } = await import('../src/systems/parent.js');
  let activity = recordActivity({}, '2026-09-24', 'battle-win');
  activity = recordActivity(activity, '2026-09-24', 'school-run');
  const rows = weeklySummary(activity, '2026-09-24');
  assert.equal(rows.at(-1).battles, 1);
  assert.equal(rows.at(-1).school, 1);
  const state = { progress: { streak: { count: 5 }, story: { bossDefeated: true } } };
  assert.equal(goalProgress({ label: 'Five days', type: 'streak', target: 5 }, state).complete, true);
  assert.equal(goalProgress({ label: 'Clear village', type: 'region', target: 1 }, state).percent, 100);
  const available = [{ w: '露营' }, { w: '集合' }];
  const gifted = giftSpiritCard({}, '露营', available);
  assert.equal(gifted.ok, true);
  assert.equal(gifted.words['露营'].collected, true);
  assert.equal(giftSpiritCard(gifted.words, '区域外', available).ok, false);
  const bulkGift = giftSpiritCards(gifted.words, ['集合', '集合', '区域外'], available);
  assert.equal(bulkGift.ok, true);
  assert.deepEqual(bulkGift.gifted, ['集合']);
  assert.equal(bulkGift.words['集合'].collected, true);
});

test('P8 export envelopes restore the matching curriculum save', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { exportSaveEnvelope, importSaveEnvelope } = await import('../src/core/save.js');
  const map = JSON.parse(fs.readFileSync('content/authored/campaign/maps/r1-hub.json', 'utf8'));
  const content = JSON.parse(fs.readFileSync('content/generated/p5.content.json', 'utf8'));
  const levelPackage = { id: 'p5', map, content };
  const state = createFreshState(levelPackage);
  state.player.coins = 321;
  const restored = importSaveEnvelope(exportSaveEnvelope(state), levelPackage);
  assert.equal(restored.player.coins, 321);
  assert.throws(() => importSaveEnvelope({ ...exportSaveEnvelope(state), level: 'p2' }, levelPackage), /P5/);
});

test('modular build exposes creature art, transition, audio and P8 parent tools', () => {
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  const css = fs.readFileSync('css/stage.css', 'utf8');
  const shell = fs.readFileSync('game/index.html', 'utf8');
  for (const text of ['data-weekly', 'data-export-save', 'data-import-save', 'data-goal-save', 'data-gift-lesson', 'data-gift-word', 'data-gift-spirit-save', 'data-speech-rate', 'data-region-unlock']) assert.match(gameplay, new RegExp(text));
  assert.match(gameplay, /creatureSvg/);
  assert.match(css, /encounter-transition/);
  assert.match(shell, /Scholar Village/);
  for (const file of ['scholar-village-bg.mp3', 'harvest-crossing-bg.mp3', 'prologue-bg.mp3', 'music-battle.wav', 'music-boss.wav', 'creature-hit.wav']) assert.equal(fs.existsSync(`assets/audio/${file}`), true);
});
