const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('release audio loads only the active music track while keeping short effects ready', async () => {
  const tracks = [];
  class FakeAudio {
    constructor(source) { this.source = source; this.volume = 0; this.currentTime = 0; tracks.push(this); }
    play() { this.plays = (this.plays || 0) + 1; return Promise.resolve(); }
    pause() { this.pauses = (this.pauses || 0) + 1; }
    cloneNode() { return new FakeAudio(this.source); }
  }
  const { createAudioManager } = await import('../src/core/audio.js');
  const audio = createAudioManager({ AudioClass: FakeAudio });
  const music = tracks.filter(track => track.loop !== undefined);
  const effects = tracks.filter(track => track.loop === undefined);
  assert.ok(music.length >= 9);
  assert.ok(music.every(track => track.preload === 'none'));
  assert.ok(effects.every(track => track.preload === 'auto'));
  audio.unlock();
  audio.setWorld('r5');
  assert.equal(music.find(track => track.source.includes('festival-city-bg.mp3')).plays, 1);
  assert.equal(music.find(track => track.source.includes('tidewater-bg.mp3')).plays, undefined);
  audio.setEnabled(false);
});

test('leaving the prologue stops its music immediately and repeated village handoffs keep one track', async () => {
  const tracks = [];
  class FakeAudio {
    constructor(source) { this.source = source; this.currentTime = 0; this.volume = 0; this.playing = false; tracks.push(this); }
    play() { this.playing = true; return Promise.resolve(); }
    pause() { this.playing = false; }
    cloneNode() { return new FakeAudio(this.source); }
  }
  const { createAudioManager } = await import('../src/core/audio.js');
  const audio = createAudioManager({ AudioClass: FakeAudio });
  const intro = tracks.find(track => track.source.includes('prologue-bg.mp3'));
  const village = tracks.find(track => track.source.includes('scholar-village-bg.mp3'));
  audio.unlock();
  audio.setScene('intro');
  assert.equal(intro.playing, true);
  audio.setScene('village');
  assert.equal(intro.playing, false);
  assert.equal(intro.currentTime, 0);
  assert.equal(village.playing, true);
  audio.setEnabled(true);
  audio.setWorld('r1');
  audio.setScene('village');
  assert.deepEqual(tracks.filter(track => track.loop && track.playing), [village]);
  audio.setEnabled(false);
});

test('offline release cache includes both curricula and every region runtime file', () => {
  const serviceWorker = fs.readFileSync('sw.js', 'utf8');
  for (const level of ['p2', 'p5']) {
    for (const file of [`${level}.content.json`, `${level}.chars.json`]) assert.match(serviceWorker, new RegExp(file.replace('.', '\\.')));
  }
  for (let region = 1; region <= 7; region += 1) {
    assert.match(serviceWorker, new RegExp(`r${region}-story\\.json`));
    assert.match(serviceWorker, new RegExp(`maps/r${region}-`));
  }
  const assets = [...serviceWorker.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]);
  for (const asset of assets) if (asset !== 'game/') assert.ok(fs.existsSync(asset), `Missing offline asset: ${asset}`);
});

