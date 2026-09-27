export function animateBattleHealth(battle, player, enemyHp) {
  const current = [player.hp / player.maxHp, enemyHp / battle.maxHp].map(value => Math.max(0, Math.min(1, value)));
  const previous = battle.displayedHealth || current;
  battle.displayedHealth = current;
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const bars = [document.querySelector('.battle-player .enemy-hp i'), document.querySelector('.battle-enemy .enemy-hp i')];
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    if (!bar || previous[index] === current[index]) continue;
    bar.style.transition = 'none';
    bar.style.width = `${previous[index] * 100}%`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!bar.isConnected) return;
      bar.style.transition = '';
      bar.style.width = `${current[index] * 100}%`;
    }));
  }
}
