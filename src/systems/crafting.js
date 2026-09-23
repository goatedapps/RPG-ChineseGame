import { normalizeEquipment } from './gear.js';

export function canCraft(recipe, player, materials, equipment) {
  const owned = normalizeEquipment(equipment).owned;
  return !owned.includes(recipe.id) && player.coins >= recipe.coins && Object.entries(recipe.materials).every(([id, count]) => (materials[id] || 0) >= count);
}

export function craft(recipe, player, materials, equipment) {
  if (!canCraft(recipe, player, materials, equipment)) return { ok: false, player, materials, equipment };
  const nextMaterials = { ...materials };
  for (const [id, count] of Object.entries(recipe.materials)) nextMaterials[id] -= count;
  const nextEquipment = normalizeEquipment(equipment);
  nextEquipment.owned.push(recipe.id);
  return { ok: true, player: { ...player, coins: player.coins - recipe.coins }, materials: nextMaterials, equipment: nextEquipment };
}

