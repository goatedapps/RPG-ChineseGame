import { CREATURES, CREATURE_VARIANTS, createBoss, creatureVariantNote } from '../battle/creatures.js';
import { creatureSvg } from '../battle/creatureArt.js';
import { activeCompanion, creatureAbility, normalizeCreatures } from '../systems/companions.js';
import { SKILLS } from '../learning/mastery.js';
import { escapeHtml } from './dom.js';

function supportTrigger(trigger) {
  if (trigger.kind === 'skill') return `After a correct ${SKILLS[trigger.skill].name} attack`;
  if (trigger.kind === 'answers') return `After ${trigger.count} correct attacks`;
  if (trigger.kind === 'variety') return `After using ${trigger.count} different skills correctly`;
  return 'When a hit would leave you at half HP or less';
}

function supportEffects(ability) {
  const percent = value => Math.round(value * 1000) / 10;
  return [
    ability.heal ? `heal up to ${percent(ability.heal)}% of your maximum HP` : '',
    ability.shield ? `shield up to ${percent(ability.shield)}% of your maximum HP` : '',
    ability.damage ? `deal up to ${percent(ability.damage)}% of the enemy’s maximum HP in bonus damage` : ''
  ].filter(Boolean).join(' and ');
}

function supportSummary(ability) {
  return `${supportTrigger(ability.trigger)}, ${supportEffects(ability)}.`;
}

export function creatureCollectionMarkup(game, notice = '') {
  const { progress } = game.state;
  const pkg = game.levelPackage;
  const creatures = normalizeCreatures(progress.creatures);
  const companion = activeCompanion(progress, pkg.companions, game.state.player?.level);
  const discovered = CREATURES.filter(creature => creatures.collection[creature.id]);
  const cards = discovered.map(creature => {
    const { level, variant } = creatures.collection[creature.id];
    const definition = pkg.companions[creature.id];
    const ability = creatureAbility(definition, level, game.state.player?.level);
    const next = creatureAbility(definition, level + 1, game.state.player?.level);
    const selected = creatures.partner === creature.id;
    const effects = supportEffects(ability);
    const nextEffects = supportEffects(next);
    const growth = nextEffects !== effects
      ? `<p class="creature-growth">At creature Lv. ${level + 1}: ${escapeHtml(nextEffects)}.</p>`
      : level >= (game.state.player?.level || level) ? '<p class="creature-growth">At full support strength for your current hero level.</p>' : '';
    return `<article class="creature-card ${variant} ${selected ? 'is-partner' : ''}" style="--creature-color:${creature.color}">
      <div class="creature-card-header">
        <div class="creature-card-portrait">${creatureSvg(creature.id, '')}</div>
        <div class="creature-card-heading">
          <div class="creature-card-title"><h2>${escapeHtml(creature.name)}</h2><span class="creature-level">Lv. ${level}</span></div>
          ${variant !== 'normal' ? `<span class="creature-form-badge">${variant === 'golden' ? '✦ Golden' : '✧ Elite'}</span>` : ''}
          <h3>${escapeHtml(ability.name)}</h3>
        </div>
      </div>
      <div class="creature-card-copy">
        <p class="creature-ability-summary">${escapeHtml(supportSummary(ability))}</p>
        ${variant !== 'normal' ? `<p class="creature-partner-perk">${variant === 'golden' ? 'Golden' : 'Elite'} partner: +${CREATURE_VARIANTS[variant].bonusCoins} coins per victory.</p>` : ''}
        <div class="creature-card-actions">
          <details class="creature-ability-details"><summary aria-label="Ability details for ${escapeHtml(creature.name)}">Ability details</summary><div class="creature-ability-body"><p class="creature-personality">${escapeHtml(definition.personality)}</p><p>${escapeHtml(ability.description)}</p>${growth}</div></details>
          <button type="button" class="${selected ? 'secondary' : 'primary'}" data-choose-creature="${creature.id}" aria-label="${selected ? `${escapeHtml(creature.name)} is your partner` : `Choose ${escapeHtml(creature.name)} as partner`}" aria-pressed="${selected}">${selected ? 'Your partner' : 'Choose partner'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
  const bosses = Object.entries(pkg.campaigns || {}).filter(([id]) => (id === pkg.region.id ? progress.story : progress.regions?.[id]?.story)?.bossDefeated).map(([id, campaign]) => {
    const boss = createBoss(pkg.balance, pkg.config.regionLessons[id]);
    return `<article class="creature-boss-record">${creatureSvg(campaign.region.boss, '')}<div><h3>${escapeHtml(campaign.regionStory.bossName)}</h3><p>Lv. ${boss.level} · Defeated</p><small>Story discovery · cannot be a partner</small></div></article>`;
  }).join('');
  return `<div class="panel creatures-panel creature-roster"><div class="panel-header"><div><p class="panel-kicker">Friends from the fog</p><h1>Creatures</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Defeat creatures to collect them. Choose one partner for automatic support once per battle, including bosses.</p><details class="creature-variants-guide"><summary>Forms and support guide</summary><p class="creature-support-guide">We keep each species’ highest defeated level and rarest form. Support strength grows up to your hero’s level. Defeat a higher-level creature of the same species to improve its support. Open Ability details for personality, exact effects and the next upgrade.</p><h3>Elite and Golden creatures</h3><p>Some wild creatures appear in special battle forms. Elite appears in about ${Math.round(CREATURE_VARIANTS.elite.chance * 100)}% of encounters; Golden appears in about ${Math.round(CREATURE_VARIANTS.golden.chance * 100)}%.</p><p><b>Elite:</b> ${creatureVariantNote('elite')}</p><p><b>Golden:</b> ${creatureVariantNote('golden')}</p><p>Defeat one to keep its form in your collection. Golden outranks Elite, and neither form is lost if you later defeat a Normal creature. Choose it as your partner to earn its bonus coins after every battle victory, including a boss battle.</p></details><p class="creature-selection-notice" role="status">${escapeHtml(notice)}</p><section class="creature-partner-banner ${companion?.variant || 'normal'}">${companion ? `${creatureSvg(companion.id, '')}<div><span>Your travelling partner</span><h2>${companion.variant === 'normal' ? '' : `${companion.variant === 'golden' ? 'Golden' : 'Elite'} `}${escapeHtml(companion.name)} · Lv. ${companion.level}</h2><b>${escapeHtml(companion.ability.name)}</b><p>${escapeHtml(supportSummary(companion.ability))}</p>${companion.bonusCoins ? `<p class="creature-partner-perk">+${companion.bonusCoins} coins after every battle victory.</p>` : ''}</div><button class="secondary" data-release-creature>Travel alone</button>` : '<div><h2>Choose one travelling partner</h2><p>Your partner follows you and has support that triggers automatically once in each battle. Choose a discovered creature below.</p></div>'}</section><h2 class="creature-discovery-count">${discovered.length} of ${CREATURES.length} creatures discovered</h2>${cards ? `<div class="creature-collection-grid">${cards}</div>` : '<p class="creature-empty">Win a battle on a fog route to add your first creature, then return here to choose it.</p>'}${bosses ? `<section class="creature-bosses"><h2>Boss discoveries</h2><div>${bosses}</div></section>` : ''}</div>`;
}
