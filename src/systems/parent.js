const PIN_KEY = 'wsq-next-parent-pin';
const PIN_SALT = 'word-spirit-parent|modular|v1|';

function hash(value) {
  let output = 0x811c9dc5;
  for (const character of `${PIN_SALT}${value}`) {
    output ^= character.charCodeAt(0);
    output = Math.imul(output, 0x01000193) >>> 0;
  }
  return output.toString(16).padStart(8, '0');
}

export function ensureParentPin(storage, defaultPin = '1056') {
  if (!storage.getItem(PIN_KEY)) storage.setItem(PIN_KEY, `PIN1.${hash(defaultPin)}`);
}

export function parentPinMatches(storage, pin) {
  ensureParentPin(storage);
  return storage.getItem(PIN_KEY) === `PIN1.${hash(pin)}`;
}

export function setParentPin(storage, pin) {
  if (!/^\d{4,8}$/.test(pin)) return false;
  storage.setItem(PIN_KEY, `PIN1.${hash(pin)}`);
  return true;
}

export function setTestingPlayerLevel(player, requestedLevel, maxHpBonus = 0) {
  const level = Math.min(99, Math.max(1, Math.trunc(Number(requestedLevel) || 1)));
  const maxHp = 18 + level * 2 + Math.max(0, Number(maxHpBonus) || 0);
  return { ...player, level, xp: 0, maxHp, hp: maxHp };
}

export function recordActivity(activity, day, event, amount = 1) {
  const current = activity?.[day] || { battles: 0, school: 0, reading: 0, writing: 0, minutes: 0 };
  const field = event === 'battle-win' ? 'battles' : event === 'school-run' ? 'school' : event === 'reading-answer' ? 'reading' : event === 'writing-success' ? 'writing' : null;
  if (!field) return activity || {};
  return { ...(activity || {}), [day]: { ...current, [field]: current[field] + amount } };
}

export function weeklySummary(activity, today) {
  const end = new Date(`${today}T12:00:00`);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(end); date.setDate(end.getDate() - (6 - offset));
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { day, battles: 0, school: 0, reading: 0, writing: 0, minutes: 0, ...(activity?.[day] || {}) };
  });
}

export function goalProgress(goal, state, goldCount = 0) {
  if (!goal) return null;
  const value = goal.type === 'gold' ? goldCount : goal.type === 'streak' ? (state.progress.streak?.count || 0) : (state.progress.story?.bossDefeated ? 1 : 0);
  return { ...goal, value, complete: value >= goal.target, percent: Math.min(100, Math.round(value / Math.max(1, goal.target) * 100)) };
}

export function giftSpiritCard(progressByWord, word, availableWords) {
  return giftSpiritCards(progressByWord, [word], availableWords);
}

export function giftSpiritCards(progressByWord, requestedWords, availableWords) {
  const available = new Set(availableWords.map(word => word.w));
  const gifted = [...new Set(requestedWords)].filter(word => available.has(word));
  if (!gifted.length) return { ok: false, words: progressByWord, gifted: [] };
  const words = { ...progressByWord };
  for (const word of gifted) words[word] = { ...(words[word] || {}), collected: true };
  return { ok: true, words, gifted };
}
