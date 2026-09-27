const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));

test('later villages share illustrated buildings and safe-town terrain rendering', () => {
  const renderer = fs.readFileSync('src/world/renderer.js', 'utf8');
  assert.match(renderer, /const atlasRegion = map\.safeTown \? map\.region : null/);
  assert.match(renderer, /!map\.safeTown && map\.legend\[tile\]\?\.encounter/);
  for (const id of ['rescue-dock-building', 'theatre-building', 'dragon-gate-building', 'excavation-lodge-building', 'final-seal-building']) {
    assert.ok(renderer.includes(`'${id}'`), `${id} needs a suitable reusable building sprite`);
  }
});

test('village wayfinding points to actual inter-town routes instead of old battle zones', () => {
  const routes = read('content/authored/campaign/routes.json');
  const names = ['r2-harvest-crossing', 'r3-tidewater-bay', 'r4-lantern-theatre', 'r5-festival-city', 'r6-ancient-grove'];
  for (const [index, name] of names.entries()) {
    const map = read(`content/authored/campaign/maps/${name}.json`);
    const signs = map.objects.filter(object => object.type === 'sign').flatMap(object => object.interaction?.lines || []).join(' ');
    const guide = map.objects.find(object => object.id === (index === 0 ? 'ranger-rui' : ['harbour-guide', 'field-guide', 'parade-guide', 'grove-guide'][index - 1]));
    assert.ok(signs.includes(routes[index].name), `${name} should name its battlefield route`);
    assert.ok(signs.includes(routes[index].zones[0].name), `${name} should name its first route segment`);
    assert.ok(signs.includes(routes[index].pavilionName), `${name} should direct players to its boss pavilion`);
    assert.ok(guide.interaction.lines.join(' ').includes(routes[index].zones[0].name));
  }
  const summit = read('content/authored/campaign/maps/r7-treehouse-summit.json');
  assert.ok(summit.objects.find(object => object.id === 'summit-guide').interaction.lines.join(' ').includes('safe'));
});

test('Parent Mode keeps its scroll and confirms changes inside the panel', () => {
  const source = fs.readFileSync('src/gameplay.js', 'utf8');
  const styles = fs.readFileSync('css/stage.css', 'utf8');
  assert.match(source, /previousPosition = keepPosition \? document\.querySelector\('\.parent-tab-content'\)\?\.scrollTop/);
  assert.match(source, /document\.querySelector\('\.parent-tab-content'\)\.scrollTop = previousPosition/);
  assert.match(source, /data-parent-change role="status"/);
  assert.match(source, /Hero set to Level/);
  assert.match(source, /Spirit card\$\{gifted\.gifted\.length/);
  assert.match(styles, /\.parent-tab-content \{[^}]*overflow: auto/);
});
