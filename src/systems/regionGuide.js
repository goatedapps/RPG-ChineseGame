function directionFor(map, zone) {
  const horizontal = (zone.rect.x + zone.rect.width / 2) / map.width;
  const vertical = (zone.rect.y + zone.rect.height / 2) / map.height;
  const eastWest = horizontal < .35 ? 'west' : horizontal > .65 ? 'east' : '';
  const northSouth = vertical < .35 ? 'north' : vertical > .65 ? 'south' : '';
  return `${northSouth}${eastWest}` || 'near the village centre';
}

export function regionPathGuide(levelPackage, progress, heroLevel) {
  const regionId = levelPackage.region.id;
  const lessons = new Set(levelPackage.config.regionLessons[regionId] || []);
  const paths = (levelPackage.map.zones || []).filter(zone => lessons.has(zone.lesson)).map(zone => {
    const words = levelPackage.content.words.filter(word => word.lesson === zone.lesson);
    const collected = words.filter(word => progress.words[word.w]?.collected || progress.words[word.w]?.c).length;
    const [minimum, maximum] = levelPackage.balance.combat.lessonLevels[String(zone.lesson)] || [1, 1];
    const challenge = heroLevel < minimum - 3 ? 'Tougher' : heroLevel > maximum + 2 ? 'Gentle' : 'Good match';
    return { id: zone.id, name: zone.name, lesson: zone.lesson, collected, total: words.length, minimum, maximum, challenge, direction: directionFor(levelPackage.map, zone) };
  }).filter(path => path.total).sort((a, b) => a.minimum - b.minimum || a.maximum - b.maximum);
  const suggested = paths.find(path => path.collected < Math.ceil(path.total * .7));
  return paths.map(path => ({ ...path, suggested: path.id === suggested?.id }));
}
