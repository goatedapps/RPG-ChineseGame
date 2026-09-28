const SECRETS = [
  ['r1', 'hiddenGrove', 'Hidden Grove scroll'],
  ['r2', 'truthTerrace', 'Truth Terrace scroll'],
  ['r3', 'tideVault', 'Tide Vault rescue log'],
  ['r4', 'courageLoft', 'Courage Loft playbill'],
  ['r5', 'harmonyPavilion', 'Harmony Pavilion bell'],
  ['r6', 'memoryVault', 'Memory Vault promise']
];

export function villagePortalPosition(map) {
  return map.region === 'r1' ? { x: 22, y: 16 } : { x: 27, y: 29 };
}

export function activateVillagePortals(campaigns) {
  for (const campaign of Object.values(campaigns)) {
    const map = campaign.map;
    if (map.objects.some(object => object.id === 'word-portal')) continue;
    const { x, y } = villagePortalPosition(map);
    if (!map.legend[map.tiles[y]?.[x]]?.walkable || map.objects.some(object => object.x === x && object.y === y || object.rect && x >= object.rect.x && y >= object.rect.y && x < object.rect.x + object.rect.width && y < object.rect.y + object.rect.height)) {
      throw new Error(`No clear village portal tile in ${map.name}.`);
    }
    map.objects.push({ id: 'word-portal', type: 'portal', name: 'Word Portal', x, y, solid: true, interaction: { title: 'Word Portal', lines: ['The restored Tree links every village.'] } });
  }
}

export function completeDictionaryHeart(levelPackage, state, day) {
  if (!state.progress.story.bossDefeated) return false;
  if (!state.progress.story.flags.dictionaryHeart) {
    state.progress.story.flags.dictionaryHeart = true;
    state.player.coins += 120;
    state.progress.scrolls.unlocked.unshift({ day, title: 'The Great Dictionary Tree', type: 'Final Story Scroll', text: 'The scattered Word Spirits came home. The Tree did not keep words locked away: it shared them with everyone who read, spoke, wrote, listened, and tried again.' });
  }
  state.progress.flags.worldRestored = true;
  activateVillagePortals(levelPackage.campaigns);
  return true;
}

export function finaleLedger(levelPackage, state) {
  const { progress } = state;
  const storyFor = id => id === levelPackage.region.id ? progress.story : progress.regions?.[id]?.story;
  const completed = [];
  const missing = [];
  for (const [id, flag, name] of SECRETS) {
    const found = id === 'r1'
      ? (progress.scrolls?.unlocked || []).some(scroll => ['Idiom Scroll', 'Word Wisdom Scroll'].includes(scroll.type))
      : Boolean(storyFor(id)?.flags?.[flag]);
    (found ? completed : missing).push({ region: levelPackage.campaigns[id].region.name, name });
  }
  for (const [id, campaign] of Object.entries(levelPackage.campaigns)) {
    for (const [requestId, request] of Object.entries(campaign.regionStory.requests || {})) {
      const entry = { region: campaign.region.name, name: `${request.name} — ${request.reward}` };
      ((storyFor(id)?.requests?.[requestId] || 0) >= 3 ? completed : missing).push(entry);
    }
    for (const set of campaign.sets || []) {
      const entry = { region: campaign.region.name, name: `${set.name} restoration` };
      (progress.sets?.[set.id] ? completed : missing).push(entry);
    }
  }
  const chapters = Object.values(levelPackage.campaigns).map(campaign => ({
    region: campaign.region.name,
    boss: campaign.regionStory.bossName,
    image: `assets/images/creatures/${campaign.region.boss}.webp`,
    fragment: campaign.regionStory.fragmentName || 'Dawn Stroke'
  }));
  return { chapters, completed, missing, decorations: [...(progress.room?.decorations || [])], trophies: [...(progress.room?.trophies || [])] };
}
