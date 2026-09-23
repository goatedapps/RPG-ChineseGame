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

function drawPerson(context, x, y, color, direction = 'down', isPlayer = false) {
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
      else if (entity.type === 'npc') drawPerson(context, x, y, entity.color, 'down');
      else drawPerson(context, x, y, '#2f6f8f', state.player.direction, true);
    }
  }
  return { render };
}

export { TILE };
