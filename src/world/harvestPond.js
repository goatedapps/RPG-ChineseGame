export function isHarvestPondCenter(map, tile) {
  return map?.id === 'r2-harvest-crossing'
    && tile?.x >= 4 && tile.x <= 6
    && tile.y >= 12 && tile.y <= 14
    && map.tiles[tile.y]?.[tile.x] === 'w';
}
