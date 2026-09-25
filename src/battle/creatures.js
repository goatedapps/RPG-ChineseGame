export const CREATURES = Object.freeze([
  { id: 'fogling', name: 'Fogling', color: '#9c97bf', weak: 'm', attackSkill: 'm' },
  { id: 'echo-bat', name: 'Echo Bat', color: '#3d9c9a', weak: 'p', attackSkill: 'p' },
  { id: 'twin-shade', name: 'Twin Shade', color: '#4a5a86', weak: 'h', attackSkill: 'h' },
  { id: 'jumble-bug', name: 'Jumble Bug', color: '#d98a3a', weak: 'u', attackSkill: 'u' },
  { id: 'ink-imp', name: 'Ink Imp', color: '#3b3f55', weak: 'w', attackSkill: 'h' },
  { id: 'chaff-sprite', name: 'Chaff Sprite', color: '#d8a63c', weak: 'm', attackSkill: 'u' },
  { id: 'rumour-crow', name: 'Rumour Crow', color: '#243640', weak: 'h', attackSkill: 'm' },
  { id: 'price-mimic', name: 'Price Mimic', color: '#a94f3d', weak: 'u', attackSkill: 'p' },
  { id: 'doubt-moth', name: 'Doubt Moth', color: '#7e6a9c', weak: 'p', attackSkill: 'h' },
  { id: 'forked-gecko', name: 'Forked Gecko', color: '#6f9b54', weak: 'w', attackSkill: 'u' }
]);

export function createCreature(lesson, balance, random = Math.random, typeId = null) {
  const [minimum, maximum] = balance.combat.lessonLevels[String(lesson)];
  const level = minimum + Math.floor(random() * (maximum - minimum + 1));
  const type = CREATURES.find(candidate => candidate.id === typeId) || CREATURES[Math.floor(random() * CREATURES.length)];
  const variantRoll = random();
  const variant = variantRoll < 0.05 ? 'golden' : variantRoll < 0.13 ? 'elite' : 'normal';
  const hpBonus = variant === 'elite' ? 8 : variant === 'golden' ? 4 : 0;
  return {
    ...type,
    level,
    variant,
    maxHp: balance.combat.baseEnemyHp + level * balance.combat.hpPerLevel + hpBonus,
    attack: balance.combat.baseEnemyAttack + level * balance.combat.attackPerLevel + (variant === 'elite' ? 2 : 0),
    defense: balance.combat.baseEnemyDefense + level * balance.combat.defensePerLevel + (variant === 'elite' ? 1 : 0),
    fleeAfter: variant === 'golden' ? 4 : null
  };
}
