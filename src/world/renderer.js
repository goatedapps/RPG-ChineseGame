import { isEncounterTerrain, zoneAt } from './encounters.js?p17';
import { CREATURES } from '../battle/creatures.js';
import { routeKey } from '../systems/regions.js';
import { objectOccupies } from './map.js';

const TILE = 32;

export function buildingEntrancePaths(map) {
  const paths = new Set();
  if (!map.safeTown && !map.atlasVillage && !map.route) return paths;
  const pathTile = map.legend.p ? 'p' : 'b';
  const key = (x, y) => y * map.width + x;
  const obstacles = map.objects.filter(object => object.solid && object.type !== 'npc');
  const walkable = new Set();
  const existing = new Set();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!map.legend[map.tiles[y][x]]?.walkable || obstacles.some(object => objectOccupies(object, x, y))) continue;
      walkable.add(key(x, y));
      if (map.tiles[y][x] === pathTile) existing.add(key(x, y));
    }
  }
  const neighbours = cell => {
    const x = cell % map.width;
    const y = Math.floor(cell / map.width);
    return [[x, y + 1], [x - 1, y], [x + 1, y], [x, y - 1]]
      .filter(([nx, ny]) => nx >= 0 && nx < map.width && ny >= 0 && ny < map.height)
      .map(([nx, ny]) => key(nx, ny)).filter(next => walkable.has(next));
  };
  // Join the main trail, rather than an isolated path tile beneath a pavilion's steps.
  let connected = new Set();
  const remaining = new Set(existing);
  for (const start of remaining) {
    const component = [start];
    remaining.delete(start);
    for (let index = 0; index < component.length; index += 1) {
      for (const next of neighbours(component[index])) {
        if (!remaining.delete(next)) continue;
        component.push(next);
      }
    }
    if (component.length > connected.size) connected = new Set(component);
  }
  if (!connected.size) return paths;
  for (const building of map.objects.filter(object => object.type === 'building' && object.door)) {
    const start = key(building.door.x, building.door.y);
    if (!walkable.has(start)) continue;
    const queue = [start];
    const previous = new Map([[start, null]]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      if (connected.has(cell)) {
        for (let step = cell; step !== null; step = previous.get(step)) {
          connected.add(step);
          if (!existing.has(step)) paths.add(step);
        }
        break;
      }
      for (const next of neighbours(cell)) {
        if (previous.has(next)) continue;
        previous.set(next, cell);
        queue.push(next);
      }
    }
  }
  return paths;
}
const BUILDING_ICON = {
  school: 0, inn: 2, 'reading-hall': 1, shop: 3,
  'hawker-centre-building': 3, 'granary-building': 6, 'hill-house-building': 4,
  'rescue-dock-building': 5, 'clock-tower-building': 2, 'workshop-building': 4,
  'theatre-building': 2, 'mirror-stage-building': 5, 'farmhouse-building': 4,
  'harmony-dojo-building': 0, 'dragon-gate-building': 7, 'festival-workshop-building': 4,
  'excavation-lodge-building': 5, 'ghost-archive-building': 6, 'root-library-building': 1,
  'branch-workshop-building': 4, 'final-seal-building': 7, 'water-garden-building': 3,
  'boss-pavilion-building': 6
};
const NPC_ICON = {
  'grandma-wang': 0, 'chef-mei': 1, storyteller: 2, 'mr-lin': 3,
  'hawker-lina': 4, 'courier-wei': 5, 'elder-sun': 0, 'auntie-bao': 7,
  'rice-seller': 6, 'postman-bo': 5, 'ranger-rui': 4, xiaoqiang: 5,
  'ah-dong': 3, 'old-chen': 2, 'little-min': 7, 'gardener-lan': 4,
  'apprentice-jun': 3, 'farmer-tan': 6, 'market-child': 7,
  'field-walker': 4, 'hill-messenger': 5, gatekeeper: 3
};

function npcSpriteIndex(id) {
  if (NPC_ICON[id] !== undefined) return NPC_ICON[id];
  return [...id].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7) % 8;
}

function drawAtlasSprite(context, sheet, index, columns, cellWidth, cellHeight, x, y, width, height) {
  if (!sheet?.complete || !sheet.naturalWidth) return false;
  context.drawImage(sheet, index % columns * cellWidth, Math.floor(index / columns) * cellHeight, cellWidth, cellHeight, x, y, width, height);
  return true;
}

