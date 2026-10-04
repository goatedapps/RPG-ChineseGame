import { CREATURES, createBoss } from '../battle/creatures.js';
import { creatureSvg } from '../battle/creatureArt.js';
import { activeCompanion, creatureAbility, normalizeCreatures } from '../systems/companions.js';
import { escapeHtml } from './dom.js';

export function creatureCollectionMarkup(game, notice = '') {
  const { progress } = game.state;
  const pkg = game.levelPackage;
  const creatures = normalizeCreatures(progress.creatures);
  const companion = activeCompanion(progress, pkg.companions);
  const discovered = CREATURES.filter(creature => creatures.collection[creature.id]);
  const cards = discovered.map(creature => {
    const level = creatures.collection[creature.id].level;
    const definition = pkg.companions[creature.id];
    const ability = creatureAbility(definition, level);
    const next = creatureAbility(definition, level + 1);
    const selected = creatures.partner === creature.id;
    return `<article class="creature-card ${selected ? 'is-partner' : ''}" style="--creature-color:${creature.color}"><div class="creature-card-portrait">${creatureSvg(creature.id, '')}<span class="creature-level">Lv. ${level}</span></div><div class="creature-card-copy"><h2>${escapeHtml(creature.name)}</h2><p class="creature-personality">${escapeHtml(definition.personality)}</p><h3>${escapeHtml(ability.name)}</h3><p>${escapeHtml(ability.description)}</p><small>Use once per battle, including boss battles. Enhanced attacks require a correct answer.</small><details><summary>At level ${level + 1}</summary><p>${escapeHtml(next.description)}</p></details><button type="button" class="${selected ? 'secondary' : 'primary'}" data-choose-creature="${creature.id}" aria-pressed="${selected}">${selected ? 'Your partner' : 'Choose as partner'}</button></div></article>`;
  }).join('');
  const bosses = Object.entries(pkg.campaigns || {}).filter(([id]) => (id === pkg.region.id ? progress.story : progress.regions?.[id]?.story)?.bossDefeated).map(([id, campaign]) => {
    const boss = createBoss(pkg.balance, pkg.config.regionLessons[id]);
    return `<article class="creature-boss-record">${creatureSvg(campaign.region.boss, '')}<div><h3>${escapeHtml(campaign.regionStory.bossName)}</h3><p>Lv. ${boss.level} · Defeated</p><small>Story discovery · cannot be a partner</small></div></article>`;
  }).join('');
  return `<div class="panel creatures-panel"><div class="panel-header"><div><p class="panel-kicker">Friends from the fog</p><h1>Creatures</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Meet a creature to add it here—even if you retreat. We keep its highest encountered level. Meeting a stronger one upgrades its ability automatically.</p><p class="creature-selection-notice" role="status">${escapeHtml(notice)}</p><section class="creature-partner-banner">${companion ? `${creatureSvg(companion.id, '')}<div><span>Your travelling partner</span><h2>${escapeHtml(companion.name)} · Lv. ${companion.level}</h2><b>${escapeHtml(companion.ability.name)}</b><p>${escapeHtml(companion.ability.description)}</p></div><button class="secondary" data-release-creature>Travel alone</button>` : '<div><h2>Choose one travelling partner</h2><p>Your partner follows you and has an ability you can use once in each battle. Choose a discovered creature below.</p></div>'}</section><h2 class="creature-discovery-count">${discovered.length} of ${CREATURES.length} creatures discovered</h2>${cards ? `<div class="creature-collection-grid">${cards}</div>` : '<p class="creature-empty">Explore a fog route to meet your first creature, then return here to choose it. Older saves start recording creature levels from the next encounter.</p>'}${bosses ? `<section class="creature-bosses"><h2>Boss discoveries</h2><div>${bosses}</div></section>` : ''}</div>`;
}
