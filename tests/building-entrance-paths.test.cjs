const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('all village buildings and expanded boss pavilions have visual paths to their entrances without changing gameplay maps', async () => {
  const { buildingEntrancePaths } = await import('../src/world/renderer.js');
  const { isWalkable } = await import('../src/world/map.js');
  const { buildRouteMap, expandRouteMap } = await import('../src/world/routeMaps.js');
  const folder = 'content/authored/campaign/maps/';
  const maps = fs.readdirSync(folder).filter(file => file !== 'r1-r2-mistwood.json')
    .map(file => ({ ...read(folder + file), safeTown: true }));
  maps.push(expandRouteMap({ ...read(folder + 'r1-r2-mistwood.json'), route: true }));
  maps.push(...read('content/authored/campaign/routes.json').map(spec => expandRouteMap(buildRouteMap(spec, [1, 2, 3]))));
  assert.equal(maps.length, 14);
  for (const map of maps) {
    const before = JSON.stringify(map);
    const paths = buildingEntrancePaths(map);
    assert.equal(JSON.stringify(map), before, `${map.id}: visual paths must not mutate terrain, encounters or objects`);
    const key = (x, y) => y * map.width + x;
    for (const cell of paths) {
      assert.ok(isWalkable(map, cell % map.width, Math.floor(cell / map.width)), `${map.id}: path must avoid obstacles`);
    }
    const pathTile = map.legend.p ? 'p' : 'b';
    const paved = (x, y) => isWalkable(map, x, y) && (map.tiles[y][x] === pathTile || paths.has(key(x, y)));
    const components = new Map();
    let largest = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!paved(x, y) || components.has(key(x, y))) continue;
        const cells = [[x, y]];
        const id = key(x, y);
        components.set(id, id);
        for (let index = 0; index < cells.length; index += 1) {
          const [cx, cy] = cells[index];
          for (const [nx, ny] of [[cx, cy + 1], [cx - 1, cy], [cx + 1, cy], [cx, cy - 1]]) {
            if (!paved(nx, ny) || components.has(key(nx, ny))) continue;
            components.set(key(nx, ny), id);
            cells.push([nx, ny]);
          }
        }
        if (cells.length > largest.length) largest = cells;
      }
    }
    const mainPath = components.get(key(...largest[0]));
    for (const building of map.objects.filter(object => object.type === 'building')) {
      assert.equal(components.get(key(building.door.x, building.door.y)), mainPath, `${map.id}: ${building.name} entrance must join the main path`);
    }
  }
});

test('renderer paints entrance branches with the existing brown path treatment', async () => {
  const { createRenderer } = await import('../src/world/renderer.js');
  const map = { ...read('content/authored/campaign/maps/r1-hub.json'), safeTown: true };
  const before = JSON.stringify(map);
  const rectangles = [];
  const context = new Proxy({}, {
    get(target, name) {
      if (name === 'measureText') return text => ({ width: text.length * 8 });
      if (name === 'fillRect') return (...args) => rectangles.push({ color: target.fillStyle, args });
      return target[name] ?? (() => {});
    },
    set(target, name, value) { target[name] = value; return true; }
  });
  const renderer = createRenderer({ width: map.width * 32, height: map.height * 32, getContext: () => context }, map);
  renderer.render({ player: map.spawn, progress: {} });
  for (const building of map.objects.filter(object => object.type === 'building')) {
    assert.ok(rectangles.some(({ color, args }) => color === map.legend.p.color
      && args[0] === building.door.x * 32 && args[1] === building.door.y * 32
      && args[2] === 33 && args[3] === 33), `${building.name}: entrance should show the brown path`);
  }
  assert.equal(JSON.stringify(map), before);
  renderer.dispose();
});
