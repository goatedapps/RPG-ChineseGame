(function () {
  const musicFiles = {
    village: 'sounds/music-village.wav',
    battle: 'sounds/music-battle.wav',
    boss: 'sounds/music-boss.wav',
  };
  const effectFiles = {
    bag: 'sounds/bag-open.mp3',
    button: 'sounds/button.mp3',
    correct: 'sounds/correct.mp3',
    enterShop: 'sounds/enter-shop.mp3',
    win: 'sounds/good-result.mp3',
    level: 'sounds/level-up.mp3',
    improve: 'sounds/need-improvement.mp3',
    purchase: 'sounds/purchase.mp3',
    hit: 'sounds/creature-hit.wav',
    wrong: 'sounds/wrong-answer.mp3',
  };

  const music = Object.fromEntries(Object.entries(musicFiles).map(([name, source]) => {
    const audio = new Audio(source);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    return [name, audio];
  }));
  const effects = Object.fromEntries(Object.entries(effectFiles).map(([name, source]) => {
    const audio = new Audio(source);
    audio.preload = 'auto';
    return [name, audio];
  }));

  let enabled = true;
  try { enabled = localStorage.getItem('wsq-sound') !== 'off'; } catch (error) {}
  let unlocked = false;
  let scene = 'village';
  let currentTrack = null;
  let fadeTimer = null;
  const activeEffects = new Set();
  const MUSIC_VOLUME = 0.28;

  function fadeTo(nextTrack) {
    clearInterval(fadeTimer);
    const previous = currentTrack;
    if (previous === nextTrack) {
      nextTrack.play().catch(() => {});
      return;
    }
    currentTrack = nextTrack;
    nextTrack.currentTime = 0;
    nextTrack.volume = 0;
    nextTrack.play().catch(() => {});
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / 12);
      nextTrack.volume = MUSIC_VOLUME * progress;
      if (previous) previous.volume = MUSIC_VOLUME * (1 - progress);
      if (progress === 1) {
        clearInterval(fadeTimer);
        if (previous) { previous.pause(); previous.currentTime = 0; }
      }
    }, 50);
  }

  function startMusic() {
    if (!enabled || !unlocked) return;
    fadeTo(music[scene]);
  }

  function setScene(nextScene) {
    if (!music[nextScene]) return;
    scene = nextScene;
    startMusic();
  }

  function sfx(name) {
    if (!enabled || !unlocked || !effects[name]) return;
    const sound = effects[name].cloneNode();
    sound.volume = name === 'button' ? 0.28 : 0.58;
    activeEffects.add(sound);
    const discard = () => activeEffects.delete(sound);
    sound.addEventListener('ended', discard, { once: true });
    sound.addEventListener('error', discard, { once: true });
    sound.play().catch(discard);
  }

  function stopAll() {
    clearInterval(fadeTimer);
    Object.values(music).forEach(track => { track.pause(); track.currentTime = 0; track.volume = 0; });
    activeEffects.forEach(sound => { sound.pause(); sound.currentTime = 0; });
    activeEffects.clear();
    currentTrack = null;
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    try { localStorage.setItem('wsq-sound', enabled ? 'on' : 'off'); } catch (error) {}
    if (enabled) startMusic(); else stopAll();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    startMusic();
  }

  window.GameAudio = { isEnabled, setEnabled, setScene, sfx, toggle, unlock };
})();
