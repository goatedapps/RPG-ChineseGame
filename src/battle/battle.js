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

export function gainBattleRewards(player, balance, { xpMultiplier = 1, maxHpBonus = 0 } = {}) {
  let level = player.level;
  const xpAwarded = Math.round(balance.combat.battleXp * xpMultiplier);
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
    coins: player.coins + balance.combat.battleCoins
  };
}

