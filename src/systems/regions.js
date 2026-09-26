import { createStoryState, normalizeStory } from './story.js?p11';

function freshReading() {
  return { completed: [], active: null, index: 0, questionCount: 0, results: {}, written: [] };
}

function freshEncounter() {
  return { cooldown: 3, zone: null, capNoticeDay: '', repellentSteps: 0 };
}

export function saveCurrentRegion(state, regionId) {
  state.progress.regions ||= {};
  state.progress.regions[regionId] = {
    position: { x: state.player.x, y: state.player.y, direction: state.player.direction },
    story: normalizeStory(state.progress.story),
    reading: { ...freshReading(), ...(state.progress.reading || {}) },
    encounter: { ...freshEncounter(), ...(state.progress.encounter || {}) },
    npcs: { ...(state.progress.npcs || {}) }
  };
}

export function enterRegion(state, campaign) {
  const saved = state.progress.regions?.[campaign.region.id];
  const position = saved?.position || campaign.map.spawn;
  state.player.map = campaign.map.id;
  state.player.x = position.x;
  state.player.y = position.y;
  state.player.direction = position.direction || campaign.map.spawn.direction || 'down';
  state.progress.story = normalizeStory(saved?.story || createStoryState());
  state.progress.reading = { ...freshReading(), ...(saved?.reading || {}) };
  state.progress.encounter = { ...freshEncounter(), ...(saved?.encounter || {}) };
  state.progress.npcs = { ...(saved?.npcs || {}) };
  return state;
}

export function regionIdForMap(levelPackage, mapId) {
  return Object.entries(levelPackage.campaigns || {}).find(([, campaign]) => campaign.map.id === mapId || campaign.route?.id === mapId)?.[0] || 'r1';
}
