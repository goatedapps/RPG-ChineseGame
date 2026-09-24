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
  const [content, characters, config, regions, map, balance, strings, items, gear, recipes, milestones, sets, wordTags, dailyQuestTemplates, regionStory] = await Promise.all([
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.content.json`)),
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.chars.json`)),
    fetchJson(fetcher, join(baseUrl, `content/authored/levels/${levelId}/level.json`)),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/regions.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r1-hub.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/balance.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/strings.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/items.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/gear.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/recipes.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/milestones.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r1-sets.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/word-tags.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/daily-quests.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/r1-story.json'))
  ]);
  if (content.level !== levelId || characters.level !== levelId || config.id !== levelId) {
    throw new Error(`The ${levelId} package contains mismatched level identifiers.`);
  }
  const region = regions.find(candidate => candidate.id === map.region);
  if (!region) throw new Error(`Map ${map.id} refers to missing region ${map.region}.`);
  const tunedBalance = mergeObjects(balance, config.tuning?.balance);
  const tunedStory = JSON.parse(JSON.stringify(regionStory));
  if (config.region1?.stories?.length) tunedStory.stories = JSON.parse(JSON.stringify(config.region1.stories));
  if (config.region1?.atticLine) {
    const line = tunedStory.scenes.attic.find(command => command.speaker === 'Fogling');
    if (line) line.say = config.region1.atticLine;
  }
  return {
    id: levelId,
    label: content.label,
    content,
    characters,
    config,
    regions,
    region,
    map,
    balance: tunedBalance,
    strings,
    items,
    gear,
    recipes,
    milestones,
    sets,
    wordTags,
    dailyQuestTemplates,
    regionStory: tunedStory
  };
}
