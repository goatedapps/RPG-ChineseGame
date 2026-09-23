export const SKILL_KEYS = Object.freeze(['m', 'p', 'h', 'u', 'w']);
export const REVIEW_START_DAYS = 3;
export const REVIEW_MAX_DAYS = 30;

export const SKILLS = Object.freeze({
  m: { name: 'Meaning', action: 'Meaning Strike' },
  p: { name: 'Pinyin', action: 'Sound Blast' },
  h: { name: 'Hanzi', action: 'Precision Jab' },
  u: { name: 'Usage', action: 'Heavy Slam' },
  w: { name: 'Writing', action: 'Brush Finisher' }
});

export function normalizeWordProgress(value = {}) {
  return {
    collected: Boolean(value.collected ?? value.c),
    ticks: Object.fromEntries(SKILL_KEYS.map(skill => [skill, Math.max(0, Math.min(2, Number(value.ticks?.[skill] ?? value.st?.[skill]) || 0))])),
    lastTickDay: { ...(value.lastTickDay || value.ld || {}) },
    correct: Math.max(0, Number(value.correct ?? value.r) || 0),
    misses: Math.max(0, Number(value.misses ?? value.x) || 0),
    reviewDay: value.reviewDay ?? value.rev ?? null,
    reviewInterval: Math.max(REVIEW_START_DAYS, Number(value.reviewInterval ?? value.revInterval) || REVIEW_START_DAYS)
  };
}

export function starsOf(value) {
  const progress = normalizeWordProgress(value);
  return SKILL_KEYS.filter(skill => progress.ticks[skill] >= 2).length;
}

export function tierOf(value) {
  const progress = normalizeWordProgress(value);
  if (!progress.collected) return null;
  const stars = starsOf(progress);
  if (stars === 5) return 'gold';
  if (stars >= 3) return 'silver';
  return 'bronze';
}

function dayNumber(day) {
  if (!day) return null;
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(new Date(year, month - 1, date).getTime() / 86400000);
}

export function daysBetween(earlier, later) {
  const start = dayNumber(earlier);
  const end = dayNumber(later);
  return start == null || end == null ? Infinity : Math.max(0, end - start);
}

export function isReviewDue(value, day) {
  const progress = normalizeWordProgress(value);
  return tierOf(progress) === 'gold' && daysBetween(progress.reviewDay, day) >= progress.reviewInterval;
}

export function recordAnswer(value, { skill, correct, day, assisted = false }) {
  if (!SKILL_KEYS.includes(skill)) throw new Error(`Unknown skill: ${skill}`);
  const before = normalizeWordProgress(value);
  const progress = {
    ...before,
    ticks: { ...before.ticks },
    lastTickDay: { ...before.lastTickDay },
    correct: before.correct + (correct ? 1 : 0),
    misses: before.misses + (correct ? 0 : 1)
  };
  const previousTier = tierOf(before);
  let tickEarned = false;
  let reviewFailed = false;

  if (correct && !assisted && progress.lastTickDay[skill] !== day && progress.ticks[skill] < 2) {
    progress.ticks[skill] += 1;
    progress.lastTickDay[skill] = day;
    tickEarned = true;
  } else if (!correct && previousTier === 'gold' && isReviewDue(before, day)) {
    progress.ticks[skill] = Math.max(0, progress.ticks[skill] - 1);
    progress.reviewDay = null;
    progress.reviewInterval = REVIEW_START_DAYS;
    reviewFailed = true;
  }

  const nextTier = tierOf(progress);
  if (nextTier === 'gold' && previousTier !== 'gold') {
    progress.reviewDay = day;
    progress.reviewInterval = REVIEW_START_DAYS;
  }
  return { progress, tickEarned, previousTier, nextTier, reviewFailed };
}

export function completeReview(value, day) {
  const progress = normalizeWordProgress(value);
  if (tierOf(progress) !== 'gold' || !isReviewDue(progress, day)) return progress;
  return {
    ...progress,
    reviewDay: day,
    reviewInterval: Math.min(REVIEW_MAX_DAYS, progress.reviewInterval * 2)
  };
}

