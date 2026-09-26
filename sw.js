const CACHE = 'word-spirit-quest-p17-v29';
const CORE = [
  './game/', './game/index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/stage.css',
  './vendor/hanzi-writer/hanzi-writer.min.js',
  './content/authored/shared/levels.json', './content/authored/shared/balance.json', './content/authored/shared/strings.json',
  './content/authored/shared/items.json', './content/authored/shared/gear.json', './content/authored/shared/recipes.json',
  './content/authored/shared/milestones.json', './content/authored/shared/word-tags.json',
  './content/authored/campaign/regions.json', './content/authored/campaign/maps/r1-hub.json', './content/authored/campaign/maps/r2-harvest-crossing.json', './content/authored/campaign/maps/r3-tidewater-bay.json', './content/authored/campaign/maps/r4-lantern-theatre.json', './content/authored/campaign/maps/r5-festival-city.json', './content/authored/campaign/maps/r6-ancient-grove.json', './content/authored/campaign/maps/r7-treehouse-summit.json',
  './content/authored/campaign/r1-story.json', './content/authored/campaign/r1-sets.json', './content/authored/campaign/r2-story.json', './content/authored/campaign/r2-sets.json', './content/authored/campaign/r3-story.json', './content/authored/campaign/r3-sets.json', './content/authored/campaign/r4-story.json', './content/authored/campaign/r4-sets.json', './content/authored/campaign/r5-story.json', './content/authored/campaign/r5-sets.json', './content/authored/campaign/r6-story.json', './content/authored/campaign/r6-sets.json', './content/authored/campaign/r7-story.json', './content/authored/campaign/r7-sets.json', './content/authored/campaign/daily-quests.json',
  './content/authored/levels/p2/level.json', './content/authored/levels/p5/level.json',
  './content/generated/p2.content.json', './content/generated/p2.chars.json', './content/generated/p5.content.json', './content/generated/p5.chars.json'
];
const RUNTIME = [
  './src/main.js', './src/gameplay.js', './src/adventure.js', './src/collection.js', './src/content/loader.js',
  './src/battle/battle.js', './src/battle/creatureArt.js', './src/battle/creatures.js', './src/battle/damage.js',
  './src/core/audio.js', './src/core/events.js', './src/core/rng.js', './src/core/safe.js', './src/core/save.js', './src/core/state.js', './src/core/time.js',
  './src/learning/audio.js', './src/learning/examAdapters.js', './src/learning/mastery.js', './src/learning/pinyin.js', './src/learning/questions.js', './src/learning/selection.js', './src/learning/writing.js',
  './src/systems/crafting.js', './src/systems/daily.js', './src/systems/economy.js', './src/systems/energy.js', './src/systems/gear.js', './src/systems/inventory.js', './src/systems/milestones.js', './src/systems/parent.js', './src/systems/partners.js', './src/systems/reading.js', './src/systems/regions.js', './src/systems/school.js', './src/systems/sets.js', './src/systems/story.js',
  './src/ui/dom.js', './src/ui/hud.js', './src/ui/overlay.js', './src/ui/prologue.js', './src/ui/questionView.js', './src/ui/toast.js', './src/ui/writingView.js',
  './src/world/encounters.js', './src/world/input.js', './src/world/map.js', './src/world/npcs.js', './src/world/renderer.js',
  './assets/images/creatures/muddle-king.png', './assets/images/creatures/fogling.png', './assets/images/creatures/echo-bat.png', './assets/images/creatures/twin-shade.png', './assets/images/creatures/jumble-bug.png', './assets/images/creatures/ink-imp.png', './assets/images/creatures/chaff-sprite.png', './assets/images/creatures/rumour-crow.png', './assets/images/creatures/price-mimic.png', './assets/images/creatures/doubt-moth.png', './assets/images/creatures/forked-gecko.png', './assets/images/creatures/doubt-serpent.png', './assets/images/creatures/tangle-crab.png', './assets/images/creatures/drift-jelly.png', './assets/images/creatures/rust-gull.png', './assets/images/creatures/minute-mite.png', './assets/images/creatures/tide-hare.png', './assets/images/creatures/idle-clock.png', './assets/images/creatures/mask-moth.png', './assets/images/creatures/heckle-magpie.png', './assets/images/creatures/straw-soldier.png', './assets/images/creatures/spotlight-fox.png', './assets/images/creatures/wilt-wisp.png', './assets/images/creatures/mocking-mirror.png', './assets/images/creatures/ribbon-rat.png', './assets/images/creatures/drum-gremlin.png', './assets/images/creatures/spark-kite.png', './assets/images/creatures/quarrel-macaque.png', './assets/images/creatures/boastful-lion.png', './assets/images/creatures/grudge-dragon.png', './assets/images/creatures/glyph-beetle.png', './assets/images/creatures/bone-owl.png', './assets/images/creatures/ink-vine.png', './assets/images/creatures/relic-tortoise.png', './assets/images/creatures/whisper-moss.png', './assets/images/creatures/give-up-ghost.png', './assets/images/creatures/blank-page-wisp.png', './assets/images/creatures/eraser-moth.png', './assets/images/creatures/silence-raven.png', './assets/images/creatures/lost-name-fox.png', './assets/images/creatures/hollow-book-golem.png', './assets/images/creatures/great-forgetter.png',
  './assets/images/hero/main-hero.png', './assets/images/shop/shop-background.png', './assets/images/room/grandmas-room.png',
  './assets/images/intro/dictionary-tree.png', './assets/images/intro/great-forgetter.png', './assets/images/intro/spirits-scattered.png', './assets/images/story/open-book.png',
  './assets/images/rewards/cave-lantern.png', './assets/images/rewards/dawn-stroke.png', './assets/images/rewards/market-seal.png', './assets/images/rewards/truth-stroke.png', './assets/images/rewards/harbour-chronometer.png', './assets/images/rewards/current-stroke.png', './assets/images/rewards/lantern-stage-pass.png', './assets/images/rewards/courage-stroke.png', './assets/images/rewards/festival-medallion.png', './assets/images/rewards/harmony-stroke.png', './assets/images/rewards/oracle-rubbing-kit.png', './assets/images/rewards/memory-stroke.png', './assets/images/rewards/treeheart-lens.png', './assets/images/rewards/final-stroke.png',
  './assets/images/shop/rice-ball.png', './assets/images/shop/instant-noodles.png', './assets/images/shop/mooncake.png', './assets/images/shop/scholars-lantern.png', './assets/images/shop/ink-pot.png', './assets/images/shop/smoke-ball.png', './assets/images/shop/lucky-knot.png', './assets/images/shop/power-tea.png', './assets/images/shop/guardian-talisman.png', './assets/images/shop/forest-repellent.png', './assets/images/shop/spirit-bait.png', './assets/images/shop/red-cap.png',
  './assets/audio/bag-open.mp3', './assets/audio/button.mp3', './assets/audio/correct.mp3', './assets/audio/creature-hit.wav', './assets/audio/enter-shop.mp3', './assets/audio/good-result.mp3', './assets/audio/harvest-crossing-bg.mp3', './assets/audio/lantern-theatre-bg.mp3', './assets/audio/festival-city-bg.mp3', './assets/audio/level-up.mp3', './assets/audio/major-reward.wav', './assets/audio/music-village.wav', './assets/audio/music-battle.wav', './assets/audio/music-boss.wav', './assets/audio/prologue-bg.mp3', './assets/audio/scholar-village-bg.mp3', './assets/audio/tidewater-bg.mp3', './assets/audio/need-improvement.mp3', './assets/audio/purchase.mp3', './assets/audio/wrong-answer.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...CORE, ...RUNTIME])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('word-spirit-quest-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => {
    if (cached) return cached;
    return fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./game/index.html') : Response.error());
  }));
});
