import { calculateDamage, didEvade, heroStats } from './damage.js';

export function createBattleState(word, creature) {
  return { word, creature, enemyHp: creature.maxHp, turn: 1, finished: false, streak: 0, partnerUsed: false };
}

export function playerAttack(battle, player, skill, { correct, random = Math.random, bonusDamage = 0, damageMultiplier = 1 } = {}) {
  if (!correct) return { battle: { ...battle, streak: 0, turn: battle.turn + 1 }, damage: 0 };
  const hero = heroStats(player.level);
  const streak = correct ? battle.streak + 1 : 0;
  const moveBonus = (skill === battle.creature.weak ? 3 : 0) + (skill === 'w' ? 2 : 0) + (streak >= 3 ? 1 : 0) + bonusDamage;
  const damage = calculateDamage({ attack: hero.attack, defense: battle.creature.defense, moveBonus, roll: random() * 3 }) * damageMultiplier;
  const enemyHp = Math.max(0, battle.enemyHp - damage);
  return { battle: { ...battle, streak, enemyHp, finished: enemyHp === 0, turn: battle.turn + 1 }, damage };
}

export function enemyAttack(battle, player, random = Math.random, { evasionBonus = 0, damageReduction = 0, damageMultiplier = 1 } = {}) {
  const hero = heroStats(player.level);
  if (didEvade(hero.evasion + evasionBonus, random)) return { player, damage: 0, evaded: true };
  const damage = Math.max(0, Math.ceil((calculateDamage({ attack: battle.creature.attack, defense: hero.defense, roll: random() * 3 }) - damageReduction) * damageMultiplier));
  return { player: { ...player, hp: Math.max(0, player.hp - damage) }, damage, evaded: false };
}

export function escapeSucceeded(random = Math.random, chance = 0.65) {
  return random() < Math.max(0, Math.min(1, chance));
}

export function relativeRewardMultiplier(playerLevel, creatureLevel) {
  const difference = creatureLevel - playerLevel;
  if (difference >= 3) return 4;
  if (difference === 2) return 3;
  if (difference === 1) return 2;
  if (difference === 0) return 1;
  if (difference === -1) return 0.7;
  if (difference === -2) return 0.4;
  return 0.2;
}

function relativeCoinMultiplier(playerLevel, creatureLevel) {
  const difference = creatureLevel - playerLevel;
  if (difference >= 3) return 2;
  if (difference === 2) return 1.75;
  if (difference === 1) return 1.35;
  if (difference === 0) return 1;
  if (difference === -1) return 0.65;
  if (difference === -2) return 0.35;
  return 0.15;
}

export function battleRewardAmounts(playerLevel, creatureLevel, balance, { xpMultiplier = 1 } = {}) {
  const relative = relativeRewardMultiplier(playerLevel, creatureLevel);
  return {
    xp: Math.max(1, Math.round(balance.combat.battleXp * relative * xpMultiplier)),
    coins: Math.max(1, Math.round(balance.combat.battleCoins * relativeCoinMultiplier(playerLevel, creatureLevel)))
  };
}

export function gainBattleRewards(player, balance, { creatureLevel = player.level, xpMultiplier = 1, maxHpBonus = 0 } = {}) {
  let level = player.level;
  const rewards = battleRewardAmounts(player.level, creatureLevel, balance, { xpMultiplier });
  const xpAwarded = rewards.xp;
  let xp = player.xp + xpAwarded;
  let maxHp = player.maxHp;
  while (xp >= level * 30) {
    xp -= level * 30;
    level += 1;
    maxHp = 18 + level * 2 + maxHpBonus;
  }
  return {
    ...player,
    level,
    xp,
    maxHp,
    hp: level > player.level ? maxHp : player.hp,
    coins: player.coins + rewards.coins
  };
}
