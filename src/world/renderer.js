import { zoneAt } from './encounters.js?p10d';

const TILE = 32;

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

function drawTile(context, map, tile, x, y, column, row, tick) {
  const definition = map.legend[tile];
  context.fillStyle = definition.color;
  context.fillRect(x, y, TILE, TILE);
  if (tile === 'g' || tile === 'f') {
    const hash = (column * 17 + row * 23) % 31;
    context.fillStyle = tile === 'f' ? (hash % 2 ? '#f1c34f' : '#efa2ae') : 'rgba(255,255,255,.16)';
    context.beginPath();
    context.arc(x + 7 + hash % 18, y + 8 + hash % 13, tile === 'f' ? 3 : 2, 0, Math.PI * 2);
    context.fill();
    const zone = tile === 'g' ? zoneAt(map, column, row) : null;
    if (zone) {
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
  if (tile === 'p') {
    context.fillStyle = 'rgba(105,76,34,.16)';
    context.fillRect(x + 5 + (column * 7 + row * 3) % 19, y + 8 + (row * 5) % 14, 4, 3);
  }
  if (tile === 't') drawTree(context, x, y);
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

function drawBuilding(context, object, offsetX, offsetY) {
  const { x, y, width, height } = object.rect;
  const left = x * TILE - offsetX;
  const top = y * TILE - offsetY;
  const pixelWidth = width * TILE;
  const pixelHeight = height * TILE;
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
  const doorX = object.door.x * TILE - offsetX;
  context.fillStyle = '#674127';
  context.fillRect(doorX + 7, top + pixelHeight - 27, 18, 27);
  context.fillStyle = '#1b2430';
  context.fillRect(left + pixelWidth / 2 - 43, top + 32, 86, 22);
  context.fillStyle = '#f0c95a';
  context.font = '700 14px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(object.name, left + pixelWidth / 2, top + 43);
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
  let tick = 0;
  function render(state) {
    tick += 1;
    const viewWidth = canvas.width;
    const viewHeight = canvas.height;
    const worldWidth = map.width * TILE;
    const worldHeight = map.height * TILE;
    const playerPx = state.player.x * TILE;
    const playerPy = state.player.y * TILE;
    const offsetX = Math.max(0, Math.min(worldWidth - viewWidth, playerPx - viewWidth / 2 + TILE / 2));
    const offsetY = Math.max(0, Math.min(worldHeight - viewHeight, playerPy - viewHeight / 2 + TILE / 2));
    const firstColumn = Math.floor(offsetX / TILE);
    const firstRow = Math.floor(offsetY / TILE);
    const lastColumn = Math.min(map.width - 1, Math.ceil((offsetX + viewWidth) / TILE));
    const lastRow = Math.min(map.height - 1, Math.ceil((offsetY + viewHeight) / TILE));

    context.clearRect(0, 0, viewWidth, viewHeight);
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        drawTile(context, map, map.tiles[row][column], column * TILE - offsetX, row * TILE - offsetY, column, row, tick);
      }
    }

    for (const object of map.objects.filter(object => object.type === 'building')) drawBuilding(context, object, offsetX, offsetY);
    const entities = map.objects.filter(object => object.type === 'npc' || object.type === 'sign')
      .map(object => ({ ...object, sortY: object.y }))
      .concat({ type: 'player', x: state.player.x, y: state.player.y, sortY: state.player.y })
      .sort((a, b) => a.sortY - b.sortY);
    for (const entity of entities) {
      const x = entity.x * TILE - offsetX;
      const y = entity.y * TILE - offsetY;
      if (entity.type === 'sign') drawSign(context, x, y);
      else if (entity.type === 'npc') {
        drawPerson(context, x, y, entity.color, entity.direction || 'down');
        const questionIndex = (map.passageVillagers || []).indexOf(entity.id);
        const reading = state.progress?.reading;
        if (reading?.active && questionIndex >= 0 && questionIndex < reading.questionCount && reading.results?.[questionIndex] == null) {
          const bob = Math.sin(tick / 6) * 2;
          context.fillStyle = '#fff'; context.strokeStyle = '#1b2430'; context.lineWidth = 2;
          context.beginPath(); context.arc(x + 16, y - 5 + bob, 9, 0, Math.PI * 2); context.fill(); context.stroke();
          context.fillStyle = '#c63f2b'; context.font = '900 14px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('?', x + 16, y - 4 + bob);
        }
      }
      else drawHero(context, x, y, state.player.direction, state.progress?.equipment?.equipped);
    }
    if (state.progress?.sets?.campfire) drawCampfire(context, 20 * TILE - offsetX, 16 * TILE - offsetY);
    const scroll = state.progress?.scrolls;
    if (scroll?.spot && !scroll.found) drawScroll(context, scroll.spot.x * TILE - offsetX, scroll.spot.y * TILE - offsetY);
    if (state.progress?.story?.flags?.hiddenGrove) {
      context.fillStyle = 'rgba(244,211,79,.5)';
      context.beginPath(); context.arc(4 * TILE - offsetX, 8 * TILE - offsetY, 24, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f4efe2'; context.font = '700 11px system-ui'; context.fillText('Hidden Grove', 4 * TILE - offsetX, 8 * TILE - offsetY);
    }
    const partner = state.progress?.partners?.[0];
    if (partner) {
      const glyph = partner.split('-').slice(2).join('-').slice(0, 1);
      context.fillStyle = '#f4efe2'; context.strokeStyle = '#d9a62e'; context.lineWidth = 2;
      context.beginPath(); context.arc(playerPx - offsetX - 5, playerPy - offsetY + 5, 11, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = '#1b2430'; context.font = '700 13px serif'; context.fillText(glyph, playerPx - offsetX - 5, playerPy - offsetY + 5);
    }
  }
  return { render };
}

export { TILE };
