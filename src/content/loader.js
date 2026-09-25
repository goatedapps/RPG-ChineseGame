async function fetchJson(fetcher, url) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  return response.json();
}

function join(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
}

function mergeObjects(base, overrides = {}) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? mergeObjects(base?.[key] || {}, value)
      : value;
  }
  return result;
}

export async function listLevels(fetcher = fetch, baseUrl = '..') {
  return fetchJson(fetcher, join(baseUrl, 'content/authored/shared/levels.json'));
}

export async function loadLevelPackage(levelId, fetcher = fetch, baseUrl = '..') {
  const [content, characters, config, regions, r1Map, r2Map, r3Map, r4Map, balance, strings, items, gear, recipes, milestones, r1Sets, r2Sets, r3Sets, r4Sets, wordTags, dailyQuestTemplates, r1Story, r2Story, r3Story, r4Story] = await Promise.all([
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.content.json`)),
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.chars.json`)),
    fetchJson(fetcher, join(baseUrl, `content/authored/levels/${levelId}/level.json`)),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/regions.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r1-hub.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r2-harvest-crossing.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r3-tidewater-bay.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r4-lantern-theatre.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/balance.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/strings.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/items.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/gear.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/recipes.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/milestones.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r1-sets.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r2-sets.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r3-sets.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r4-sets.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/word-tags.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/daily-quests.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r1-story.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r2-story.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r3-story.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r4-story.json'))
  ]);
  if (content.level !== levelId || characters.level !== levelId || config.id !== levelId) {
    throw new Error(`The ${levelId} package contains mismatched level identifiers.`);
  }
  const tunedBalance = mergeObjects(balance, config.tuning?.balance);
  const campaigns = {};
  for (const [regionId, mapSource, regionStory, authoredSets] of [
    ['r1', r1Map, r1Story, r1Sets],
    ['r2', r2Map, r2Story, r2Sets[levelId] || []],
    ['r3', r3Map, r3Story, r3Sets[levelId] || []],
    ['r4', r4Map, r4Story, r4Sets[levelId] || []]
  ]) {
    const map = JSON.parse(JSON.stringify(mapSource));
    const region = regions.find(candidate => candidate.id === map.region);
    if (!region) throw new Error(`Map ${map.id} refers to missing region ${map.region}.`);
    const story = JSON.parse(JSON.stringify(regionStory));
    const regionLessons = new Set(config.regionLessons[regionId] || []);
    const lessonList = [...regionLessons];
    for (const zone of map.zones || []) {
      if (Number.isInteger(zone.lessonSlot)) zone.lesson = lessonList[zone.lessonSlot] ?? lessonList.at(-1);
    }
    for (const request of Object.values(story.requests || {})) {
      if (Number.isInteger(request.lessonSlot)) request.lesson = lessonList[request.lessonSlot] ?? lessonList.at(-1);
    }
    story.stories = JSON.parse(JSON.stringify(content.stories.filter(item => regionLessons.has(item.lesson))));
    campaigns[regionId] = { region, map, sets: authoredSets, regionStory: story };
  }
  if (config.region1?.atticLine) {
    const line = campaigns.r1.regionStory.scenes.attic.find(command => command.speaker === 'Fogling');
    if (line) line.say = config.region1.atticLine;
  }
  return activateRegion({
    id: levelId,
    label: content.label,
    content,
    characters,
    config,
    regions,
    campaigns,
    balance: tunedBalance,
    strings,
    items,
    gear,
    recipes,
    milestones,
    wordTags,
    dailyQuestTemplates,
  }, 'r1');
}

export function activateRegion(levelPackage, regionId) {
  const campaign = levelPackage.campaigns?.[regionId];
  if (!campaign) throw new Error(`Region ${regionId} is not available in this build.`);
  return { ...levelPackage, ...campaign };
}
