export function normalizeSchool(value, day) {
  return value?.day === day
    ? { day, runs: Math.max(0, Number(value.runs) || 0), examWeek: value.examWeek || '' }
    : { day, runs: 0, examWeek: value?.examWeek || '' };
}

export function schoolRun(value, day, paidRuns) {
  const school = normalizeSchool(value, day);
  return { school: { ...school, runs: school.runs + 1 }, rewarded: school.runs < paidRuns };
}

export function weekKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

