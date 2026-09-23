export function normalizeEnergy(value, day) {
  return value?.day === day ? { day, used: Math.max(0, Number(value.used) || 0) } : { day, used: 0 };
}

export function battlesLeft(value, day, cap) {
  const energy = normalizeEnergy(value, day);
  return cap === 0 ? Infinity : Math.max(0, cap - energy.used);
}

export function useBattle(value, day, cap) {
  const energy = normalizeEnergy(value, day);
  if (cap !== 0 && energy.used >= cap) return { energy, allowed: false };
  return { energy: { ...energy, used: energy.used + 1 }, allowed: true };
}

