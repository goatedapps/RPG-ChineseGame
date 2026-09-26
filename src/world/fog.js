import { DIRECTIONS, isWalkable, tileAt } from './map.js';

const adjacent = (x, y) => Object.values(DIRECTIONS).map(delta => ({ x: x + delta.x, y: y + delta.y }));
const key = (map, x, y) => y * map.width + x;
const blocked = (map, x, y) => {
  const tile = tileAt(map, x, y);
  return tile !== null && map.legend[tile]?.walkable === false;
};

export function revealRouteTile(map, discovered = [], x, y) {
  const seen = new Set(discovered);
  if (tileAt(map, x, y) === null) return discovered;
  seen.add(key(map, x, y));
  for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
    if (Math.abs(dx) + Math.abs(dy) <= 2 && isWalkable(map, x + dx, y + dy)) seen.add(key(map, x + dx, y + dy));
  }
  for (const next of adjacent(x, y)) {
    if (!blocked(map, next.x, next.y) || seen.has(key(map, next.x, next.y))) continue;
    const queue = [next];
    seen.add(key(map, next.x, next.y));
    for (let index = 0; index < queue.length; index += 1) {
      for (const neighbour of adjacent(queue[index].x, queue[index].y)) {
        const mark = key(map, neighbour.x, neighbour.y);
        if (!seen.has(mark) && blocked(map, neighbour.x, neighbour.y)) {
          seen.add(mark);
          queue.push(neighbour);
        }
      }
    }
  }
  for (const object of map.objects || []) {
    if (!object.solid) continue;
    const cells = object.rect
      ? Array.from({ length: object.rect.width * object.rect.height }, (_, index) => ({ x: object.rect.x + index % object.rect.width, y: object.rect.y + Math.floor(index / object.rect.width) }))
      : [{ x: object.x, y: object.y }];
    if (!cells.some(cell => Math.abs(cell.x - x) + Math.abs(cell.y - y) === 1)) continue;
    for (const cell of cells) seen.add(key(map, cell.x, cell.y));
  }
  return [...seen];
}

export function routeDiscoveryPercent(map, discovered = []) {
  const walkable = map.tiles.flatMap((row, y) => [...row].map((tile, x) => isWalkable(map, x, y) ? key(map, x, y) : null)).filter(value => value !== null);
  if (!walkable.length) return 0;
  const seen = new Set(discovered);
  return Math.round(walkable.filter(value => seen.has(value)).length / walkable.length * 100);
}
