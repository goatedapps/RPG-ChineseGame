export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
  return map.tiles[y][x];
}

export function objectOccupies(object, x, y) {
  if (object.rect) {
    return x >= object.rect.x && y >= object.rect.y
      && x < object.rect.x + object.rect.width
      && y < object.rect.y + object.rect.height;
  }
  return object.x === x && object.y === y;
}

export function objectsAt(map, x, y) {
  return map.objects.filter(object => objectOccupies(object, x, y));
}

export function isWalkable(map, x, y) {
  const tile = tileAt(map, x, y);
  if (!tile || map.legend[tile]?.walkable === false) return false;
  return !objectsAt(map, x, y).some(object => object.solid);
}

export function attemptStep(player, map, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) return { player, moved: false, interaction: null };
  const target = { x: player.x + delta.x, y: player.y + delta.y };
  const interaction = objectsAt(map, target.x, target.y).find(object => object.interaction) || null;
  if (!isWalkable(map, target.x, target.y)) {
    return { player: { ...player, direction }, moved: false, interaction };
  }
  return {
    player: { ...player, ...target, direction },
    moved: true,
    interaction
  };
}

export function validateMap(map) {
  const errors = [];
  if (map.tiles.length !== map.height) errors.push(`Expected ${map.height} rows, found ${map.tiles.length}.`);
  map.tiles.forEach((row, index) => {
    if (row.length !== map.width) errors.push(`Row ${index} has width ${row.length}; expected ${map.width}.`);
    for (const tile of row) if (!map.legend[tile]) errors.push(`Row ${index} uses unknown tile ${tile}.`);
  });
  if (!isWalkable(map, map.spawn.x, map.spawn.y)) errors.push('The spawn tile is not walkable.');
  return errors;
}
