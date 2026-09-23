(function () {
  const melodies = {
    village: {
      step: 0.46,
      wave: 'sine',
      notes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23, 261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66],
    },
    battle: {
      step: 0.19,
      wave: 'triangle',
      notes: [164.81, 196, 220, 196, 164.81, 246.94, 220, 196, 146.83, 174.61, 220, 174.61],
    },
    boss: {
      step: 0.16,
      wave: 'sawtooth',
      notes: [130.81, 155.56, 146.83, 130.81, 196, 174.61, 155.56, 146.83],
    },
  };

  let context;
  let master;
  let musicGain;
  let effectsGain;
  let enabled = true;
  try { enabled = localStorage.getItem('wsq-sound') !== 'off'; } catch (error) {}
  let scene = 'village';
  let timer;
  let noteIndex = 0;

  function initialize() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    musicGain = context.createGain();
    effectsGain = context.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    musicGain.gain.value = 0.14;
    effectsGain.gain.value = 0.22;
    musicGain.connect(master);
    effectsGain.connect(master);
    master.connect(context.destination);
    restartMusic();
    return true;
  }

  function tone(frequency, duration, wave, volume, output, delay) {
    if (!context || !enabled) return;
    const start = context.currentTime + (delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function musicTick() {
    if (!context || !enabled) return;
    const track = melodies[scene];
    const frequency = track.notes[noteIndex % track.notes.length];
    tone(frequency, track.step * 0.8, track.wave, scene === 'village' ? 0.13 : 0.1, musicGain);
    if (noteIndex % 4 === 0) tone(frequency / 2, track.step * 2.8, 'sine', 0.07, musicGain);
    noteIndex++;
  }

  function restartMusic() {
    clearInterval(timer);
    noteIndex = 0;
    if (!context || !enabled) return;
    musicTick();
    timer = setInterval(musicTick, melodies[scene].step * 1000);
  }

  function setScene(nextScene) {
    if (!melodies[nextScene] || scene === nextScene) return;
    scene = nextScene;
    restartMusic();
  }

  function sfx(name) {
    if (!initialize() || !enabled) return;
    const patterns = {
      encounter: [[220, 0.09], [330, 0.09], [440, 0.16]],
      correct: [[523.25, 0.1], [659.25, 0.16]],
      wrong: [[196, 0.14], [146.83, 0.22]],
      hit: [[110, 0.08], [82.41, 0.13]],
      hurt: [[174.61, 0.12], [130.81, 0.2]],
      win: [[392, 0.12], [523.25, 0.12], [659.25, 0.22]],
      level: [[523.25, 0.1], [659.25, 0.1], [783.99, 0.28]],
    };
    (patterns[name] || []).forEach(([frequency, duration], index) => {
      tone(frequency, duration, name === 'hit' || name === 'hurt' ? 'square' : 'triangle', 0.32, effectsGain, index * 0.09);
    });
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    try { localStorage.setItem('wsq-sound', enabled ? 'on' : 'off'); } catch (error) {}
    if (enabled) initialize();
    if (master && context) master.gain.setTargetAtTime(enabled ? 0.8 : 0, context.currentTime, 0.03);
    restartMusic();
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled);
  }

  function isEnabled() {
    return enabled;
  }

  function unlock() {
    if (enabled) initialize();
  }

  window.GameAudio = { isEnabled, setEnabled, setScene, sfx, toggle, unlock };
})();
