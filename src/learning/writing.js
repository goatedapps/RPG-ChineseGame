export const WRITING_STAGES = Object.freeze([
  { id: 0, name: 'Trace', outline: true, hintAfterMisses: 1 },
  { id: 1, name: 'Guided', outline: false, hintAfterMisses: 2 },
  { id: 2, name: 'From memory', outline: false, hintAfterMisses: 3 }
]);
export const AUTO_COMPLETE_AFTER_MISSES = 4;

export function normalizeCharacterProgress(value = {}) {
  return {
    stage: Math.max(0, Math.min(2, Number(value.stage ?? value.lv) || 0)),
    attempts: Math.max(0, Number(value.attempts ?? value.n) || 0),
    helped: Math.max(0, Number(value.helped ?? value.help) || 0),
    lastCleanRun: value.lastCleanRun ?? value.lb ?? null
  };
}

export function stageForCharacter(value, mode = 'learning') {
  if (mode === 'practice') return WRITING_STAGES[0];
  if (mode === 'dictation') return WRITING_STAGES[2];
  return WRITING_STAGES[normalizeCharacterProgress(value).stage];
}

export function recordCharacter(value, { helped, runId }) {
  const before = normalizeCharacterProgress(value);
  let stage = before.stage;
  let lastCleanRun = before.lastCleanRun;
  if (helped) stage = Math.max(0, stage - 1);
  else if (lastCleanRun !== runId) {
    stage = Math.min(2, stage + 1);
    lastCleanRun = runId;
  }
  return {
    stage,
    attempts: before.attempts + 1,
    helped: before.helped + (helped ? 1 : 0),
    lastCleanRun
  };
}

export function writingResult({ gaveUp = false, usedDemonstration = false, autoCompleted = false, allFromMemory = false }) {
  const helped = gaveUp || usedDemonstration || autoCompleted;
  return { ok: !helped, helped, earnsTick: !helped && allFromMemory };
}

