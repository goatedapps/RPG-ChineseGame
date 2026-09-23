export function useConsumable(inventory, itemId) {
  if (!inventory[itemId]) return { ok: false, inventory };
  return { ok: true, inventory: { ...inventory, [itemId]: inventory[itemId] - 1 } };
}

export function applyHealing(player, item) {
  const hp = item.effect === 'full-heal' ? player.maxHp : Math.min(player.maxHp, player.hp + item.amount);
  return { ...player, hp };
}

