export const CREATURES = Object.freeze([
  { id: 'fogling', name: 'Fogling', color: '#9c97bf', weak: 'm', attackSkill: 'm' },
  { id: 'echo-bat', name: 'Echo Bat', color: '#3d9c9a', weak: 'p', attackSkill: 'p' },
  { id: 'twin-shade', name: 'Twin Shade', color: '#4a5a86', weak: 'h', attackSkill: 'h' },
  { id: 'jumble-bug', name: 'Jumble Bug', color: '#d98a3a', weak: 'u', attackSkill: 'u' },
  { id: 'ink-imp', name: 'Ink Imp', color: '#3b3f55', weak: 'w', attackSkill: 'h' }
]);

export function createCreature(lesson, balance, random = Math.random, typeId = null) {
  const [minimum, maximum] = balance.combat.lessonLevels[String(lesson)];
  const level = minimum + Math.floor(random() * (maximum - minimum + 1));
  const type = CREATURES.find(candidate => candidate.id === typeId) || CREATURES[Math.floor(random() * CREATURES.length)];
  return {
    ...type,
    level,
    maxHp: balance.combat.baseEnemyHp + level * balance.combat.hpPerLevel,
    attack: balance.combat.baseEnemyAttack + level * balance.combat.attackPerLevel,
    defense: balance.combat.baseEnemyDefense + level * balance.combat.defensePerLevel
  };
}

