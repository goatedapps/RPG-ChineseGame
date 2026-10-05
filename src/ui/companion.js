import { escapeHtml } from './dom.js';
import { creatureSvg } from '../battle/creatureArt.js';
import { companionStatus } from '../systems/companions.js';

export function companionBattleCard(companion, battle, disabled = false) {
  if (!companion) return '';
  return `<aside class="companion-battle-card ${companion.variant || 'normal'}">${creatureSvg(companion.id, '')}<div><b>${companion.variant && companion.variant !== 'normal' ? `${companion.variant === 'golden' ? 'Golden' : 'Elite'} ` : ''}${escapeHtml(companion.name)} · Lv. ${companion.level}</b><p>${escapeHtml(companion.ability.description)}</p>${companion.bonusCoins ? `<p>+${companion.bonusCoins} coins if you win this battle.</p>` : ''}<small>${escapeHtml(companionStatus(battle))}</small></div><button type="button" class="secondary" data-companion-skill ${disabled || battle.companionUsed ? 'disabled' : ''}>${battle.companionUsed ? 'Ability used' : escapeHtml(companion.ability.name)}</button></aside>`;
}
