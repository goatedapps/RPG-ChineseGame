export function heroStats(level) {
  return {
    attack: 3 + level * 3,
    defense: level * 2,
    evasion: Math.min(0.24, Math.floor((level - 1) / 2) * 0.04)
  };
}

export function calculateDamage({ attack, defense, moveBonus = 0, roll = 0 }) {
  return Math.max(1, Math.floor(attack + moveBonus - defense * 0.55 + roll));
}

export function didEvade(evasion, random = Math.random) {
  return random() < Math.max(0, Math.min(0.9, evasion));
}

