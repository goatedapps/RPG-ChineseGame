const WIDTH = 44;
const HEIGHT = 32;
export const ROUTE_MAP_VERSION = 2;
export const ROUTE_WIDTH = 62;
export const ROUTE_HEIGHT = 45;

export function scaleRouteCell(value, oldSize, newSize) {
  return Math.max(0, Math.min(newSize - 1, Math.round((value + 0.5) * newSize / oldSize - 0.5)));
}

const scaleBoundary = (value, oldSize, newSize) => Math.round(value * newSize / oldSize);

export function expandRouteMap(map, encounterScale = 1.2) {
  const oldWidth = map.width;
  const oldHeight = map.height;
  const xCell = x => scaleRouteCell(x, oldWidth, ROUTE_WIDTH);
  const yCell = y => scaleRouteCell(y, oldHeight, ROUTE_HEIGHT);
  const position = point => ({ ...point, x: xCell(point.x), y: yCell(point.y) });
  const rect = value => {
    const x = scaleBoundary(value.x, oldWidth, ROUTE_WIDTH);
    const y = scaleBoundary(value.y, oldHeight, ROUTE_HEIGHT);
    return { x, y, width: Math.max(1, scaleBoundary(value.x + value.width, oldWidth, ROUTE_WIDTH) - x), height: Math.max(1, scaleBoundary(value.y + value.height, oldHeight, ROUTE_HEIGHT) - y) };
  };
  const tiles = Array.from({ length: ROUTE_HEIGHT }, (_, y) => Array.from({ length: ROUTE_WIDTH }, (_, x) => {
    const oldX = Math.min(oldWidth - 1, Math.floor(x * oldWidth / ROUTE_WIDTH));
    const oldY = Math.min(oldHeight - 1, Math.floor(y * oldHeight / ROUTE_HEIGHT));
    return map.tiles[oldY][oldX];
  }));
  for (const [slot, fraction, opening] of [[0, .24, .7], [1, .48, .28], [2, .72, .73]]) {
    const x = Math.round(ROUTE_WIDTH * fraction);
    const gapY = Math.round(ROUTE_HEIGHT * opening);
    for (let y = 2; y < ROUTE_HEIGHT - 2; y += 1) {
      if (Math.abs(y - gapY) <= 3 || tiles[y][x] === 'p') continue;
      if ((y + slot) % 11 !== 0 && map.legend[tiles[y][x]]?.walkable) tiles[y][x] = 't';
    }
  }
  for (let x = 0; x < ROUTE_WIDTH; x += 1) { tiles[0][x] = 't'; tiles[ROUTE_HEIGHT - 1][x] = 't'; }
  for (let y = 0; y < ROUTE_HEIGHT; y += 1) { tiles[y][0] = 't'; tiles[y][ROUTE_WIDTH - 1] = 't'; }
  const objects = map.objects.map(object => ({ ...object, ...(object.rect ? { rect: rect(object.rect) } : position(object)), ...(object.door ? { door: position(object.door) } : {}) }));
  const pavilion = objects.find(object => object.id === 'boss-pavilion-building');
  const pavilionDoor = objects.find(object => object.id === 'boss-pavilion-door');
  if (pavilion && pavilionDoor) {
    pavilionDoor.y = pavilion.rect.y + pavilion.rect.height - 1;
    const frontY = pavilionDoor.y + 1;
    const centerX = pavilion.rect.x + Math.floor(pavilion.rect.width / 2);
    const openings = Array.from({ length: pavilion.rect.width }, (_, offset) => pavilion.rect.x + offset);
    const approachX = openings.filter(x => map.legend[tiles[frontY]?.[x]]?.walkable).sort((a, b) => Math.abs(a - centerX) - Math.abs(b - centerX))[0] ?? centerX;
    pavilionDoor.x = centerX;
    for (let x = Math.min(centerX, approachX); x <= Math.max(centerX, approachX); x += 1) tiles[frontY][x] = 'p';
    pavilion.door = { x: pavilionDoor.x, y: pavilionDoor.y + 1 };
  }
  return {
    ...map,
    mapVersion: ROUTE_MAP_VERSION,
    width: ROUTE_WIDTH,
    height: ROUTE_HEIGHT,
    legacyWidth: oldWidth,
    legacyHeight: oldHeight,
    spawn: position(map.spawn),
    tiles: tiles.map(row => row.join('')),
    zones: map.zones.map(zone => ({ ...zone, rect: rect(zone.rect), encounter: { ...zone.encounter, rate: zone.encounter.rate * encounterScale } })),
    objects
  };
}

