export function normalizeEquipment(value = {}) {
  return {
    owned: [...new Set(value.owned || ['bamboo-brush'])],
    equipped: { brush: 'bamboo-brush', charm: null, hat: null, ...(value.equipped || {}) }
  };
}

export function equipGear(value, gear) {
  const equipment = normalizeEquipment(value);
  if (!equipment.owned.includes(gear.id)) return equipment;
  return { ...equipment, equipped: { ...equipment.equipped, [gear.slot]: gear.id } };
}

export function gearBonuses(value, gearList) {
  const equipment = normalizeEquipment(value);
  const equipped = Object.values(equipment.equipped).map(id => gearList.find(gear => gear.id === id)).filter(Boolean);
  const bonuses = { maxHp: 0, evasion: 0, xp: 0, spellDefense: 0, skillDamage: { p: 0, h: 0, w: 0 } };
  for (const gear of equipped) {
    if (gear.effect === 'max-hp') bonuses.maxHp += gear.amount;
    if (gear.effect === 'evasion') bonuses.evasion += gear.amount;
    if (gear.effect === 'xp') bonuses.xp += gear.amount;
    if (gear.effect === 'spell-defense') bonuses.spellDefense += gear.amount;
    if (gear.effect === 'pinyin-damage') bonuses.skillDamage.p += gear.amount;
    if (gear.effect === 'hanzi-damage') bonuses.skillDamage.h += gear.amount;
    if (gear.effect === 'writing-damage') bonuses.skillDamage.w += gear.amount;
  }
  return bonuses;
}

