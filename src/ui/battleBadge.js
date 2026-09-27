export function battleQuestionBadge(type) {
  const attack = type === 'attack';
  const icon = attack
    ? '<path d="M7 25 24 8m-9 1 8 8m-16 8 5-1-4-4-1 5Zm13-18 5 5"/>'
    : '<path d="M16 3 27 7v8c0 8-6 12-11 14C11 27 5 23 5 15V7L16 3Zm-5 13 4 4 7-8"/>';
  return `<div class="battle-question-badge ${attack ? 'attack' : 'defense'}" role="status"><svg viewBox="0 0 32 32" aria-hidden="true">${icon}</svg><span>${attack ? 'Your attack' : 'Defend'}</span></div>`;
}
