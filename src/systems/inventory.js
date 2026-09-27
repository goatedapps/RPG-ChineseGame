export function useConsumable(inventory, itemId) {
  if (!inventory[itemId]) return { ok: false, inventory };
  return { ok: true, inventory: { ...inventory, [itemId]: inventory[itemId] - 1 } };
}

export function applyHealing(player, item) {
  const restored = Math.max(item.amount || 0, Math.ceil(player.maxHp * (item.healFraction || 0)));
  const hp = item.effect === 'full-heal' ? player.maxHp : Math.min(player.maxHp, player.hp + restored);
  return { ...player, hp };
}

