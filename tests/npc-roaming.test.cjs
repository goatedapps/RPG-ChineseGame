const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mapDirectory = 'content/authored/campaign/maps';

test('every village has several villagers who roam without blocking each other', async () => {
  const { wanderNpcs, restoreNpcPositions } = await import('../src/world/npcs.js');
  const { tileAt, objectOccupies, validateMap } = await import('../src/world/map.js');
  const files = fs.readdirSync(mapDirectory).filter(file => /^r[1-7]-.*\.json$/.test(file));
  assert.equal(files.length, 7);

  for (const file of files) {
    const map = JSON.parse(fs.readFileSync(path.join(mapDirectory, file), 'utf8'));
    assert.deepEqual(validateMap(map), [], file);
    const roamers = map.objects.filter(object => object.type === 'npc' && object.wander);
    assert.ok(roamers.length >= 5, `${file} needs more roaming villagers`);
    const homes = new Map(roamers.map(npc => [npc.id, { x: npc.x, y: npc.y }]));
    const visited = new Map(roamers.map(npc => [npc.id, new Set([`${npc.x},${npc.y}`])]));

    for (let tick = 0; tick < 24; tick += 1) {
      wanderNpcs(map, map.spawn, {}, () => (tick % 4) / 5);
      for (const npc of roamers) {
        const home = homes.get(npc.id);
        const tile = tileAt(map, npc.x, npc.y);
        assert.ok(tile && map.legend[tile]?.walkable !== false, `${file}: ${npc.id} entered a blocked tile`);
        assert.ok(Math.abs(npc.x - home.x) + Math.abs(npc.y - home.y) <= 4, `${file}: ${npc.id} wandered too far`);
        assert.notDeepEqual({ x: npc.x, y: npc.y }, map.spawn, `${file}: ${npc.id} entered the player tile`);
        assert.ok(!map.objects.some(other => other !== npc && other.solid && objectOccupies(other, npc.x, npc.y)), `${file}: ${npc.id} overlapped a solid object`);
        visited.get(npc.id).add(`${npc.x},${npc.y}`);
      }
    }
    for (const npc of roamers) assert.ok(visited.get(npc.id).size > 1, `${file}: ${npc.id} never moved`);

    const first = roamers[0];
    const home = homes.get(first.id);
    first.x = home.x;
    first.y = home.y;
    restoreNpcPositions(map, { [first.id]: { x: home.x + 10, y: home.y } });
    assert.deepEqual({ x: first.x, y: first.y }, home, `${file}: invalid saved position restored`);
  }
});
