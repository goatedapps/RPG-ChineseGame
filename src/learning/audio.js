export function createSpeechController({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance } = {}) {
  let active = null;
  const stop = () => {
    try { synth?.cancel(); } catch {}
    active = null;
  };
  const speak = (text, { rate = 0.85, onEnd = () => {} } = {}) => {
    stop();
    if (!synth || !Utterance) return false;
    const utterance = new Utterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = rate;
    utterance.onend = () => { active = null; onEnd(); };
    utterance.onerror = () => { active = null; onEnd(); };
    active = utterance;
    synth.speak(utterance);
    return true;
  };
  return { speak, stop, get isSpeaking() { return Boolean(active); } };
}
