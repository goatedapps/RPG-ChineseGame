const MUSIC = {
  intro: '../assets/audio/prologue-bg.mp3',
  r1: '../assets/audio/scholar-village-bg.mp3',
  r2: '../assets/audio/harvest-crossing-bg.mp3',
  r3: '../assets/audio/tidewater-bg.mp3',
  r4: '../assets/audio/lantern-theatre-bg.mp3',
  r5: '../assets/audio/festival-city-bg.mp3',
  battle: '../assets/audio/music-battle.wav',
  boss: '../assets/audio/music-boss.wav'
};
const EFFECTS = { button: '../assets/audio/button.mp3', correct: '../assets/audio/correct.mp3', wrong: '../assets/audio/wrong-answer.mp3', hit: '../assets/audio/creature-hit.wav', win: '../assets/audio/good-result.mp3', majorReward: '../assets/audio/major-reward.wav', purchase: '../assets/audio/purchase.mp3', bag: '../assets/audio/bag-open.mp3', level: '../assets/audio/level-up.mp3', enterShop: '../assets/audio/enter-shop.mp3' };

export function createAudioManager({ AudioClass = globalThis.Audio } = {}) {
  if (!AudioClass) return { unlock() {}, setEnabled() {}, setScene() {}, setWorld() {}, sfx() {} };
  const music = Object.fromEntries(Object.entries(MUSIC).map(([id, source]) => { const track = new AudioClass(source); track.loop = true; track.preload = 'auto'; track.volume = 0; return [id, track]; }));
  const effects = Object.fromEntries(Object.entries(EFFECTS).map(([id, source]) => { const sound = new AudioClass(source); sound.preload = 'auto'; return [id, sound]; }));
  let enabled = true;
  let unlocked = false;
  let scene = 'village';
  let worldScene = 'r1';
  let current = null;
  let fade = null;
  const stop = () => { clearInterval(fade); Object.values(music).forEach(track => { track.pause(); track.currentTime = 0; track.volume = 0; }); current = null; };
  const start = () => {
    if (!enabled || !unlocked) return;
    const next = music[scene === 'village' ? worldScene : scene];
    if (current === next) return void next.play().catch(() => {});
    const previous = current; current = next; next.currentTime = 0; next.volume = 0; next.play().catch(() => {});
    clearInterval(fade); let step = 0;
    fade = setInterval(() => { step += 1; const progress = Math.min(1, step / 10); next.volume = .25 * progress; if (previous) previous.volume = .25 * (1 - progress); if (progress === 1) { clearInterval(fade); if (previous) { previous.pause(); previous.currentTime = 0; } } }, 50);
  };
  return {
    unlock() { if (!unlocked) { unlocked = true; start(); } },
    setEnabled(value) { enabled = Boolean(value); if (enabled) start(); else stop(); },
    setScene(value) { if (value === 'village' || music[value]) { scene = value; start(); } },
    setWorld(regionId) {
      worldScene = music[regionId] ? regionId : 'r1';
      if (scene === 'village') start();
    },
    sfx(id) { if (!enabled || !unlocked || !effects[id]) return; const sound = effects[id].cloneNode(); sound.volume = id === 'button' ? .25 : id === 'majorReward' ? .68 : .55; sound.play().catch(() => {}); }
  };
}
