async function fetchJson(fetcher, url) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status}).`);
  return response.json();
}

function join(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
}

export async function listLevels(fetcher = fetch, baseUrl = '..') {
  return fetchJson(fetcher, join(baseUrl, 'content/authored/shared/levels.json'));
}

export async function loadLevelPackage(levelId, fetcher = fetch, baseUrl = '..') {
  const [content, characters, config, regions, map, balance, strings] = await Promise.all([
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.content.json`)),
    fetchJson(fetcher, join(baseUrl, `content/generated/${levelId}.chars.json`)),
    fetchJson(fetcher, join(baseUrl, `content/authored/levels/${levelId}/level.json`)),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/regions.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/campaign/maps/r1-hub.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/balance.json')),
    fetchJson(fetcher, join(baseUrl, 'content/authored/shared/strings.json'))
  ]);
  if (content.level !== levelId || characters.level !== levelId || config.id !== levelId) {
    throw new Error(`The ${levelId} package contains mismatched level identifiers.`);
  }
  const region = regions.find(candidate => candidate.id === map.region);
  if (!region) throw new Error(`Map ${map.id} refers to missing region ${map.region}.`);
  return {
    id: levelId,
    label: content.label,
    content,
    characters,
    config,
    regions,
    region,
    map,
    balance,
    strings
  };
}