function drawTree(context, x, y) {
  context.fillStyle = 'rgba(20,40,25,.2)';
  context.beginPath();
  context.ellipse(x + 16, y + 27, 12, 4, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#68482d';
  context.fillRect(x + 13, y + 17, 6, 12);
  context.fillStyle = '#2f6a3a';
  context.beginPath();
  context.arc(x + 16, y + 12, 12, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#47894c';
  context.beginPath();
  context.arc(x + 11, y + 9, 6, 0, Math.PI * 2);
  context.fill();
}

function drawBamboo(context, x, y) {
  context.strokeStyle = '#245d3b';
  context.lineWidth = 3;
  for (const [dx, height] of [[9, 22], [16, 27], [23, 19]]) {
    context.beginPath();
    context.moveTo(x + dx, y + 29);
    context.lineTo(x + dx, y + 29 - height);
    context.stroke();
    context.fillStyle = '#58a363';
    context.beginPath();
    context.ellipse(x + dx - 5, y + 17, 8, 3, -.35, 0, Math.PI * 2);
    context.ellipse(x + dx + 5, y + 10, 8, 3, .35, 0, Math.PI * 2);
    context.fill();
  }
}

function drawRock(context, x, y) {
  context.fillStyle = '#647d83';
  context.beginPath();
  context.moveTo(x + 1, y + 29); context.lineTo(x + 8, y + 10); context.lineTo(x + 18, y + 5); context.lineTo(x + 31, y + 29); context.closePath();
  context.fill();
  context.fillStyle = '#9db0aa';
  context.beginPath();
  context.moveTo(x + 8, y + 10); context.lineTo(x + 18, y + 5); context.lineTo(x + 16, y + 18); context.closePath();
  context.fill();
}

function drawWall(context, x, y) {
  context.fillStyle = '#795d50';
  context.fillRect(x + 1, y + 5, 30, 25);
  context.strokeStyle = '#b29a78';
  context.lineWidth = 2;
  for (const line of [12, 21]) { context.beginPath(); context.moveTo(x + 2, y + line); context.lineTo(x + 30, y + line); context.stroke(); }
  context.beginPath(); context.moveTo(x + 15, y + 5); context.lineTo(x + 15, y + 12); context.moveTo(x + 8, y + 12); context.lineTo(x + 8, y + 21); context.moveTo(x + 23, y + 21); context.lineTo(x + 23, y + 30); context.stroke();
}

function drawAtlasTileDetail(context, map, tile, x, y, column, row, regionId) {
  const seed = (column * 37 + row * 19) % 17;
  const paved = ['p', 'b', 'q', 's', 'l', 'd'].includes(tile);
  if (map.legend[tile].walkable && !paved) {
    context.fillStyle = seed % 2 ? '#e0e8a543' : '#245b3940';
    context.beginPath();
    context.ellipse(x + 8 + seed % 13, y + 9 + seed % 15, 7, 3, -.25, 0, Math.PI * 2);
    context.fill();
    if ((seed + row) % 7 === 0 || tile === 'f' || tile === 'a') {
      context.fillStyle = tile === 'f' ? '#f8e08e' : '#fbf2c2';
      context.beginPath();
      context.arc(x + 10 + seed % 12, y + 11 + seed % 12, 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = tile === 'f' ? '#cf6580' : '#efa83c';
      context.beginPath();
      context.arc(x + 10 + seed % 12, y + 11 + seed % 12, 1, 0, Math.PI * 2);
      context.fill();
    }
  }
  if (paved) {
    context.fillStyle = 'rgba(255,242,205,.19)';
    context.fillRect(x + 3 + seed % 6, y + 5, 17, 8);
    context.fillRect(x + 11 - seed % 5, y + 19, 18, 7);
  }
  if (tile === 'r' && regionId === 'r2') {
    context.strokeStyle = '#efd365';
    context.lineWidth = 2;
    for (let stalk = 0; stalk < 3; stalk += 1) {
      const sx = x + 6 + stalk * 9;
      context.beginPath();
      context.moveTo(sx, y + 25);
      context.quadraticCurveTo(sx - 3, y + 16, sx + 2, y + 10);
      context.stroke();
    }
  }
}

function drawTile(context, map, tile, x, y, column, row, tick, atlasRegion) {
  const definition = map.legend[tile];
  const villageGround = map.legend.g?.color || map.legend.s?.color || map.legend.f?.color || definition.color;
  context.fillStyle = atlasRegion && tile === 't' ? villageGround : definition.color;
  context.fillRect(Math.floor(x), Math.floor(y), TILE + 1, TILE + 1);
  if (atlasRegion) drawAtlasTileDetail(context, map, tile, x, y, column, row, atlasRegion);
  if (!map.safeTown && map.legend[tile]?.encounter) {
    const hash = (column * 17 + row * 23) % 31;
    context.fillStyle = tile === 'f' ? (hash % 2 ? '#f1c34f' : '#efa2ae') : 'rgba(255,255,255,.16)';
    context.beginPath();
    context.arc(x + 7 + hash % 18, y + 8 + hash % 13, tile === 'f' ? 3 : 2, 0, Math.PI * 2);
    context.fill();
    const zone = zoneAt(map, column, row);
    if (zone && isEncounterTerrain(map, column, row)) {
      context.fillStyle = `${zone.tint}b8`;
      for (let blade = 0; blade < 4; blade += 1) {
        const bx = x + 4 + ((column * 11 + row * 7 + blade * 8) % 25);
        const by = y + 19 + ((column + blade * 3) % 8);
        context.beginPath();
        context.moveTo(bx, by + 8);
        context.quadraticCurveTo(bx - 3, by, bx - 1, by - 7);
        context.quadraticCurveTo(bx + 4, by, bx + 2, by + 8);
        context.fill();
      }
    }
  }
  if (tile === 'r') {
    context.strokeStyle = 'rgba(82,105,38,.55)';
    context.lineWidth = 2;
    for (let line = 6; line < 32; line += 9) {
      context.beginPath(); context.moveTo(x, y + line); context.lineTo(x + 32, y + line); context.stroke();
    }
  }
  if (tile === 'h') {
    context.fillStyle = 'rgba(50,66,42,.2)';
    context.beginPath(); context.arc(x + 7 + (column * 9 % 18), y + 21, 4, 0, Math.PI * 2); context.fill();
  }
  if (tile === 'p') {
    context.fillStyle = 'rgba(105,76,34,.16)';
    context.fillRect(x + 5 + (column * 7 + row * 3) % 19, y + 8 + (row * 5) % 14, 4, 3);
  }
  if (tile === 't') {
    if (atlasRegion === 'r2') drawBamboo(context, x, y);
    else if (atlasRegion === 'r3') drawRock(context, x, y);
    else if (atlasRegion === 'r5') drawWall(context, x, y);
    else drawTree(context, x, y);
  }
  if (tile === 'w') {
    context.strokeStyle = 'rgba(255,255,255,.5)';
    context.lineWidth = 2;
    const wave = (tick / 8 + column * 3 + row) % 18;
    context.beginPath();
    context.moveTo(x + 4, y + 6 + wave);
    context.lineTo(x + 17, y + 6 + wave);
    context.stroke();
  }
}

function drawAtlasBuilding(context, object, left, top, pixelWidth, pixelHeight, doorX) {
  const bottom = top + pixelHeight;
  const right = left + pixelWidth;
  context.fillStyle = 'rgba(32,57,41,.22)';
  context.beginPath();
  context.ellipse(left + pixelWidth / 2, bottom - 2, pixelWidth * .53, 14, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#705a40';
  context.fillRect(left + 6, top + 31, pixelWidth - 12, pixelHeight - 28);
  context.fillStyle = '#f0dfb7';
  context.fillRect(left + 11, top + 35, pixelWidth - 22, pixelHeight - 40);
  context.fillStyle = '#fff1d2';
  context.fillRect(left + 16, top + 39, pixelWidth - 32, pixelHeight - 53);
  context.fillStyle = '#795b3c';
  for (const post of [left + 11, right - 16]) context.fillRect(post, top + 38, 5, pixelHeight - 43);
  context.fillRect(left + 10, bottom - 18, pixelWidth - 20, 5);

  context.save();
  context.beginPath();
  context.moveTo(left - 6, top + 39);
  context.quadraticCurveTo(left + 13, top + 20, left + 18, top + 9);
  context.lineTo(right - 18, top + 9);
  context.quadraticCurveTo(right - 13, top + 20, right + 6, top + 39);
  context.closePath();
  context.fillStyle = object.color;
  context.fill();
  context.clip();
  context.strokeStyle = 'rgba(255,245,216,.34)';
  context.lineWidth = 2;
  for (let roofY = top + 15; roofY < top + 41; roofY += 8) {
    context.beginPath();
    context.moveTo(left - 4, roofY);
    context.lineTo(right + 4, roofY);
    context.stroke();
  }
  context.strokeStyle = 'rgba(23,39,42,.26)';
  context.lineWidth = 1;
  for (let roofX = left + 9; roofX < right; roofX += 16) {
    context.beginPath();
    context.moveTo(roofX, top + 12);
    context.lineTo(roofX - 8, top + 41);
    context.stroke();
  }
  context.restore();
  context.strokeStyle = '#4a3d39';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(left - 8, top + 38);
  context.quadraticCurveTo(left + 10, top + 43, left + 21, top + 35);
  context.lineTo(right - 21, top + 35);
  context.quadraticCurveTo(right - 10, top + 43, right + 8, top + 38);
  context.stroke();

  for (const windowX of [left + 29, right - 53]) {
    context.fillStyle = '#614936';
    context.fillRect(windowX, top + 58, 24, 26);
    context.fillStyle = '#a7c4ad';
    context.fillRect(windowX + 3, top + 61, 18, 20);
    context.strokeStyle = '#79563a';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(windowX + 12, top + 60);
    context.lineTo(windowX + 12, top + 82);
    context.moveTo(windowX + 2, top + 71);
    context.lineTo(windowX + 22, top + 71);
    context.stroke();
  }

  context.fillStyle = '#513628';
  context.fillRect(doorX + 4, bottom - 43, 24, 39);
  context.fillStyle = '#8c6543';
  context.fillRect(doorX + 8, bottom - 39, 16, 35);
  context.fillStyle = '#e4b968';
  context.beginPath();
  context.arc(doorX + 21, bottom - 20, 1.8, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b7a085';
  context.fillRect(doorX - 3, bottom - 4, 38, 5);
  context.fillStyle = '#ded0af';
  context.fillRect(doorX - 8, bottom + 1, 48, 4);

  for (const lanternX of [left + 16, right - 23]) {
    context.fillStyle = '#e3b65a';
    context.fillRect(lanternX + 2, top + 44, 3, 6);
    context.fillStyle = '#d05a3a';
    context.fillRect(lanternX, top + 50, 8, 11);
    context.fillStyle = '#f8d684';
    context.fillRect(lanternX + 2, top + 52, 4, 7);
  }
}

function drawBuilding(context, object, offsetX, offsetY, atlasRegion, art) {
  const { x, y, width, height } = object.rect;
  const left = x * TILE - offsetX;
  const top = y * TILE - offsetY;
  const pixelWidth = width * TILE;
  const pixelHeight = height * TILE;
  const doorX = object.door.x * TILE - offsetX;
  const spriteIndex = BUILDING_ICON[object.id] ?? 4;
  const illustrated = atlasRegion && drawAtlasSprite(context, art?.buildings, spriteIndex, 4, 256, 256, left - 4, top - 31, pixelWidth + 8, pixelHeight + 43);
  if (atlasRegion && !illustrated) drawAtlasBuilding(context, object, left, top, pixelWidth, pixelHeight, doorX);
  else if (!atlasRegion) {
    context.fillStyle = '#eadfc5';
    context.fillRect(left + 5, top + 24, pixelWidth - 10, pixelHeight - 24);
    context.fillStyle = object.color;
    context.beginPath();
    context.moveTo(left - 5, top + 31);
    context.quadraticCurveTo(left + 12, top + 20, left + 18, top + 5);
    context.lineTo(left + pixelWidth - 18, top + 5);
    context.quadraticCurveTo(left + pixelWidth - 12, top + 20, left + pixelWidth + 5, top + 31);
    context.closePath();
    context.fill();
    context.fillStyle = '#674127';
    context.fillRect(doorX + 7, top + pixelHeight - 27, 18, 27);
  }
  context.font = atlasRegion ? '800 15px Georgia, serif' : '700 14px system-ui';
  const maxTextWidth = Math.max(70, pixelWidth - (atlasRegion ? 48 : 28));
  const lines = [''];
  for (const word of object.name.split(' ')) {
    const current = lines.at(-1);
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxTextWidth) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  const labelWidth = Math.min(pixelWidth - 8, Math.ceil(Math.max(...lines.map(line => context.measureText(line).width))) + (atlasRegion ? 42 : 18));
  const labelHeight = lines.length * 19 + (atlasRegion ? 12 : 8);
  const labelX = left + (pixelWidth - labelWidth) / 2;
  const labelY = top + (atlasRegion ? 8 : 30);
  context.fillStyle = atlasRegion ? '#163a45' : '#1b2430';
  context.strokeStyle = atlasRegion ? '#e4be74' : '#1b2430';
  context.lineWidth = atlasRegion ? 3 : 1;
  context.fillRect(labelX, labelY, labelWidth, labelHeight);
  if (atlasRegion) {
    context.strokeRect(labelX, labelY, labelWidth, labelHeight);
    context.strokeStyle = '#2a5f62';
    context.lineWidth = 1;
    context.strokeRect(labelX + 4, labelY + 4, labelWidth - 8, labelHeight - 8);
    context.fillStyle = '#e4be74';
    for (const dotX of [labelX + 11, labelX + labelWidth - 11]) {
      context.beginPath();
      context.arc(dotX, labelY + labelHeight / 2, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.fillStyle = atlasRegion ? '#fff8df' : '#f0c95a';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) => context.fillText(line, left + pixelWidth / 2, labelY + (labelHeight - lines.length * 19) / 2 + 9.5 + index * 19, maxTextWidth));
}

function drawLandmark(context, object, offsetX, offsetY) {
  const { x, y, width, height } = object.rect;
  const left = x * TILE - offsetX;
  const top = y * TILE - offsetY;
  const cx = left + width * TILE / 2;
  const base = top + height * TILE;
  context.fillStyle = 'rgba(32,55,52,.3)';
  context.beginPath(); context.ellipse(cx, base - 5, width * TILE * .47, 21, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#70533c';
  context.beginPath();
  context.moveTo(cx - 35, base - 5);
  context.lineTo(cx - 25, top + 72);
  context.lineTo(cx - 61, top + 41);
  context.lineTo(cx - 45, top + 35);
  context.lineTo(cx, top + 74);
  context.lineTo(cx + 44, top + 35);
  context.lineTo(cx + 61, top + 41);
  context.lineTo(cx + 25, top + 72);
  context.lineTo(cx + 35, base - 5);
  context.closePath(); context.fill();
  context.fillStyle = '#3d786c';
  for (const [dx, dy, radius] of [[-75, 64, 49], [-34, 37, 57], [26, 36, 58], [76, 65, 47], [0, 21, 54]]) {
    context.beginPath(); context.arc(cx + dx, top + dy, radius, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = '#7bb59c';
  for (const [dx, dy, radius] of [[-56, 30, 19], [0, 9, 25], [51, 34, 21]]) {
    context.beginPath(); context.arc(cx + dx, top + dy, radius, 0, Math.PI * 2); context.fill();
  }
  context.fillStyle = '#f2d383';
  for (const [dx, dy] of [[-67, 56], [-26, 28], [18, 41], [64, 65], [3, 93]]) {
    context.beginPath(); context.arc(cx + dx, top + dy, 3, 0, Math.PI * 2); context.fill();
  }
}

function drawPortal(context, object, offsetX, offsetY, tick) {
  const x = object.x * TILE - offsetX + 16;
  const y = object.y * TILE - offsetY + 17;
  context.save();
  context.fillStyle = '#163b46aa';
  context.beginPath();
  context.ellipse(x, y + 13, 17, 6, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = '#f6d874';
  context.shadowBlur = 8 + Math.sin(tick / 12) * 3;
  context.strokeStyle = '#e6bd66';
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(x, y - 2, 12, 17, 0, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = '#66beb8b8';
  context.beginPath();
  context.ellipse(x, y - 2, 8, 13, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPerson(context, x, y, color, direction = 'down', isPlayer = false, equipment = {}) {
  context.fillStyle = 'rgba(15,25,30,.22)';
  context.beginPath();
  context.ellipse(x + 16, y + 29, 9, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.fillRect(x + 9, y + 15, 14, 12);
  context.fillStyle = '#29241f';
  context.fillRect(x + 10, y + 26, 4, 4);
  context.fillRect(x + 18, y + 26, 4, 4);
  context.fillStyle = '#f2cfa6';
  context.beginPath();
  context.arc(x + 16, y + 10, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = isPlayer ? '#273445' : '#382a20';
  context.beginPath();
  context.arc(x + 16, y + 7, 7, Math.PI, 0);
  context.fill();
  if (direction !== 'up') {
    const glance = direction === 'left' ? -2 : direction === 'right' ? 2 : 0;
    context.fillStyle = '#1b2430';
    context.fillRect(x + 12 + glance, y + 10, 2, 2);
    context.fillRect(x + 18 + glance, y + 10, 2, 2);
  }
  if (isPlayer && equipment.hat) {
    context.fillStyle = equipment.hat === 'gold-crown' ? '#e2b23c' : equipment.hat === 'red-cap' ? '#c63f2b' : '#c9a45c';
    context.fillRect(x + 8, y + 2, 16, 5);
  }
  if (isPlayer && equipment.brush) {
    context.strokeStyle = equipment.brush === 'jade-brush' ? '#2f8a66' : '#6e492d';
    context.lineWidth = 3;
    context.beginPath(); context.moveTo(x + 23, y + 17); context.lineTo(x + 28, y + 28); context.stroke();
  }
}

function drawHero(context, x, y, direction = 'down', equipment = {}) {
  context.fillStyle = 'rgba(15,25,30,.28)';
  context.beginPath();
  context.ellipse(x + 16, y + 29, 11, 4, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#f4efe2';
  context.lineWidth = 2;
  context.fillStyle = '#263f70';
  context.beginPath();
  context.moveTo(x + 8, y + 15);
  context.lineTo(x + 24, y + 15);
  context.lineTo(x + 27, y + 29);
  context.lineTo(x + 5, y + 29);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = '#e2b23c';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(x + 10, y + 16);
  context.lineTo(x + 22, y + 27);
  context.stroke();

  context.fillStyle = '#f2cfa6';
  context.beginPath();
  context.arc(x + 16, y + 10, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#172a4b';
  context.beginPath();
  context.arc(x + 16, y + 7, 7, Math.PI, 0);
  context.fill();
  context.fillStyle = '#c63f2b';
  context.fillRect(x + 8, y + 5, 16, 3);

  if (direction !== 'up') {
    const glance = direction === 'left' ? -2 : direction === 'right' ? 2 : 0;
    context.fillStyle = '#1b2430';
    context.fillRect(x + 12 + glance, y + 10, 2, 2);
    context.fillRect(x + 18 + glance, y + 10, 2, 2);
  }

  context.strokeStyle = equipment.brush === 'jade-brush' ? '#2f8a66' : '#6e492d';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x + 25, y + 13);
  context.lineTo(x + 29, y + 28);
  context.stroke();
  context.fillStyle = '#1b2430';
  context.beginPath();
  context.moveTo(x + 27, y + 27);
  context.lineTo(x + 31, y + 30);
  context.lineTo(x + 28, y + 22);
  context.fill();

  if (equipment.hat) {
    context.fillStyle = equipment.hat === 'gold-crown' ? '#e2b23c' : equipment.hat === 'red-cap' ? '#c63f2b' : '#c9a45c';
    context.fillRect(x + 8, y + 1, 16, 5);
  }
}

function drawCampfire(context, x, y) {
  context.strokeStyle = '#68482d'; context.lineWidth = 4;
  context.beginPath(); context.moveTo(x + 8, y + 27); context.lineTo(x + 25, y + 21); context.moveTo(x + 8, y + 21); context.lineTo(x + 25, y + 27); context.stroke();
  context.fillStyle = '#f29b32'; context.beginPath(); context.arc(x + 16, y + 17, 8, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#f5d34f'; context.beginPath(); context.arc(x + 16, y + 19, 4, 0, Math.PI * 2); context.fill();
}

function drawSign(context, x, y) {
  context.fillStyle = '#69482c';
  context.fillRect(x + 14, y + 15, 4, 15);
  context.fillStyle = '#d3ad62';
  context.fillRect(x + 4, y + 5, 24, 14);
  context.fillStyle = '#78552e';
  context.fillRect(x + 8, y + 10, 16, 2);
  context.fillRect(x + 8, y + 14, 12, 2);
}

function drawScroll(context, x, y) {
  context.fillStyle = '#f4efe2';
  context.strokeStyle = '#c63f2b';
  context.lineWidth = 2;
  context.fillRect(x + 7, y + 9, 18, 14);
  context.strokeRect(x + 7, y + 9, 18, 14);
  context.fillStyle = '#e2b23c';
  context.fillRect(x + 4, y + 7, 5, 18);
  context.fillRect(x + 23, y + 7, 5, 18);
}

export function createRenderer(canvas, map) {
  const context = canvas.getContext('2d');
  const atlasRegion = map.atlasVillage || map.safeTown ? map.region : null;
  const illustratedStructures = Boolean(map.atlasVillage || map.safeTown || map.route);
  const entrancePaths = buildingEntrancePaths(map);
  const pathTile = map.legend.p ? 'p' : 'b';
  let disposed = false;
  let lastState = null;
  const art = {};
  const companionArt = new Map();
  if (globalThis.Image) {
    for (const [kind, file] of [...(illustratedStructures ? [['buildings', 'buildings.webp']] : []), ['villagers', 'villagers-full-body.webp'], ['hero', 'hero-map.webp']]) {
      const image = new Image();
      image.onload = () => { if (!disposed && lastState) render(lastState); };
      image.src = new URL(`../../assets/images/atlas/${file}`, import.meta.url).href;
      art[kind] = image;
    }
  }
  let tick = 0;
  function offsets(player) {
    const playerPx = player.x * TILE;
    const playerPy = player.y * TILE;
    return {
      x: Math.round(Math.max(0, Math.min(map.width * TILE - canvas.width, playerPx - canvas.width / 2 + TILE / 2))),
      y: Math.round(Math.max(0, Math.min(map.height * TILE - canvas.height, playerPy - canvas.height / 2 + TILE / 2)))
    };
  }
  function tileAtClientPoint(clientX, clientY, player) {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || clientX < bounds.left || clientX >= bounds.right || clientY < bounds.top || clientY >= bounds.bottom) return null;
    const offset = offsets(player);
    return {
      x: Math.floor((offset.x + (clientX - bounds.left) * canvas.width / bounds.width) / TILE),
      y: Math.floor((offset.y + (clientY - bounds.top) * canvas.height / bounds.height) / TILE)
    };
  }
  function render(state) {
    lastState = state;
    tick += 1;
    const viewWidth = canvas.width;
    const viewHeight = canvas.height;
    const playerPx = state.player.x * TILE;
    const playerPy = state.player.y * TILE;
    const { x: offsetX, y: offsetY } = offsets(state.player);
    const firstColumn = Math.floor(offsetX / TILE);
    const firstRow = Math.floor(offsetY / TILE);
    const lastColumn = Math.min(map.width - 1, Math.ceil((offsetX + viewWidth) / TILE));
    const lastRow = Math.min(map.height - 1, Math.ceil((offsetY + viewHeight) / TILE));

    context.clearRect(0, 0, viewWidth, viewHeight);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const tile = entrancePaths.has(row * map.width + column) ? pathTile : map.tiles[row][column];
        drawTile(context, map, tile, column * TILE - offsetX, row * TILE - offsetY, column, row, tick, atlasRegion);
      }
    }

    for (const object of map.objects.filter(object => object.type === 'landmark')) drawLandmark(context, object, offsetX, offsetY);
    for (const object of map.objects.filter(object => object.type === 'building')) drawBuilding(context, object, offsetX, offsetY, illustratedStructures, art);
    for (const object of map.objects.filter(object => object.type === 'portal')) drawPortal(context, object, offsetX, offsetY, tick);
    const entities = map.objects.filter(object => object.type === 'npc' || object.type === 'sign')
      .map(object => ({ ...object, sortY: object.y }))
      .concat({ type: 'player', x: state.player.x, y: state.player.y, sortY: state.player.y })
      .sort((a, b) => a.sortY - b.sortY);
    for (const entity of entities) {
      const x = entity.x * TILE - offsetX;
      const y = entity.y * TILE - offsetY;
      if (entity.type === 'sign') {
        if (!['next-region-gate', 'route-entrance', 'return-village'].includes(entity.id) || !drawAtlasSprite(context, art.buildings, 7, 4, 256, 256, x - 15, y - 36, 62, 68)) drawSign(context, x, y);
      }
      else if (entity.type === 'npc') {
        const index = npcSpriteIndex(entity.id);
        if (!drawAtlasSprite(context, art.villagers, index, 4, 192, 256, x - 8, y - 18, 48, 56)) drawPerson(context, x, y, entity.color, entity.direction || 'down');
        const questionIndex = (map.passageVillagers || []).indexOf(entity.id);
        const reading = state.progress?.reading;
        if (reading?.active && questionIndex >= 0 && questionIndex < reading.questionCount && reading.results?.[questionIndex]?.correct !== true) {
          const bob = Math.sin(tick / 6) * 2;
          context.fillStyle = '#fff'; context.strokeStyle = '#1b2430'; context.lineWidth = 2;
          context.beginPath(); context.arc(x + 16, y - 5 + bob, 9, 0, Math.PI * 2); context.fill(); context.stroke();
          context.fillStyle = '#c63f2b'; context.font = '900 14px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('?', x + 16, y - 4 + bob);
        }
      }
      else if (!drawAtlasSprite(context, art.hero, 0, 1, 256, 384, x - 8, y - 21, 48, 60)) drawHero(context, x, y, state.player.direction, state.progress?.equipment?.equipped);
    }
    if (state.progress?.sets?.campfire) drawCampfire(context, 20 * TILE - offsetX, 16 * TILE - offsetY);
    const scroll = state.progress?.scrolls;
    if (scroll?.spot && !scroll.found) drawScroll(context, scroll.spot.x * TILE - offsetX, scroll.spot.y * TILE - offsetY);
    if (state.progress?.story?.flags?.hiddenGrove) {
      context.fillStyle = 'rgba(244,211,79,.5)';
      context.beginPath(); context.arc(4 * TILE - offsetX, 8 * TILE - offsetY, 24, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f4efe2'; context.font = '700 11px system-ui'; context.fillText('Hidden Grove', 4 * TILE - offsetX, 8 * TILE - offsetY);
    }
    const companion = state.progress?.creatures?.partner;
    if (companion && CREATURES.some(creature => creature.id === companion)) {
      if (!companionArt.has(companion) && typeof Image !== 'undefined') {
        const image = new Image();
        image.src = new URL(`../../assets/images/creatures/${companion}.webp`, import.meta.url).href;
        companionArt.set(companion, image);
      }
      const image = companionArt.get(companion);
      if (image?.complete && image.naturalWidth) {
        context.drawImage(image, playerPx - offsetX - 35, playerPy - offsetY + 3, 36, 36);
      }
    }
    if (map.route) {
      const discovered = new Set(state.progress?.routes?.[routeKey(map.region)]?.discovered || []);
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          if (discovered.has(row * map.width + column)) continue;
          const x = column * TILE - offsetX;
          const y = row * TILE - offsetY;
          const distance = Math.abs(column - state.player.x) + Math.abs(row - state.player.y);
          context.fillStyle = distance <= 2 ? '#102c3b80' : '#102c3bf5';
          context.fillRect(x, y, TILE + 1, TILE + 1);
          context.fillStyle = '#d5e8db16';
          context.beginPath();
          context.arc(x + 8 + (column * 7 + row * 3) % 18, y + 10 + (row * 5) % 12, 7, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    if (state.guidePin && (state.guidePin.x !== state.player.x || state.guidePin.y !== state.player.y)) {
      const x = state.guidePin.x * TILE + TILE / 2 - offsetX;
      const y = state.guidePin.y * TILE - offsetY;
      context.save();
      context.fillStyle = '#a63129';
      context.strokeStyle = '#fff4d5';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y - 12, 11, Math.PI * .75, Math.PI * 2.25);
      context.lineTo(x, y + 9);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#fff4d5';
      context.beginPath();
      context.arc(x, y - 12, 3.3, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  return { render, tileAtClientPoint, dispose() { disposed = true; } };
}

export { TILE };
