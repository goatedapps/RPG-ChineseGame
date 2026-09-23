export function buyItem(player, inventory, itemId, item) {
  if (player.coins < item.price) return { ok: false, player, inventory, reason: 'Not enough coins.' };
  return {
    ok: true,
    player: { ...player, coins: player.coins - item.price },
    inventory: { ...inventory, [itemId]: (inventory[itemId] || 0) + 1 }
  };
}

export function useHealingItem(player, inventory, itemId, item) {
  if (!inventory[itemId]) return { ok: false, player, inventory };
  return {
    ok: true,
    player: { ...player, hp: Math.min(player.maxHp, player.hp + item.heal) },
    inventory: { ...inventory, [itemId]: inventory[itemId] - 1 }
  };
}

