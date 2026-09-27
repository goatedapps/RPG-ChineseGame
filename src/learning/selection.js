import { isReviewDue, normalizeWordProgress, SKILL_TICKS_REQUIRED, starsOf, tierOf } from './mastery.js?p10f';

export function wordWeight(progressValue, day) {
  const progress = normalizeWordProgress(progressValue);
  if (!progress.collected) return 5;
  if (tierOf(progress) === 'gold') return isReviewDue(progress, day) ? 1.5 : 0;
  return Math.max(0.5, 5 - starsOf(progress)) + Math.min(progress.misses, 4) * 0.8;
}

export function selectWord(words, progressByWord, { day, random = Math.random } = {}) {
  const candidates = words
    .map(word => ({ word, weight: wordWeight(progressByWord[word.w], day) }))
    .filter(candidate => candidate.weight > 0);
  if (!candidates.length) return null;
  let target = random() * candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  for (const candidate of candidates) {
    target -= candidate.weight;
    if (target <= 0) return candidate.word;
  }
  return candidates.at(-1).word;
}

export function recommendedSkill(progressValue, random = Math.random) {
  const progress = normalizeWordProgress(progressValue);
  const available = Object.keys(progress.ticks).filter(skill => progress.ticks[skill] < SKILL_TICKS_REQUIRED);
  return available.length ? available[Math.min(available.length - 1, Math.floor(random() * available.length))] : null;
}

export function eligibleBattleWords(words, progressByWord, avoidMastered = false) {
  return avoidMastered ? words.filter(word => !['silver', 'gold'].includes(tierOf(progressByWord[word.w]))) : words;
}
