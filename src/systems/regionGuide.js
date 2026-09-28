function directionFor(map, zone) {
  if (map.route) {
    const horizontal = (zone.rect.x + zone.rect.width / 2) / map.width;
    return horizontal < 1 / 3 ? 'near the town entrance' : horizontal < 2 / 3 ? 'in the middle of the road' : map.region === 'r7' ? 'near the Final Seal Pavilion' : 'towards the onward gate';
  }
  return 'explore the local paths';
}

export function regionPathGuide(levelPackage, progress, heroLevel) {
  const regionId = levelPackage.region.id;
  const map = levelPackage.campaigns?.[regionId]?.route || levelPackage.map;
  const lessons = new Set(levelPackage.config.regionLessons[regionId] || []);
  const paths = (map.zones || []).filter(zone => lessons.has(zone.lesson)).map(zone => {
    const words = levelPackage.content.words.filter(word => word.lesson === zone.lesson);
    const collected = words.filter(word => progress.words[word.w]?.collected || progress.words[word.w]?.c).length;
    const [minimum, maximum] = levelPackage.balance.combat.lessonLevels[String(zone.lesson)] || [1, 1];
    const challenge = heroLevel < minimum - 3 ? 'Tougher' : heroLevel > maximum + 2 ? 'Gentle' : 'Good match';
    return { id: zone.id, name: zone.name, lesson: zone.lesson, collected, total: words.length, minimum, maximum, challenge, direction: directionFor(map, zone) };
  }).filter(path => path.total).sort((a, b) => a.minimum - b.minimum || a.maximum - b.maximum);
  const suggested = paths.find(path => path.collected < Math.ceil(path.total * .7));
  return paths.map(path => ({ ...path, suggested: path.id === suggested?.id }));
}
