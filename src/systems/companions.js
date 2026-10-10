import { CREATURES, CREATURE_VARIANTS } from '../battle/creatures.js';
import { capBossDamage } from '../battle/damage.js';
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

const skillNames = { m: 'Meaning', p: 'Pinyin', h: 'Hanzi', u: 'Usage', w: 'Writing' };

export function creatureAbility(definition, level, heroLevel = level) {
  if (!definition || !Number.isSafeInteger(level) || level < 1) return null;
  const strength = Math.min(1, (level + 4) / (Math.max(1, heroLevel) + 4));
  const ability = { name: definition.ability, trigger: definition.trigger, hits: definition.hits || 0,
    heal: Math.min(.20, definition.heal || 0) * strength,
    shield: Math.max(0, Math.min(.20 - Math.min(.20, definition.heal || 0), definition.shield || 0)) * strength,
    damage: Math.min(.15, definition.damage || 0) * strength };
  const trigger = ability.trigger;
  const when = trigger.kind === 'skill' ? 'After a correct ' + skillNames[trigger.skill] + ' attack'
    : trigger.kind === 'variety' ? 'After correct attacks in ' + trigger.count + ' different skills'
    : trigger.kind === 'answers' ? 'After ' + trigger.count + ' correct attacks'
    : 'When a hit would take you to half HP or below';
  const percent = fraction => Math.round(fraction * 1000) / 10;
  const effects = [];
  if (ability.heal) effects.push('restore up to ' + percent(ability.heal) + '% of your maximum HP');
  if (ability.shield) effects.push('shield up to ' + percent(ability.shield) + '% of your maximum HP');
  if (ability.damage) effects.push('add up to ' + percent(ability.damage) + '% of enemy maximum HP in total damage across ' + ability.hits + ' successful attack' + (ability.hits === 1 ? '' : 's'));
  ability.description = when + ', ' + effects.join(' and ') + '. Automatic, once per battle.' + (ability.damage ? ' Extra damage stays within the boss damage limit.' : '');
  return ability;
}

export function activeCompanion(progress, definitions = {}, heroLevel) {
  const creatures = normalizeCreatures(progress.creatures);
  const id = creatures.partner;
  if (!id) return null;
  const { level, variant } = creatures.collection[id];
  const ability = creatureAbility(definitions[id], level, heroLevel);
  return ability ? { ...species.get(id), definition: definitions[id], level, variant, bonusCoins: CREATURE_VARIANTS[variant].bonusCoins, ability } : null;
}

export function partnerVictoryBonus(progress) {
  const creatures = normalizeCreatures(progress.creatures);
  const variant = creatures.collection[creatures.partner]?.variant || 'normal';
  return CREATURE_VARIANTS[variant].bonusCoins;
}

function triggerSupport(battle, player, companion) {
  if (!companion || battle.companionUsed || player.hp <= 0) return false;
  const ability = creatureAbility(companion.definition, companion.level, player.level);
  if (!ability) return false;
  const maximum = battle.creature?.maxHp ?? battle.maxHp;
  const heal = Math.min(player.maxHp - player.hp, Math.floor(player.maxHp * ability.heal));
  const shield = Math.floor(player.maxHp * ability.shield);
  const damage = Math.floor(maximum * ability.damage);
  if (!heal && !shield && !damage) return false;
  battle.companionUsed = true;
  battle.companionEffect = { hits: ability.hits, damage };
  battle.companionShield = shield;
  player.hp += heal;
  const effects = [];
  if (heal) effects.push(`restored ${heal} HP`);
  if (shield) effects.push(`prepared ${shield} shield`);
  if (damage) effects.push(`prepared up to ${damage} extra damage`);
  battle.companionNotice = `${companion.name} used ${ability.name}: ${effects.join(' and ')}.`;
  return true;
}

export function companionStrike(battle, player, damage, { skill = null, boss = false } = {}) {
  if (damage <= 0) return 0;
  const companion = battle.companion;
  if (companion && !battle.guided) {
    battle.companionCorrect = (battle.companionCorrect || 0) + 1;
    battle.companionSkills = [...new Set([...(battle.companionSkills || []), ...(skill ? [skill] : [])])];
    const trigger = companion.definition.trigger;
    const ready = trigger.kind === 'skill' ? skill === trigger.skill
      : trigger.kind === 'variety' ? battle.companionSkills.length >= trigger.count
      : trigger.kind === 'answers' && battle.companionCorrect >= trigger.count;
    if (ready) triggerSupport(battle, player, companion);
  }
  const effect = battle.companionEffect;
  const base = boss ? capBossDamage(damage, battle.maxHp) : damage;
  if (!effect?.hits || !effect.damage) return base;
  const room = boss ? Math.max(0, capBossDamage(Number.MAX_SAFE_INTEGER, battle.maxHp) - base) : effect.damage;
  const bonus = Math.min(room, Math.ceil(effect.damage / effect.hits));
  if (bonus > 0) {
    effect.hits -= 1;
    effect.damage = effect.hits ? effect.damage - bonus : 0;
    battle.companionNotice = `${companion.name} added ${bonus} damage with ${companion.ability.name}.`;
  }
  return boss ? capBossDamage(base + bonus, battle.maxHp) : base + bonus;
}

export function companionCounterattack(battle, player, random, options, creature = battle.creature) {
  let result = enemyAttack({ creature }, player, random, options);
  const companion = battle.companion;
  const trigger = companion?.definition.trigger;
  if (!battle.guided && result.damage > 0 && trigger?.kind === 'danger' && player.hp - result.damage <= player.maxHp * trigger.threshold) {
    const before = player.hp;
    triggerSupport(battle, player, companion);
    if (player.hp !== before) result = { ...result, player: { ...result.player, hp: Math.max(0, player.hp - result.damage) } };
  }
  const absorbed = Math.min(result.damage, battle.companionShield || 0);
  battle.companionShield = Math.max(0, (battle.companionShield || 0) - absorbed);
  if (absorbed) battle.companionNotice = `${companion?.name || 'Your companion'} shield absorbed ${absorbed} damage.`;
  return { ...result, damage: result.damage - absorbed, absorbed, player: { ...result.player, hp: Math.max(0, player.hp - result.damage + absorbed) } };
}

export function companionStatus(battle) {
  const parts = [];
  if (battle.companionShield) parts.push(`${battle.companionShield} shield remaining`);
  if (battle.companionEffect?.damage) parts.push(`${battle.companionEffect.damage} bonus damage remaining`);
  return parts.join(' · ') || (battle.companionUsed ? 'Support used for this battle' : 'Waiting for its trigger · automatic');
}
