export function normalizeCosmetics(value, catalog = []) {
  const definitions = new Map(catalog.map(item => [item.id, item]));
  const owned = [...new Set((Array.isArray(value?.owned) ? value.owned : []).filter(id => definitions.has(id)))];
  const room = [...new Set((Array.isArray(value?.room) ? value.room : []).filter(id => owned.includes(id) && definitions.get(id).type === 'room'))];
  const outfit = owned.includes(value?.outfit) && definitions.get(value.outfit)?.type === 'outfit' ? value.outfit : null;
  return { owned, room: room.filter(id => !definitions.get(id).requires || room.includes(definitions.get(id).requires)), outfit };
}

export function cosmeticPurchaseReason(player, cosmetics, item, regionId) {
  if (!item || item.region !== regionId) return 'Visit the village that sells this item.';
  if (cosmetics.owned.includes(item.id)) return 'Already owned.';
  if (item.requires && !cosmetics.owned.includes(item.requires)) return 'Buy the companion nest first.';
  if (player.coins < item.price) return 'Not enough coins.';
  return '';
}

export function purchaseCosmetic(player, cosmetics, item, regionId) {
  const reason = cosmeticPurchaseReason(player, cosmetics, item, regionId);
  if (reason) return { ok: false, reason, player, cosmetics };
  return {
    ok: true,
    player: { ...player, coins: player.coins - item.price },
    cosmetics: {
      owned: [...cosmetics.owned, item.id],
      room: item.type === 'room' ? [...new Set([...cosmetics.room, ...(item.requires ? [item.requires] : []), item.id])] : [...cosmetics.room],
      outfit: item.type === 'outfit' ? item.id : cosmetics.outfit
    }
  };
}

export function arrangeCosmetic(cosmetics, item) {
  if (!item || !cosmetics.owned.includes(item.id)) return cosmetics;
  if (item.type === 'outfit') return { ...cosmetics, outfit: cosmetics.outfit === item.id ? null : item.id };
  if (item.requires && !cosmetics.room.includes(item.requires)) return cosmetics;
  const removing = cosmetics.room.includes(item.id);
  const room = removing ? cosmetics.room.filter(id => id !== item.id && !(item.id === 'companion-nest' && id === 'companion-ribbon')) : [...cosmetics.room, item.id];
  return { ...cosmetics, room };
}
