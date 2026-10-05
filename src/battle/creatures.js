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
  { id: 'forked-gecko', name: 'Forked Gecko', color: '#6f9b54', weak: 'w', attackSkill: 'u' },
  { id: 'tangle-crab', name: 'Tangle Crab', color: '#d26e55', weak: 'm', attackSkill: 'u' },
  { id: 'drift-jelly', name: 'Drift Jelly', color: '#66a9bc', weak: 'p', attackSkill: 'm' },
  { id: 'rust-gull', name: 'Rust Gull', color: '#956c52', weak: 'h', attackSkill: 'p' },
  { id: 'minute-mite', name: 'Minute Mite', color: '#80739c', weak: 'u', attackSkill: 'h' },
  { id: 'tide-hare', name: 'Tide Hare', color: '#4d8f8d', weak: 'w', attackSkill: 'u' },
  { id: 'mask-moth', name: 'Mask Moth', color: '#b45770', weak: 'm', attackSkill: 'p' },
  { id: 'heckle-magpie', name: 'Heckle Magpie', color: '#405780', weak: 'h', attackSkill: 'm' },
  { id: 'straw-soldier', name: 'Straw Soldier', color: '#b78b42', weak: 'u', attackSkill: 'h' },
  { id: 'spotlight-fox', name: 'Spotlight Fox', color: '#cc7445', weak: 'p', attackSkill: 'u' },
  { id: 'wilt-wisp', name: 'Wilt Wisp', color: '#668657', weak: 'w', attackSkill: 'm' },
  { id: 'ribbon-rat', name: 'Ribbon Rat', color: '#b74f43', weak: 'm', attackSkill: 'u' },
  { id: 'drum-gremlin', name: 'Drum Gremlin', color: '#aa4938', weak: 'p', attackSkill: 'm' },
  { id: 'spark-kite', name: 'Spark Kite', color: '#456ba1', weak: 'h', attackSkill: 'p' },
  { id: 'quarrel-macaque', name: 'Quarrel Macaque', color: '#697b51', weak: 'u', attackSkill: 'h' },
  { id: 'boastful-lion', name: 'Boastful Lion', color: '#c35e43', weak: 'w', attackSkill: 'u' },
  { id: 'glyph-beetle', name: 'Glyph Beetle', color: '#4f8171', weak: 'm', attackSkill: 'h' },
  { id: 'bone-owl', name: 'Bone Owl', color: '#a78b68', weak: 'p', attackSkill: 'm' },
  { id: 'ink-vine', name: 'Ink Vine', color: '#3f614d', weak: 'h', attackSkill: 'p' },
  { id: 'relic-tortoise', name: 'Relic Tortoise', color: '#6b7658', weak: 'u', attackSkill: 'w' },
  { id: 'whisper-moss', name: 'Whisper Moss', color: '#527b53', weak: 'w', attackSkill: 'u' },
  { id: 'blank-page-wisp', name: 'Blank-Page Wisp', color: '#c7b794', weak: 'm', attackSkill: 'p' },
  { id: 'eraser-moth', name: 'Eraser Moth', color: '#a9a2c0', weak: 'p', attackSkill: 'm' },
  { id: 'silence-raven', name: 'Silence Raven', color: '#40506d', weak: 'h', attackSkill: 'u' },
  { id: 'lost-name-fox', name: 'Lost-Name Fox', color: '#7993a5', weak: 'u', attackSkill: 'h' },
  { id: 'hollow-book-golem', name: 'Hollow-Book Golem', color: '#796b57', weak: 'w', attackSkill: 'p' }
]);

export const CREATURE_VARIANTS = Object.freeze({
  normal: Object.freeze({ chance: 0.87, hpBonus: 0, attackBonus: 0, defenseBonus: 0, fleeAfter: null, bonusCoins: 0 }),
  elite: Object.freeze({ chance: 0.08, hpBonus: 8, attackBonus: 2, defenseBonus: 1, fleeAfter: null, bonusCoins: 6 }),
  golden: Object.freeze({ chance: 0.05, hpBonus: 4, attackBonus: 0, defenseBonus: 0, fleeAfter: 4, bonusCoins: 12 })
});

export function creatureVariantNote(variant) {
  const rules = CREATURE_VARIANTS[variant];
  if (variant === 'elite') return `Elite creatures have ${rules.hpBonus} extra HP, ${rules.attackBonus} extra ATK and ${rules.defenseBonus} extra DEF. Win for ${rules.bonusCoins} bonus coins.`;
  if (variant === 'golden') return `Golden creatures have ${rules.hpBonus} extra HP and escape if still standing after your fourth attack. Win for ${rules.bonusCoins} bonus coins.`;
  return '';
}

export function creatureSpellName(creature) {
  const signature = { fogling: 'Fog Cloud', 'echo-bat': 'Screech', 'twin-shade': 'Mirror Trick', 'jumble-bug': 'Word Scramble', 'ink-imp': 'Ink Splash' };
  const bySkill = { m: 'Meaning Mist', p: 'Pinyin Pulse', h: 'Hanzi Hex', u: 'Usage Twist', w: 'Brush Burst' };
  return signature[creature.id] || bySkill[creature.attackSkill] || 'Word Spell';
}

export function createCreature(lesson, balance, random = Math.random, typeId = null) {
  const [minimum, maximum] = balance.combat.lessonLevels[String(lesson)];
  const level = minimum + Math.floor(random() * (maximum - minimum + 1));
  const type = CREATURES.find(candidate => candidate.id === typeId) || CREATURES[Math.floor(random() * CREATURES.length)];
  const variantRoll = random();
  const variant = variantRoll < CREATURE_VARIANTS.golden.chance ? 'golden' : variantRoll < CREATURE_VARIANTS.golden.chance + CREATURE_VARIANTS.elite.chance ? 'elite' : 'normal';
  const rules = CREATURE_VARIANTS[variant];
  return {
    ...type,
    level,
    variant,
    maxHp: balance.combat.baseEnemyHp + level * balance.combat.hpPerLevel + rules.hpBonus,
    attack: Math.round(balance.combat.baseEnemyAttack + level * balance.combat.attackPerLevel + rules.attackBonus),
    defense: balance.combat.baseEnemyDefense + level * balance.combat.defensePerLevel + rules.defenseBonus,
    fleeAfter: rules.fleeAfter
  };
}

export function createBoss(balance, lessons) {
  const highestCreatureLevel = Math.max(...lessons.map(lesson => balance.combat.lessonLevels[String(lesson)]?.[1] || 1));
  const level = highestCreatureLevel + 1;
  const hpMultiplier = (balance.combat.bossHpBaseMultiplier || 1) + Math.max(0, level - 12) * (balance.combat.bossHpMultiplierPerLevelAfter12 || 0);
  const attackBonus = Math.round(Math.max(0, level - 18) * (balance.combat.bossAttackBonusPerLevelAfter18 || 0));
  return {
    level,
    maxHp: Math.round((balance.combat.baseEnemyHp + level * balance.combat.hpPerLevel) * hpMultiplier),
    attack: Math.round(balance.combat.baseEnemyAttack + level * balance.combat.attackPerLevel + attackBonus),
    defense: balance.combat.baseEnemyDefense + level * balance.combat.defensePerLevel
  };
}