test('first paint shows an illustrated walking-hero loader until the opening art decodes', () => {
  const shell = fs.readFileSync('game/index.html', 'utf8');
  const startup = fs.readFileSync('src/main.js', 'utf8');
  const styles = fs.readFileSync('css/base.css', 'utf8');
  assert.match(shell, /id="boot-loading"[^>]*role="status"/);
  assert.match(shell, /id="boot-loading-hero"[^>]*hero-walking\.png/);
  assert.ok(shell.indexOf('id="boot-loading"') < shell.indexOf('id="prologue"'));
  assert.match(startup, /await openingImage\.decode\(\)/);
  assert.match(startup, /createPrologue\([\s\S]*?requestAnimationFrame\(\(\) => \$\('#boot-loading'\)\?\.remove\(\)\)/);
  assert.match(styles, /@keyframes hero-walk/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*boot-loading-hero\.ready/);
});

test('Reading Hall has a packaged scroll backdrop and in-world dialogue avoids curriculum labels', () => {
  const styles = fs.readFileSync('css/stage.css', 'utf8');
  const serviceWorker = fs.readFileSync('sw.js', 'utf8');
  assert.match(styles, /\.passage-art[^\n]*reading-scroll\.jpg/);
  assert.match(styles, /\.passage-text[^\n]*clamp\(21px,2\.1vw,24px\)/);
  assert.match(serviceWorker, /assets\/images\/story\/reading-scroll\.jpg/);
  for (const file of fs.readdirSync('content/authored/campaign/maps')) {
    if (!/^r[1-7]-.*\.json$/.test(file)) continue;
    const map = JSON.parse(fs.readFileSync(`content/authored/campaign/maps/${file}`, 'utf8'));
    for (const object of map.objects || []) {
      for (const line of object.interaction?.lines || []) {
        assert.doesNotMatch(line, /\b(?:P2|P5|Primary [25]|curriculum|school level|engine preview|lesson slot)\b/i, `${file}: ${line}`);
      }
    }
  }
});

test('parent testing shortcuts keep inputs separate from right-aligned action buttons', () => {
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  const styles = fs.readFileSync('css/stage.css', 'utf8');
  assert.match(gameplay, /parent-shortcut-row.*data-parent-jump-region.*data-parent-jump>Jump now/);
  assert.match(gameplay, /parent-shortcut-row.*data-parent-level.*data-parent-level-save>Apply level/);
  assert.match(styles, /\.parent-shortcut-row \{[^}]*grid-template-columns: minmax\(0,1fr\) auto/);
  assert.match(styles, /\.parent-shortcut-button \{[^}]*justify-self: end/);
});

test('minimum Silver-gate playthrough reaches every boss and enters tougher regions slightly below their creatures', async () => {
  const { auditLevel } = await import('../tools/audit-progression.mjs');
  const { xpToNextLevel } = await import('../src/core/progression.js');
  assert.equal(xpToNextLevel(1), 30);
  assert.equal(xpToNextLevel(40), 420);
  for (const levelId of ['p2', 'p5']) {
    const rows = auditLevel(levelId);
    assert.equal(rows.length, 7);
    for (const row of rows) {
      assert.ok(row.gate, `${levelId} ${row.region}: Bronze and key-item boss gate`);
      assert.ok(row.bossOutcome.won, `${levelId} ${row.region}: boss must be beatable without optional purchases`);
      assert.ok(row.bossOutcome.turns >= 3 && row.bossOutcome.turns <= 8, `${levelId} ${row.region}: boss should take several correct spells`);
      if (row.nextMinimum != null) assert.ok(row.nextGap >= 1 && row.nextGap <= 3, `${levelId} ${row.region}: hero ${row.hero}, next creature ${row.nextMinimum}`);
    }
  }
});

test('a seven-region state journey can collect keys, defeat each boss, travel and restore the final stroke', async () => {
  const { createFreshState } = await import('../src/core/state.js');
  const { completePassage } = await import('../src/systems/reading.js');
  const { applyStoryCommands, bossGateQueue, gateStatus } = await import('../src/systems/story.js');
  const { enterRegion, saveCurrentRegion } = await import('../src/systems/regions.js');
  const mapFiles = fs.readdirSync('content/authored/campaign/maps').filter(file => /^r[1-7]-.*\.json$/.test(file)).sort();

  for (const levelId of ['p2', 'p5']) {
    const content = JSON.parse(fs.readFileSync(`content/generated/${levelId}.content.json`, 'utf8'));
    const config = JSON.parse(fs.readFileSync(`content/authored/levels/${levelId}/level.json`, 'utf8'));
    const firstMap = JSON.parse(fs.readFileSync(`content/authored/campaign/maps/${mapFiles[0]}`, 'utf8'));
    const state = createFreshState({ id: levelId, content, map: firstMap });
    for (let number = 1; number <= 7; number += 1) {
      const regionId = `r${number}`;
      const map = JSON.parse(fs.readFileSync(`content/authored/campaign/maps/${mapFiles[number - 1]}`, 'utf8'));
      const story = JSON.parse(fs.readFileSync(`content/authored/campaign/${regionId}-story.json`, 'utf8'));
      if (number > 1) {
        saveCurrentRegion(state, `r${number - 1}`);
        enterRegion(state, { map, region: { id: regionId } });
      }
      const lessons = config.regionLessons[regionId];
      const words = content.words.filter(word => lessons.includes(word.lesson));
      const required = Math.ceil(words.length * story.nextRegionSilverPct);
      for (const word of words.slice(0, required)) state.progress.words[word.w] = { collected: true, ticks: { m: 1, p: 1, h: 1 } };
      const key = story.readingKeyItem || 'cave-lantern';
      const reading = completePassage(state.progress.reading, `${regionId}-passage`, key, state.progress.inventory);
      state.progress.reading = reading.reading;
      state.progress.inventory = reading.inventory;
      const regionPackage = { content, config, region: { id: regionId }, regionStory: story };
      assert.ok(gateStatus(regionPackage, state.progress, state.progress.inventory, story.gateBronzePct).open, `${levelId} ${regionId}: boss gate`);
      assert.equal(bossGateQueue(content, config, lessons).length, 12, `${levelId} ${regionId}: boss challenge`);
      const result = applyStoryCommands(state.progress.story, story.scenes.reform);
      state.progress.story = result.story;
      assert.ok(result.story.bossDefeated, `${levelId} ${regionId}: boss completion`);
      if (number < 7) {
        assert.ok(required <= words.filter(word => ['m', 'p', 'h'].every(skill => state.progress.words[word.w]?.ticks?.[skill])).length);
        state.settings.unlockedRegions = number + 1;
      } else assert.ok(result.rewards.includes('final-stroke'), `${levelId}: final ending reward`);
    }
    assert.equal(state.settings.unlockedRegions, 7);
    assert.equal(state.progress.inventory.keyItems.length, 7);
    assert.ok(state.progress.story.bossDefeated);
  }
});
