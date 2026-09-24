import { localDay } from '../core/time.js';

export function updateHud(elements, levelPackage, state) {
  elements.level.textContent = levelPackage.label;
  elements.location.textContent = levelPackage.map.name;
  elements.playerLevel.textContent = state.player.level;
  const xpNeeded = state.player.level * 30;
  elements.xp.textContent = `${state.player.xp}/${xpNeeded} XP`;
  if (elements.xpBar) elements.xpBar.style.width = `${Math.min(100, state.player.xp / xpNeeded * 100)}%`;
  elements.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
  elements.hpBar.style.width = `${Math.min(100, state.player.hp / state.player.maxHp * 100)}%`;
  elements.coins.textContent = state.player.coins;
  if (elements.spirits) elements.spirits.textContent = Object.values(state.progress.words).filter(value => value?.collected || value?.c).length;
  if (elements.battles) {
    const used = state.progress.energy.day === localDay() ? state.progress.energy.used : 0;
    elements.battles.textContent = state.settings.dailyBattles ? `${Math.max(0, state.settings.dailyBattles - used)} left` : 'Unlimited';
  }
  if (elements.streak) elements.streak.textContent = `${state.progress.streak?.count || 0} days`;
  elements.status.textContent = state.tampered ? 'Save edited' : 'Save verified';
  elements.status.classList.toggle('warning', state.tampered);
}
