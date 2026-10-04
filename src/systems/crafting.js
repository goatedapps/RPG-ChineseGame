import { normalizeEquipment } from './gear.js';

export function canCraft(recipe, player, materials, equipment) {
  const owned = normalizeEquipment(equipment).owned;
  return !owned.includes(recipe.id) && player.coins >= recipe.coins && Object.entries(recipe.materials).every(([id, count]) => (materials[id] || 0) >= count);
}

export function addNeededMaterials(materials, drops, recipes, equipment) {
  const owned = new Set(normalizeEquipment(equipment).owned);
  const needed = {};
  for (const recipe of recipes) {
    if (owned.has(recipe.id)) continue;
    for (const [id, count] of Object.entries(recipe.materials)) needed[id] = (needed[id] || 0) + count;
  }
  const nextMaterials = { ...materials };
  const awarded = {};
  for (const [id, count] of Object.entries(drops)) {
    const remaining = Math.max(0, (needed[id] || 0) - (Number(nextMaterials[id]) || 0));
    const amount = Math.min(remaining, Math.max(0, Number(count) || 0));
    if (!amount) continue;
    nextMaterials[id] = (Number(nextMaterials[id]) || 0) + amount;
    awarded[id] = amount;
  }
  return { materials: nextMaterials, awarded };
}

export function craft(recipe, player, materials, equipment) {
  if (!canCraft(recipe, player, materials, equipment)) return { ok: false, player, materials, equipment };
  const nextMaterials = { ...materials };
  for (const [id, count] of Object.entries(recipe.materials)) nextMaterials[id] -= count;
  const nextEquipment = normalizeEquipment(equipment);
  nextEquipment.owned.push(recipe.id);
  return { ok: true, player: { ...player, coins: player.coins - recipe.coins }, materials: nextMaterials, equipment: nextEquipment };
}

