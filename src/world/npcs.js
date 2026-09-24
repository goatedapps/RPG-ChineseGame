import { DIRECTIONS, isWalkable, objectOccupies, tileAt } from './map.js';

export function restoreNpcPositions(map, saved = {}) {
  for (const npc of map.objects.filter(object => object.type === 'npc' && object.wander)) {
    const position = saved[npc.id];
    if (!position) continue;
    const tile = tileAt(map, position.x, position.y);
    const occupied = map.objects.some(other => other !== npc && other.solid && objectOccupies(other, position.x, position.y));
    if (tile && map.legend[tile]?.walkable !== false && !occupied) Object.assign(npc, position);
  }
}

export function wanderNpcs(map, player, saved = {}, random = Math.random) {
  const next = { ...saved };
  const wanderers = map.objects.filter(object => object.type === 'npc' && object.wander);
  for (const npc of wanderers) {
    if (random() > 0.35) continue;
    const directions = Object.entries(DIRECTIONS).sort(() => random() - 0.5);
    for (const [direction, delta] of directions) {
      const x = npc.x + delta.x;
      const y = npc.y + delta.y;
      const occupied = x === player.x && y === player.y || map.objects.some(other => other !== npc && other.solid && other.x === x && other.y === y);
      if (x < 10 || x > 29 || y < 10 || y > 17 || occupied || !isWalkable(map, x, y)) continue;
      Object.assign(npc, { x, y, direction });
      next[npc.id] = { x, y, direction };
      break;
    }
  }
  return next;
}
