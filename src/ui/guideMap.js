import { routeKey } from '../systems/regions.js';
import { zoneAt } from '../world/encounters.js';

const SCALE = 3;
export function drawGuideMap(canvas, map, state, step) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const lessons = map.route || !map.safeTown ? map.zones || [] : [];
  const header = lessons.length ? 19 : 0;
  canvas.width = map.width * SCALE;
  canvas.height = map.height * SCALE + header;
  context.fillStyle = '#e9d7a7';
  context.fillRect(0, 0, canvas.width, header);
  context.fillStyle = '#163743';
  context.font = 'bold 9px system-ui';
  context.textAlign = 'center';
  for (const zone of lessons) {
    const center = Math.min(canvas.width - 30, Math.max(30, (zone.rect.x + zone.rect.width / 2) * SCALE));
    context.fillText(`L${zone.lesson}`, center, 13);
  }
  const discovered = map.route ? new Set(state.progress.routes?.[routeKey(map.region)]?.discovered || []) : null;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.tiles[y][x];
      context.fillStyle = discovered && !discovered.has(y * map.width + x) ? '#183d4a' : map.legend[tile]?.color || '#5d8c72';
      context.fillRect(x * SCALE, y * SCALE + header, SCALE, SCALE);
    }
  }
  for (const object of map.objects) {
    if (object.type !== 'building') continue;
    if (discovered && !discovered.has(object.rect.y * map.width + object.rect.x)) continue;
    context.fillStyle = '#31465a';
    context.fillRect(object.rect.x * SCALE, object.rect.y * SCALE + header, object.rect.width * SCALE, object.rect.height * SCALE);
  }
  if (step.target) {
    const x = (step.target.x + .5) * SCALE;
    const y = (step.target.y + .5) * SCALE + header;
    context.fillStyle = '#aa382d';
    context.beginPath();
    context.arc(x, y - 3, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff4d9';
    context.beginPath();
    context.arc(x, y - 3, 1.8, 0, Math.PI * 2);
    context.fill();
  }
  const playerX = (state.player.x + .5) * SCALE;
  const playerY = (state.player.y + .5) * SCALE + header;
  context.fillStyle = '#fffdf1';
  context.strokeStyle = '#173744';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(playerX, playerY, 4, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  const current = lessons.length ? zoneAt(map, state.player.x, state.player.y) : null;
  canvas.setAttribute('aria-label', `${map.name} map. ${current ? `You are in ${current.name}, Lesson ${current.lesson}.` : lessons.length ? 'You are between lesson areas.' : 'The town is safe; battle beyond it.'} White dot: you. Red pin: next step.`);
  return current;
}
