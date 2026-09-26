import { DIRECTIONS, isWalkable, objectOccupies, tileAt } from './map.js';

const ROAM_RADIUS = 4;
const homeOf = npc => npc.home || (npc.home = { x: npc.x, y: npc.y });
const nearHome = (home, x, y) => Math.abs(x - home.x) + Math.abs(y - home.y) <= ROAM_RADIUS;

export function restoreNpcPositions(map, saved = {}) {
  for (const npc of map.objects.filter(object => object.type === 'npc' && object.wander)) {
    const home = homeOf(npc);
    const position = saved[npc.id];
    if (!position) continue;
    const tile = tileAt(map, position.x, position.y);
    const occupied = map.objects.some(other => other !== npc && other.solid && objectOccupies(other, position.x, position.y));
    if (tile && nearHome(home, position.x, position.y) && map.legend[tile]?.walkable !== false && !occupied) Object.assign(npc, position);
  }
}

export function wanderNpcs(map, player, saved = {}, random = Math.random) {
  const next = {};
  const wanderers = map.objects.filter(object => object.type === 'npc' && object.wander);
  for (const npc of wanderers) {
    const home = homeOf(npc);
    if (random() <= 0.8) {
      const directions = Object.entries(DIRECTIONS);
      const start = Math.floor(random() * directions.length);
      for (let offset = 0; offset < directions.length; offset += 1) {
        const [direction, delta] = directions[(start + offset) % directions.length];
        const x = npc.x + delta.x;
        const y = npc.y + delta.y;
        if (!nearHome(home, x, y) || x === player.x && y === player.y || !isWalkable(map, x, y)) continue;
        Object.assign(npc, { x, y, direction });
        break;
      }
    }
    next[npc.id] = { x: npc.x, y: npc.y, direction: npc.direction };
  }
  return next;
}
