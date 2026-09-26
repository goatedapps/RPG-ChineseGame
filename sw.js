const CACHE = 'word-spirit-quest-p18-v44';
const CORE = [
  './game/', './game/index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/stage.css', './css/atlas.css',
  './vendor/hanzi-writer/hanzi-writer.min.js',
  './content/authored/shared/levels.json', './content/authored/shared/balance.json', './content/authored/shared/strings.json',
  './content/authored/shared/items.json', './content/authored/shared/gear.json', './content/authored/shared/recipes.json',
  './content/authored/shared/milestones.json', './content/authored/shared/word-tags.json',
  './content/authored/campaign/regions.json', './content/authored/campaign/maps/r1-hub.json', './content/authored/campaign/maps/r1-r2-mistwood.json', './content/authored/campaign/maps/r2-harvest-crossing.json', './content/authored/campaign/maps/r3-tidewater-bay.json', './content/authored/campaign/maps/r4-lantern-theatre.json', './content/authored/campaign/maps/r5-festival-city.json', './content/authored/campaign/maps/r6-ancient-grove.json', './content/authored/campaign/maps/r7-treehouse-summit.json',
  './content/authored/campaign/r1-story.json', './content/authored/campaign/r1-sets.json', './content/authored/campaign/r2-story.json', './content/authored/campaign/r2-sets.json', './content/authored/campaign/r3-story.json', './content/authored/campaign/r3-sets.json', './content/authored/campaign/r4-story.json', './content/authored/campaign/r4-sets.json', './content/authored/campaign/r5-story.json', './content/authored/campaign/r5-sets.json', './content/authored/campaign/r6-story.json', './content/authored/campaign/r6-sets.json', './content/authored/campaign/r7-story.json', './content/authored/campaign/r7-sets.json', './content/authored/campaign/daily-quests.json',
  './content/authored/levels/p2/level.json', './content/authored/levels/p5/level.json',
  './content/generated/p2.content.json', './content/generated/p2.chars.json', './content/generated/p5.content.json', './content/generated/p5.chars.json'
];
const RUNTIME = [
  './src/main.js', './src/gameplay.js', './src/adventure.js', './src/collection.js', './src/content/loader.js',
  './src/battle/battle.js', './src/battle/creatureArt.js', './src/battle/creatures.js', './src/battle/damage.js',
  './src/core/assets.js', './src/core/audio.js', './src/core/events.js', './src/core/progression.js', './src/core/rng.js', './src/core/safe.js', './src/core/save.js', './src/core/state.js', './src/core/time.js',
  './src/learning/audio.js', './src/learning/examAdapters.js', './src/learning/mastery.js', './src/learning/pinyin.js', './src/learning/questions.js', './src/learning/selection.js', './src/learning/writing.js',
  './src/systems/crafting.js', './src/systems/daily.js', './src/systems/dictation.js', './src/systems/economy.js', './src/systems/energy.js', './src/systems/gear.js', './src/systems/inventory.js', './src/systems/milestones.js', './src/systems/parent.js', './src/systems/partners.js', './src/systems/reading.js', './src/systems/regionGuide.js', './src/systems/regions.js', './src/systems/school.js', './src/systems/sets.js', './src/systems/story.js',
  './src/ui/atlas.js', './src/ui/dom.js', './src/ui/gateTransition.js', './src/ui/hud.js', './src/ui/overlay.js', './src/ui/prologue.js', './src/ui/questionView.js', './src/ui/toast.js', './src/ui/writingView.js',
  './src/world/encounters.js', './src/world/fog.js', './src/world/input.js', './src/world/map.js', './src/world/npcs.js', './src/world/renderer.js',
  './assets/images/creatures/muddle-king.webp', './assets/images/creatures/fogling.webp', './assets/images/creatures/echo-bat.webp', './assets/images/creatures/twin-shade.webp', './assets/images/creatures/jumble-bug.webp', './assets/images/creatures/ink-imp.webp', './assets/images/creatures/chaff-sprite.webp', './assets/images/creatures/rumour-crow.webp', './assets/images/creatures/price-mimic.webp', './assets/images/creatures/doubt-moth.webp', './assets/images/creatures/forked-gecko.webp', './assets/images/creatures/doubt-serpent.webp', './assets/images/creatures/tangle-crab.webp', './assets/images/creatures/drift-jelly.webp', './assets/images/creatures/rust-gull.webp', './assets/images/creatures/minute-mite.webp', './assets/images/creatures/tide-hare.webp', './assets/images/creatures/idle-clock.webp', './assets/images/creatures/mask-moth.webp', './assets/images/creatures/heckle-magpie.webp', './assets/images/creatures/straw-soldier.webp', './assets/images/creatures/spotlight-fox.webp', './assets/images/creatures/wilt-wisp.webp', './assets/images/creatures/mocking-mirror.webp', './assets/images/creatures/ribbon-rat.webp', './assets/images/creatures/drum-gremlin.webp', './assets/images/creatures/spark-kite.webp', './assets/images/creatures/quarrel-macaque.webp', './assets/images/creatures/boastful-lion.webp', './assets/images/creatures/grudge-dragon.webp', './assets/images/creatures/glyph-beetle.webp', './assets/images/creatures/bone-owl.webp', './assets/images/creatures/ink-vine.webp', './assets/images/creatures/relic-tortoise.webp', './assets/images/creatures/whisper-moss.webp', './assets/images/creatures/give-up-ghost.webp', './assets/images/creatures/blank-page-wisp.webp', './assets/images/creatures/eraser-moth.webp', './assets/images/creatures/silence-raven.webp', './assets/images/creatures/lost-name-fox.webp', './assets/images/creatures/hollow-book-golem.webp', './assets/images/creatures/great-forgetter.webp',
  './assets/images/hero/main-hero.webp', './assets/images/hero/hero-walking.webp', './assets/images/atlas/scholar-village.webp', './assets/images/atlas/harvest-crossing.webp', './assets/images/atlas/buildings.webp', './assets/images/atlas/villagers.webp', './assets/images/atlas/top-panel.webp', './assets/images/atlas/side-panel.webp', './assets/images/atlas/gate-opening.webp', './assets/images/shop/shop-background.jpg', './assets/images/room/grandmas-room.jpg',
  './assets/images/intro/dictionary-tree.jpg', './assets/images/intro/great-forgetter.jpg', './assets/images/intro/spirits-scattered.jpg', './assets/images/story/open-book.webp', './assets/images/story/reading-scroll.jpg',
  './assets/images/rewards/cave-lantern.webp', './assets/images/rewards/dawn-stroke.webp', './assets/images/rewards/market-seal.webp', './assets/images/rewards/truth-stroke.webp', './assets/images/rewards/harbour-chronometer.webp', './assets/images/rewards/current-stroke.webp', './assets/images/rewards/lantern-stage-pass.webp', './assets/images/rewards/courage-stroke.webp', './assets/images/rewards/festival-medallion.webp', './assets/images/rewards/harmony-stroke.webp', './assets/images/rewards/oracle-rubbing-kit.webp', './assets/images/rewards/memory-stroke.webp', './assets/images/rewards/treeheart-lens.webp', './assets/images/rewards/final-stroke.webp',
  './assets/images/shop/rice-ball.webp', './assets/images/shop/instant-noodles.webp', './assets/images/shop/mooncake.webp', './assets/images/shop/scholars-lantern.webp', './assets/images/shop/ink-pot.webp', './assets/images/shop/smoke-ball.webp', './assets/images/shop/lucky-knot.webp', './assets/images/shop/power-tea.webp', './assets/images/shop/guardian-talisman.webp', './assets/images/shop/forest-repellent.webp', './assets/images/shop/spirit-bait.webp', './assets/images/shop/red-cap.webp',
  './assets/audio/bag-open.mp3', './assets/audio/battle.mp3', './assets/audio/button.mp3', './assets/audio/correct.mp3', './assets/audio/creature-hit.wav', './assets/audio/enter-shop.mp3', './assets/audio/good-result.mp3', './assets/audio/harvest-crossing-bg.mp3', './assets/audio/lantern-theatre-bg.mp3', './assets/audio/festival-city-bg.mp3', './assets/audio/ancient-grove-bg.mp3', './assets/audio/treehouse-summit-bg.mp3', './assets/audio/level-up.mp3', './assets/audio/major-reward.wav', './assets/audio/music-village.wav', './assets/audio/prologue-bg.mp3', './assets/audio/scholar-village-bg.mp3', './assets/audio/tidewater-bg.mp3', './assets/audio/need-improvement.mp3', './assets/audio/purchase.mp3', './assets/audio/wrong-answer.mp3'
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
