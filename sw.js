const CACHE = 'word-spirit-quest-p10-v9';
const CORE = [
  './game/', './game/index.html', './manifest.webmanifest',
  './css/tokens.css', './css/base.css', './css/stage.css',
  './vendor/hanzi-writer/hanzi-writer.min.js',
  './content/authored/shared/levels.json', './content/authored/shared/balance.json', './content/authored/shared/strings.json',
  './content/authored/shared/items.json', './content/authored/shared/gear.json', './content/authored/shared/recipes.json',
  './content/authored/shared/milestones.json', './content/authored/shared/word-tags.json',
  './content/authored/campaign/regions.json', './content/authored/campaign/maps/r1-hub.json',
  './content/authored/campaign/r1-story.json', './content/authored/campaign/r1-sets.json', './content/authored/campaign/daily-quests.json',
  './content/authored/levels/p2/level.json', './content/authored/levels/p5/level.json',
  './content/generated/p2.content.json', './content/generated/p2.chars.json', './content/generated/p5.content.json', './content/generated/p5.chars.json'
];
const RUNTIME = [
  './src/main.js', './src/gameplay.js', './src/adventure.js', './src/collection.js', './src/content/loader.js',
  './src/battle/battle.js', './src/battle/creatureArt.js', './src/battle/creatures.js', './src/battle/damage.js',
  './src/core/audio.js', './src/core/events.js', './src/core/rng.js', './src/core/safe.js', './src/core/save.js', './src/core/state.js', './src/core/time.js',
  './src/learning/audio.js', './src/learning/examAdapters.js', './src/learning/mastery.js', './src/learning/pinyin.js', './src/learning/questions.js', './src/learning/selection.js', './src/learning/writing.js',
  './src/systems/crafting.js', './src/systems/daily.js', './src/systems/economy.js', './src/systems/energy.js', './src/systems/gear.js', './src/systems/inventory.js', './src/systems/milestones.js', './src/systems/parent.js', './src/systems/partners.js', './src/systems/reading.js', './src/systems/school.js', './src/systems/sets.js', './src/systems/story.js',
  './src/ui/dom.js', './src/ui/hud.js', './src/ui/overlay.js', './src/ui/questionView.js', './src/ui/toast.js', './src/ui/writingView.js',
  './src/world/encounters.js', './src/world/input.js', './src/world/map.js', './src/world/npcs.js', './src/world/renderer.js',
  './assets/audio/bag-open.mp3', './assets/audio/button.mp3', './assets/audio/correct.mp3', './assets/audio/creature-hit.wav', './assets/audio/enter-shop.mp3', './assets/audio/good-result.mp3', './assets/audio/level-up.mp3', './assets/audio/music-battle.wav', './assets/audio/music-boss.wav', './assets/audio/music-village.wav', './assets/audio/need-improvement.mp3', './assets/audio/purchase.mp3', './assets/audio/wrong-answer.mp3'
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
