const WIDTH = 44;
const HEIGHT = 32;

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
