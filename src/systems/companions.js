import { CREATURES, CREATURE_VARIANTS } from '../battle/creatures.js';
import { enemyAttack } from '../battle/battle.js';

const species = new Map(CREATURES.map(creature => [creature.id, creature]));
const variantRank = { normal: 0, elite: 1, golden: 2 };

const validVariant = variant => Object.hasOwn(variantRank, variant) ? variant : 'normal';

export function normalizeCreatures(value = {}) {
  const collection = {};
  for (const [id, record] of Object.entries(value?.collection || {})) {
    if (species.has(id) && Number.isSafeInteger(record?.level) && record.level > 0) collection[id] = { level: record.level, variant: validVariant(record.variant) };
  }
  return { collection, partner: collection[value?.partner] ? value.partner : null };
}

export function discoverCreature(progress, creature) {
  const creatures = normalizeCreatures(progress.creatures);
  progress.creatures = creatures;
  if (!species.has(creature.id) || !Number.isSafeInteger(creature.level) || creature.level < 1) return '';
  const previous = creatures.collection[creature.id];
  const level = Math.max(previous?.level || 0, creature.level);
  const defeatedVariant = validVariant(creature.variant);
  const variant = variantRank[defeatedVariant] > variantRank[previous?.variant || 'normal'] ? defeatedVariant : previous?.variant || 'normal';
  if (previous && level === previous.level && variant === previous.variant) return '';
  creatures.collection[creature.id] = { level, variant };
  const form = variant === 'normal' ? '' : `${variant === 'golden' ? 'Golden' : 'Elite'} `;
  if (!previous) return `${form}${creature.name} discovered at Lv. ${level}! Choose it in Creatures to travel with you.`;
  const levelNews = level > previous.level ? `Lv. ${previous.level} → Lv. ${level}. Its ability is stronger!` : '';
  const formNews = variant !== previous.variant ? `${form.trim()} form unlocked! As your partner, it earns ${CREATURE_VARIANTS[variant].bonusCoins} bonus coins per battle win.` : '';
  return `${creature.name} upgraded: ${[levelNews, formNews].filter(Boolean).join(' ')}`;
}

export function chooseCompanion(progress, id) {
  const creatures = normalizeCreatures(progress.creatures);
  if (id !== null && !creatures.collection[id]) return false;
  progress.creatures = { ...creatures, partner: id };
  return true;
}

export function creatureAbility(definition, level) {
  if (!definition || !Number.isSafeInteger(level) || level < 1) return null;
  const ability = { name: definition.ability, hits: definition.hits || 0 };
  for (const key of ['heal', 'shield', 'strike', 'echo', 'leech']) {
    const [base, growth] = definition[key] || [0, 0];
    ability[key] = base + growth * level;
  }
  const effects = [];
  if (ability.heal) effects.push(`Restore up to ${ability.heal} HP now.`);
  if (ability.shield) effects.push(`Absorb the next ${ability.shield} damage this battle.`);
  const attacks = `Your next ${ability.hits === 1 ? 'successful attack' : `${ability.hits} successful attacks`}`;
  if (ability.strike) effects.push(`${attacks} ${ability.hits === 1 ? 'deals' : 'each deal'} ${ability.strike} extra damage.`);
  if (ability.echo) effects.push(`${attacks} ${ability.hits === 1 ? 'deals' : 'each deal'} ${ability.echo}% extra damage.`);
  if (ability.leech) effects.push(`${attacks} ${ability.hits === 1 ? 'restores' : 'each restore'} up to ${ability.leech} HP.`);
  ability.description = effects.join(' ');
  return ability;
}

export function activeCompanion(progress, definitions = {}) {
  const creatures = normalizeCreatures(progress.creatures);
  const id = creatures.partner;
  if (!id) return null;
  const { level, variant } = creatures.collection[id];
  const ability = creatureAbility(definitions[id], level);
  return ability ? { ...species.get(id), level, variant, bonusCoins: CREATURE_VARIANTS[variant].bonusCoins, ability } : null;
}

export function partnerVictoryBonus(progress) {
  const creatures = normalizeCreatures(progress.creatures);
  const variant = creatures.collection[creatures.partner]?.variant || 'normal';
  return CREATURE_VARIANTS[variant].bonusCoins;
}

export function activateCompanion(battle, player, companion) {
  if (!companion || battle.companionUsed) return false;
  battle.companionUsed = true;
  battle.companionEffect = { ...companion.ability };
  battle.companionShield = companion.ability.shield;
  player.hp = Math.min(player.maxHp, player.hp + companion.ability.heal);
  return true;
}

export function companionStrike(battle, player, damage) {
  const effect = battle.companionEffect;
  if (damage <= 0 || !effect || effect.hits <= 0) return damage;
  effect.hits -= 1;
  player.hp = Math.min(player.maxHp, player.hp + effect.leech);
  return damage + effect.strike + Math.ceil(damage * effect.echo / 100);
}

export function companionCounterattack(battle, player, random, options, creature = battle.creature) {
  const result = enemyAttack({ creature }, player, random, options);
  const absorbed = Math.min(result.damage, battle.companionShield || 0);
  battle.companionShield = Math.max(0, (battle.companionShield || 0) - absorbed);
  return { ...result, damage: result.damage - absorbed, absorbed, player: { ...result.player, hp: Math.max(0, player.hp - result.damage + absorbed) } };
}

export function companionStatus(battle) {
  const parts = [];
  if (battle.companionShield) parts.push(`${battle.companionShield} shield remaining`);
  if (battle.companionEffect?.hits) parts.push(`${battle.companionEffect.hits} enhanced attack${battle.companionEffect.hits === 1 ? '' : 's'} remaining`);
  return parts.join(' · ') || (battle.companionUsed ? 'Ability used for this battle' : 'Ready once this battle');
}
