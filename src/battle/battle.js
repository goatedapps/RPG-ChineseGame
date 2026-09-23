import { calculateDamage, didEvade, heroStats } from './damage.js';

export function createBattleState(word, creature) {
  return { word, creature, enemyHp: creature.maxHp, turn: 1, finished: false };
}

export function playerAttack(battle, player, skill, { correct, random = Math.random } = {}) {
  if (!correct) return { battle: { ...battle, turn: battle.turn + 1 }, damage: 0 };
  const hero = heroStats(player.level);
  const moveBonus = (skill === battle.creature.weak ? 3 : 0) + (skill === 'w' ? 2 : 0);
  const damage = calculateDamage({ attack: hero.attack, defense: battle.creature.defense, moveBonus, roll: random() * 3 });
  const enemyHp = Math.max(0, battle.enemyHp - damage);
  return { battle: { ...battle, enemyHp, finished: enemyHp === 0, turn: battle.turn + 1 }, damage };
}

export function enemyAttack(battle, player, random = Math.random) {
  const hero = heroStats(player.level);
  if (didEvade(hero.evasion, random)) return { player, damage: 0, evaded: true };
  const damage = calculateDamage({ attack: battle.creature.attack, defense: hero.defense, roll: random() * 3 });
  return { player: { ...player, hp: Math.max(0, player.hp - damage) }, damage, evaded: false };
}

export function gainBattleRewards(player, balance) {
  let level = player.level;
  let xp = player.xp + balance.combat.battleXp;
  let maxHp = player.maxHp;
  while (xp >= level * 30) {
    xp -= level * 30;
    level += 1;
    maxHp = 18 + level * 2;
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

