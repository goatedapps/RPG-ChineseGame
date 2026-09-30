import { gateStatus } from './story.js';
import { regionPathGuide } from './regionGuide.js';
import { routeKey } from './regions.js';
import { tidewaterClue, tidewaterCluesComplete } from './tidewaterRescue.js?p1';
import { chapterDictationWords, chapterGroupComplete, chapterTask } from './chapterQuests.js';

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

  const lanternJourney = state.progress.regions?.r4?.story;
  const lanternChapter = levelPackage.campaigns.r4?.regionStory.chapter;
  if (['r1', 'r2', 'r3'].includes(regionId) && lanternJourney && !lanternJourney.bossDefeated && !lanternJourney.flags?.lanternRehearsed && chapterGroupComplete(lanternJourney, lanternChapter, 'cues')) {
    const memoryId = { r3: 'memory-r3', r2: 'memory-r2', r1: 'memory-r1' }[regionId];
    const done = lanternJourney.flags?.chapterTasks?.[memoryId];
    if (map.route) return lanternJourney.flags?.chapterTasks?.['memory-r1']
      ? { text: `Cross ${map.name} toward Lantern Theatre and Director Luo.`, target: objectTarget(map, 'next-region-gate') }
      : { text: `Cross ${map.name} to recover the old play's missing promises.`, target: returnTarget };
    if (!done) {
      const person = chapterTask(levelPackage, 'r4', memoryId).person;
      return { text: `Talk to ${person} about the old play's ${chapterTask(levelPackage, 'r4', memoryId).name.toLowerCase()}.`, target: objectTarget(map, { r3: 'keeper-lan', r2: 'elder-sun', r1: 'grandma-wang' }[regionId]) };
    }
    if (regionId === 'r1' || lanternJourney.flags?.chapterTasks?.['memory-r1']) return { text: 'Return east through the earlier roads to Director Luo at Lantern Theatre.', target: townExit };
    return { text: 'Continue west through the return road for the next theatre memory.', target: objectTarget(map, 'return-gate') };
  }

  if ((regionId === 'r4' || regionId === 'r6') && !story.bossDefeated) {
    const chapter = levelPackage.regionStory.chapter;
    const group = regionId === 'r4' ? 'cues' : 'evidence';
    const pending = Object.keys(chapter.tasks).filter(id => chapter.tasks[id].group === group && !story.flags.chapterTasks?.[id]);
    if (pending.length) {
      const ready = pending.find(id => chapterDictationWords(levelPackage, state.progress, regionId, id).length === chapter.wordsPerTest);
      const task = chapterTask(levelPackage, regionId, ready || pending[0]);
      const zone = route?.zones.find(candidate => candidate.lesson === task.lesson);
      if (ready) return map.route
        ? { text: `Return to town and speak to ${task.person} about ${task.name.toLowerCase()}.`, target: returnTarget }
        : { text: `Talk to ${task.person} about ${task.name.toLowerCase()}.`, target: objectTarget(map, task.id) };
      return map.route
        ? { text: `Collect ${task.requiredCollected} Lesson ${task.lesson} spirits in ${zone?.name || route.name} for ${task.person}.`, target: walkableZoneTarget(map, zone), lesson: task.lesson }
        : { text: `Explore ${zone?.name || route.name} for Lesson ${task.lesson} spirits to help ${task.person}.`, target: townExit, lesson: task.lesson };
    }
    if (regionId === 'r4' && !chapterGroupComplete(story, chapter, 'memories')) return map.route
      ? { text: 'Return to Lantern Theatre and take the west road toward Tidewater Bay for the earlier memories.', target: returnTarget }
      : { text: 'Take the west road through Tidewater Bay and Harvest Crossing to Scholar Village. Keeper Lan, Elder Sun and Grandma Wang remember how the old play began.', target: objectTarget(map, 'return-gate') };
    const compared = regionId === 'r4' ? story.flags.lanternRehearsed : story.flags.groveAccountCompared;
    if (!compared) {
      const hasKey = (state.progress.inventory.keyItems || []).includes(levelPackage.regionStory.readingKeyItem);
      const person = regionId === 'r4' ? 'Director Luo' : 'Curator Wen';
      const id = regionId === 'r4' ? 'director-luo' : 'curator-wen';
      return map.route
        ? { text: `Return to town to ${hasKey ? `compare the chapter clues with ${person}` : `earn the ${key}`}.`, target: returnTarget }
        : { text: hasKey ? `Bring the clues and ${key} to ${person}.` : `Visit the reading hall to earn the ${key}, then talk to ${person}.`, target: objectTarget(map, hasKey ? id : 'reading-hall') };
    }
  }

  if (regionId === 'r3' && !story.bossDefeated) {
    const rescue = levelPackage.regionStory.rescue;
    if (!tidewaterCluesComplete(story, levelPackage.regionStory)) {
      const pending = Object.keys(rescue.clues).filter(id => !story.flags.tideClues?.[id]);
      const ready = pending.find(id => {
        const clue = tidewaterClue(levelPackage, id);
        return levelPackage.content.words.filter(word => word.lesson === clue.lesson && (state.progress.words[word.w]?.collected || state.progress.words[word.w]?.c)).length >= clue.requiredCollected;
      });
      const id = ready || pending[0];
      const clue = tidewaterClue(levelPackage, id);
      const zone = route?.zones.find(candidate => candidate.lesson === clue.lesson);
      if (ready) return map.route
        ? { text: `Return to Tidewater Bay and speak to ${clue.person} about the ${clue.name.toLowerCase()} clue.`, target: returnTarget }
        : { text: `Talk to ${clue.person} about the ${clue.name.toLowerCase()} clue.`, target: objectTarget(map, id) };
      return map.route
        ? { text: `Collect ${clue.requiredCollected} Lesson ${clue.lesson} spirits in ${zone?.name || route.name} to help ${clue.person} find the ${clue.name.toLowerCase()} clue.`, target: walkableZoneTarget(map, zone), lesson: clue.lesson }
        : { text: `Explore ${zone?.name || route.name} (Lesson ${clue.lesson}) until you have ${clue.requiredCollected} spirits for ${clue.person}.`, target: townExit, lesson: clue.lesson };
    }
    if (!story.flags.tideEvidenceCompared) {
      const hasChronometer = (state.progress.inventory.keyItems || []).includes(levelPackage.regionStory.readingKeyItem);
      return map.route
        ? { text: `Return to Tidewater Bay to ${hasChronometer ? 'compare the rescue clues with Keeper Lan' : 'earn the Harbour Chronometer at the Tide Archive'}.`, target: returnTarget }
        : hasChronometer
          ? { text: 'Bring all three rescue clues and the Harbour Chronometer to Keeper Lan.', target: objectTarget(map, 'keeper-lan') }
          : { text: 'Visit the Tide Archive to earn the Harbour Chronometer, then talk to Keeper Lan.', target: objectTarget(map, 'reading-hall') };
    }
  }

  if (story.bossDefeated) {
    if (regionId === 'r3' && !story.flags.tideWhaleRescued) return map.route
      ? { text: 'The clock moves again. Return to town and help the crew at the Whale Rescue Dock.', target: returnTarget }
      : { text: 'Visit the Whale Rescue Dock to guide the young whale into deep water.', target: objectTarget(map, 'rescue-dock-building') };
    if (regionId === 'r4' && !story.flags.lanternPerformed) return map.route
      ? { text: 'Return to Lantern Theatre for the completed performance.', target: returnTarget }
      : { text: 'Visit Lantern Theatre and watch the cast finish the play.', target: objectTarget(map, 'theatre-building') };
    if (regionId === 'r6' && !story.flags.groveDisplayed) return map.route
      ? { text: 'Return to Ancient Grove to finish the account.', target: returnTarget }
      : { text: 'Visit the Excavation Lodge and display the reconstructed account.', target: objectTarget(map, 'excavation-lodge-building') };
    if (regionId === 'r7') return map.route
      ? { text: 'Return to Treehouse Summit and visit the Dictionary Heart.', target: returnTarget }
      : { text: 'Visit the Dictionary Heart to finish the story.', target: objectTarget(map, 'dictionary-heart') };
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
  return { text: `Return to ${route.name} and find the ${levelPackage.regionStory.bossPlace}.`, target: townExit };
}
