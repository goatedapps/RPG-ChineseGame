function dayNumber(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / 86400000);
}

function weekId(day) {
  const value = new Date(`${day}T12:00:00Z`);
  const weekday = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - weekday);
  return value.toISOString().slice(0, 10);
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function dailyQuests(day, templates, levelId = '') {
  const start = hash(`${levelId}:${day}`) % templates.length;
  return Array.from({ length: 3 }, (_, index) => {
    const template = templates[(start + index) % templates.length];
    return { ...template, progress: 0, complete: false };
  });
}

export function normalizeDaily(value = {}, day, templates, levelId) {
  if (value.day === day && Array.isArray(value.quests) && value.quests.length === 3) return value;
  return { day, quests: dailyQuests(day, templates, levelId), chestClaimed: false, completedToday: false };
}

export function recordDailyEvent(value, event, amount = 1) {
  const quests = value.quests.map(quest => {
    if (quest.event !== event || quest.complete) return quest;
    const progress = Math.min(quest.target, quest.progress + amount);
    return { ...quest, progress, complete: progress >= quest.target };
  });
  return { ...value, quests, completedToday: quests.some(quest => quest.complete) };
}

export function dailyChestReady(value) {
  return value.quests.every(quest => quest.complete) && !value.chestClaimed;
}

export function claimDailyChest(value) {
  if (!dailyChestReady(value)) return { ok: false, daily: value };
  return { ok: true, daily: { ...value, chestClaimed: true } };
}

export function advanceLanternStreak(value = {}, day) {
  if (value.lastDay === day) return { streak: value, usedFreeze: false };
  if (!value.lastDay) return { streak: { count: 1, lastDay: day, freezeWeek: value.freezeWeek || '' }, usedFreeze: false };
  const gap = dayNumber(day) - dayNumber(value.lastDay);
  if (gap === 1) return { streak: { ...value, count: (value.count || 0) + 1, lastDay: day }, usedFreeze: false };
  const missedDay = new Date(`${value.lastDay}T12:00:00Z`);
  missedDay.setUTCDate(missedDay.getUTCDate() + 1);
  const missed = missedDay.toISOString().slice(0, 10);
  if (gap === 2 && value.freezeWeek !== weekId(missed)) {
    return { streak: { ...value, count: (value.count || 0) + 1, lastDay: day, freezeWeek: weekId(missed) }, usedFreeze: true };
  }
  return { streak: { ...value, count: 1, lastDay: day }, usedFreeze: false };
}

export function dailyScrollSpot(day, spots, levelId = '') {
  return spots[hash(`scroll:${levelId}:${day}`) % spots.length];
}

export function unlockDailyScroll(value = {}, day, entry) {
  const unlocked = Array.isArray(value.unlocked) ? value.unlocked : [];
  if (unlocked.some(item => item.day === day)) return { ...value, day, found: true, unlocked };
  return { ...value, day, found: true, unlocked: [{ day, ...entry }, ...unlocked] };
}
