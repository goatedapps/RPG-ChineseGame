import { gateStatus } from './story.js';
import { regionPathGuide } from './regionGuide.js';
import { routeKey } from './regions.js';

const objectTarget = (map, id) => {
  const object = map.objects.find(candidate => candidate.id === id);
  if (!object) return null;
  return object.door ? { x: object.door.x, y: object.door.y } : { x: object.x, y: object.y };
};

const walkableZoneTarget = (map, zone) => {
  if (!zone) return null;
  const middleX = zone.rect.x + Math.floor(zone.rect.width / 2);
  const middleY = zone.rect.y + Math.floor(zone.rect.height / 2);
  const candidates = [];
  for (let y = zone.rect.y; y < zone.rect.y + zone.rect.height; y += 1) {
    for (let x = zone.rect.x; x < zone.rect.x + zone.rect.width; x += 1) {
      if (map.legend[map.tiles[y]?.[x]]?.walkable) candidates.push({ x, y });
    }
  }
  return candidates.sort((a, b) => (Math.abs(a.x - middleX) + Math.abs(a.y - middleY)) - (Math.abs(b.x - middleX) + Math.abs(b.y - middleY)))[0] || null;
};

const nearestLesson = (paths, map) => {
  const path = paths.find(candidate => candidate.suggested)
    || paths.filter(candidate => candidate.collected < candidate.total).sort((a, b) => a.collected / a.total - b.collected / b.total)[0];
  return { path, zone: map.zones.find(zone => zone.id === path?.id) };
};

export function nextStep(levelPackage, state) {
  const map = levelPackage.map;
  const regionId = levelPackage.region.id;
  const story = state.progress.story;
  const route = levelPackage.campaigns[regionId].route;
  const nextTown = levelPackage.campaigns[`r${Number(regionId.slice(1)) + 1}`]?.region.name;
  const returnTarget = objectTarget(map, 'return-village');
  const townExit = objectTarget(map, 'route-entrance') || objectTarget(map, 'next-region-gate');
  const retreat = map.route ? returnTarget : objectTarget(map, 'inn-door');
  const key = levelPackage.regionStory.gateKeyName || 'Cave Lantern';
  const gate = gateStatus(levelPackage, state.progress, state.progress.inventory, levelPackage.regionStory.gateBronzePct);

  if (state.player.hp < state.player.maxHp / 3) {
    return map.route
      ? { text: 'HP is low. Return to town and rest at the Inn.', target: retreat }
      : { text: 'HP is low. Visit the Inn to rest.', target: retreat };
  }

  const reading = state.progress.reading;
  if (reading?.active) {
    const index = Array.from({ length: reading.questionCount }, (_, value) => value).find(value => reading.results?.[value]?.correct !== true);
    const villagerId = levelPackage.regionStory.passageVillagers[index];
    return map.route
      ? { text: 'Return to town to answer the villagers’ reading questions.', target: retreat }
      : { text: 'Find the villager marked ? and answer the passage question.', target: objectTarget(map, villagerId) };
  }

  if (story.bossDefeated) {
    if (regionId === 'r7') return { text: 'Visit the Dictionary Heart to finish the story.', target: objectTarget(map, 'dictionary-heart') };
    if (map.route) return { text: story.flags.gateDictationPassed ? `Travel through the gate to ${nextTown}.` : `Find the gate to ${nextTown} and pass its dictation.`, target: objectTarget(map, 'next-region-gate') };
    return { text: `Return to the road and find the gate to ${nextTown}.`, target: townExit };
  }

  if (!gate.open) {
    const paths = regionPathGuide(levelPackage, state.progress, state.player.level);
    const { path, zone } = nearestLesson(paths, route || map);
    if (gate.bronze < gate.required && path) {
      const remaining = gate.required - gate.bronze;
      return map.route || !route
        ? { text: `Battle in ${path.name} (Lesson ${path.lesson}) to free Word Spirits. ${remaining} more Bronze cards needed for the boss.`, target: walkableZoneTarget(map, zone), lesson: path.lesson }
        : { text: `Enter ${route.name} to explore ${path.name} (Lesson ${path.lesson}). Win battles to free ${remaining} more Spirits.`, target: townExit, lesson: path.lesson };
    }
    if (!gate.lantern) return map.route
      ? { text: `Return to town and finish a Reading Hall passage for the ${key}.`, target: retreat }
      : { text: `Visit the Reading Hall to earn the ${key}.`, target: objectTarget(map, 'reading-hall') };
  }

  if (map.route) {
    const pavilion = map.objects.find(object => object.id === 'boss-pavilion-building');
    const pavilionTarget = objectTarget(map, 'boss-pavilion-building');
    const discovered = new Set(state.progress.routes?.[routeKey(regionId)]?.discovered || []);
    if (pavilion && !discovered.has(pavilionTarget.y * map.width + pavilionTarget.x)) {
      const zone = map.zones.find(candidate => pavilionTarget.x >= candidate.rect.x && pavilionTarget.x < candidate.rect.x + candidate.rect.width);
      return { text: `Search ${zone?.name || map.name} for the ${pavilion.name}. You are ready for the boss.`, target: walkableZoneTarget(map, zone) };
    }
    return { text: `Enter the ${pavilion?.name || 'boss pavilion'} and challenge the ${levelPackage.regionStory.bossName}.`, target: pavilionTarget };
  }
  const bossTarget = regionId === 'r7' ? objectTarget(map, 'final-seal-building') : townExit;
  return { text: regionId === 'r7' ? `Enter the Final Seal and challenge the ${levelPackage.regionStory.bossName}.` : `Return to ${route.name} and find the ${levelPackage.regionStory.bossPlace}.`, target: bossTarget };
}
