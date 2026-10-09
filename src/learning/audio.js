export function createSpeechController({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let active = null;
  let startTimer = null;
  const stop = () => {
    active = null;
    clearTimeout(startTimer);
    try { synth?.cancel(); } catch {}
  };
  const speak = (text, { rate = 0.85, onEnd = () => {}, onError = () => {} } = {}) => {
    stop();
    if (!synth || !Utterance) { onError('unavailable'); return false; }
    const utterance = new Utterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    const finish = () => {
      if (active !== utterance) return;
      active = null;
      clearTimeout(startTimer);
      onEnd();
    };
    const fail = error => {
      if (active !== utterance) return;
      finish();
      onError(error);
    };
    utterance.onend = finish;
    utterance.onerror = event => fail(event?.error || 'synthesis-failed');
    utterance.onstart = () => { if (active === utterance) clearTimeout(startTimer); };
    active = utterance;
    try {
      const voices = synth.getVoices?.() || [];
      const mandarin = voices.filter(voice => /^zh(?:[-_](?:CN|SG|TW))?$/i.test(voice.lang));
      const voice = mandarin.find(voice => voice.localService && /^zh[-_]CN$/i.test(voice.lang))
        || mandarin.find(voice => voice.localService)
        || mandarin.find(voice => /^zh[-_]CN$/i.test(voice.lang))
        || mandarin[0];
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      if (synth.paused) synth.resume();
      // Some device speech engines fail without emitting an error or start event.
      startTimer = setTimeout(() => {
        if (active !== utterance) return;
        fail('start-timeout');
        if (!active) { try { synth.cancel(); } catch {} }
      }, 8000);
      startTimer.unref?.();
      synth.speak(utterance);
    } catch {
      fail('synthesis-failed');
      return false;
    }
    return true;
  };
  return { speak, stop, get isSpeaking() { return Boolean(active); } };
}
