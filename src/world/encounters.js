import { tileAt } from './map.js';

export function zoneAt(map, x, y) {
  return (map.zones || []).find(zone => x >= zone.rect.x && y >= zone.rect.y && x < zone.rect.x + zone.rect.width && y < zone.rect.y + zone.rect.height) || null;
}

export function encounterStep(value, map, player, random = Math.random) {
  const zone = zoneAt(map, player.x, player.y);
  const previous = value || { cooldown: 0, zone: null, capNoticeDay: '' };
  if (!zone || tileAt(map, player.x, player.y) !== 'g') return { state: { ...previous, zone: null }, zone: null, entered: null, encounter: false };
  const entered = previous.zone === zone.id ? null : zone;
  const cooldown = Math.max(0, Number(previous.cooldown || 0) - 1);
  const repellentSteps = Math.max(0, Number(previous.repellentSteps || 0));
  if (repellentSteps > 0) return { state: { ...previous, zone: zone.id, cooldown, repellentSteps: repellentSteps - 1 }, zone, entered, encounter: false };
  const encounter = cooldown === 0 && random() < (zone.encounter?.rate ?? 0.16);
  return {
    state: { ...previous, zone: zone.id, cooldown: encounter ? Math.max(3, zone.encounter?.cooldown || 3) : cooldown },
    zone,
    entered,
    encounter
  };
}

export function weightedCreature(types, random = Math.random) {
  const entries = Object.entries(types || {});
  if (!entries.length) return null;
  let target = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [id, weight] of entries) {
    target -= weight;
    if (target <= 0) return id;
  }
  return entries[0][0];
}
