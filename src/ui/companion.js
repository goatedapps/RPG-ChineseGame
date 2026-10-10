import { escapeHtml } from './dom.js';
import { creatureSvg } from '../battle/creatureArt.js';
import { companionStatus } from '../systems/companions.js';

export function companionBattleCard(companion, battle, disabled = false) {
  if (!companion) return '';
  return `<aside class="companion-battle-card ${companion.variant || 'normal'} ${battle.companionUsed ? 'has-supported' : ''}" ${battle.companionUsed ? 'data-companion-used' : disabled ? '' : 'data-companion-ready'}>${creatureSvg(companion.id, '')}<div><b>${companion.variant && companion.variant !== 'normal' ? `${companion.variant === 'golden' ? 'Golden' : 'Elite'} ` : ''}${escapeHtml(companion.name)} · Lv. ${companion.level}</b><p>${escapeHtml(companion.ability.description)}</p>${companion.bonusCoins ? `<p>+${companion.bonusCoins} coins if you win this battle.</p>` : ''}${battle.companionNotice ? `<p class="companion-notice" role="status">${escapeHtml(battle.companionNotice)}</p>` : ''}<small>${escapeHtml(companionStatus(battle))}</small></div></aside>`;
}