function paintRect(tiles, patch) {
  for (let y = patch.y; y < patch.y + patch.height; y += 1) {
    for (let x = patch.x; x < patch.x + patch.width; x += 1) {
      if (x > 0 && x < WIDTH - 1 && y > 0 && y < HEIGHT - 1) tiles[y][x] = patch.tile;
    }
  }
}

function paintTrail(tiles, points) {
  for (let index = 1; index < points.length; index += 1) {
    const [startX, startY] = points[index - 1];
    const [endX, endY] = points[index];
    if (startX !== endX && startY !== endY) throw new Error('Route trails must use straight segments.');
    const distance = Math.max(Math.abs(endX - startX), Math.abs(endY - startY));
    for (let step = 0; step <= distance; step += 1) {
      const x = startX + Math.sign(endX - startX) * step;
      const y = startY + Math.sign(endY - startY) * step;
      if (x > 0 && x < WIDTH - 1 && y > 0 && y < HEIGHT - 1) tiles[y][x] = 'p';
    }
  }
}

export function buildRouteMap(spec, lessons, encounterRate) {
  const tiles = Array.from({ length: HEIGHT }, (_, y) => Array.from({ length: WIDTH }, (_, x) => x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1 ? 't' : 'g'));
  for (const patch of spec.patches) paintRect(tiles, patch);
  for (const trail of spec.trails) paintTrail(tiles, trail);
  const [buildingX, buildingY] = spec.pavilion;
  const [gateX, gateY] = spec.gate;
  const [returnX, returnY] = spec.returnGate;
  return {
    id: spec.id,
    region: spec.region,
    route: true,
    name: spec.name,
    width: WIDTH,
    height: HEIGHT,
    spawn: spec.spawn,
    legend: {
      g: { name: spec.ground, walkable: true, encounter: true, color: spec.colors.ground },
      p: { name: spec.path, walkable: true, encounter: true, color: spec.colors.path },
      f: { name: spec.flower, walkable: true, encounter: true, color: spec.colors.flower },
      t: { name: spec.thicket, walkable: false, color: spec.colors.thicket },
      w: { name: spec.water, walkable: false, color: spec.colors.water }
    },
    tiles: tiles.map(row => row.join('')),
    zones: spec.zones.map((zone, slot) => ({
      id: zone.id,
      name: zone.name,
      lessonSlot: slot,
      lesson: lessons[slot] ?? lessons.at(-1),
      tint: zone.tint,
      rect: { x: slot === 0 ? 1 : slot === 1 ? 16 : 30, y: 1, width: slot === 0 ? 15 : slot === 1 ? 14 : 13, height: 30 },
      encounter: { rate: spec.encounterRate ?? encounterRate ?? .05, cooldown: 3, types: zone.types }
    })),
    objects: [
      { id: 'boss-pavilion-building', type: 'building', name: spec.pavilionName, rect: { x: buildingX, y: buildingY, width: 5, height: 4 }, door: { x: buildingX + 2, y: buildingY + 4 }, solid: true, color: spec.colors.pavilion },
      { id: 'boss-pavilion-door', type: 'door', x: buildingX + 2, y: buildingY + 3, solid: true, interaction: { kind: 'boss', title: spec.pavilionName, lines: [spec.pavilionLine] } },
      { id: 'next-region-gate', type: 'sign', x: gateX, y: gateY, solid: true, interaction: { kind: 'travel', title: `Gate to ${spec.nextTown}`, lines: ['The road continues beyond this gate.'] } },
      { id: 'return-village', type: 'sign', x: returnX, y: returnY, solid: true, interaction: { kind: 'travel', title: spec.returnTown, lines: [`Return to ${spec.returnTown}.`] } }
    ]
  };
}
