export function createSpeechController({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let active = null;
  const stop = () => {
    active = null;
    try { synth?.cancel(); } catch {}
  };
  const speak = (text, { rate = 0.85, onEnd = () => {} } = {}) => {
    stop();
    if (!synth || !Utterance) return false;
    const utterance = new Utterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    const finish = () => {
      if (active !== utterance) return;
      active = null;
      onEnd();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    active = utterance;
    synth.speak(utterance);
    return true;
  };
  return { speak, stop, get isSpeaking() { return Boolean(active); } };
}
