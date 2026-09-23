export function updateHud(elements, levelPackage, state) {
  elements.level.textContent = levelPackage.label;
  elements.location.textContent = levelPackage.map.name;
  elements.playerLevel.textContent = state.player.level;
  elements.xp.textContent = `${state.player.xp} XP`;
  elements.hp.textContent = `${state.player.hp}/${state.player.maxHp}`;
  elements.hpBar.style.width = `${Math.min(100, state.player.hp / state.player.maxHp * 100)}%`;
  elements.coins.textContent = state.player.coins;
  elements.status.textContent = state.tampered ? 'Save edited' : 'Save verified';
  elements.status.classList.toggle('warning', state.tampered);
}
