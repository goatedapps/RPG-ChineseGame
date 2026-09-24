export function normalizeReading(value = {}) {
  return {
    completed: Array.isArray(value.completed) ? [...value.completed] : Array.isArray(value.done) ? [...value.done] : [],
    active: value.active || null,
    index: Math.max(0, Number(value.index) || 0),
    questionCount: Math.max(0, Number(value.questionCount) || 0),
    results: { ...(value.results || {}) },
    written: Array.isArray(value.written) ? [...value.written] : []
  };
}

export function repairActiveReading(value, group, villagerCount) {
  const state = normalizeReading(value);
  if (!group || state.active !== group.id) return state;
  const questionCount = Math.min(group.items?.length || 0, Math.max(0, villagerCount));
  if (!questionCount) return { ...state, active: null, index: 0, questionCount: 0, results: {} };
  const results = Object.fromEntries(Object.entries(state.results).filter(([index]) => Number(index) < questionCount));
  return { ...state, questionCount, results };
}

export function selectPassage(groups, reading, { includeHigherChinese = false, random = Math.random } = {}) {
  const state = normalizeReading(reading);
  const eligible = groups.filter(group => (
    (includeHigherChinese || group.subject !== 'Higher Chinese')
    && !state.completed.includes(group.id)
    && group.items.length > 0
  ));
  return eligible[Math.floor(random() * eligible.length)] || null;
}

export function checkPassageAnswer(item, answer) {
  const normalized = String(answer || '').replace(/\s+/g, '').toLocaleLowerCase();
  if (item.format === 'MCQ') return answer === item.c;
  if (item.format === 'Fill-in') return (item.accepted || []).some(candidate => String(candidate).replace(/\s+/g, '').toLocaleLowerCase() === normalized);
  return null;
}

export function completePassage(reading, groupId, keyItem, inventory) {
  const state = normalizeReading(reading);
  return {
    reading: { ...state, active: null, index: 0, questionCount: 0, results: {}, completed: [...new Set([...state.completed, groupId])] },
    inventory: { ...inventory, keyItems: [...new Set([...(inventory.keyItems || []), keyItem])] }
  };
}
