import { createEventBus } from './core/events.js';
import { exportSaveEnvelope, loadLevelState, loadProfile, recoveryKey, saveLevelState, saveProfile, startFreshLevelState } from './core/save.js?p10g';
import { activateRegion, listLevels, loadLevelPackage } from './content/loader.js?p21';
import { attemptStep, isWalkable, validateMap } from './world/map.js';
import { createRenderer } from './world/renderer.js?p26';
import { bindInput } from './world/input.js?p10n';
import { $, escapeHtml } from './ui/dom.js';
import { createOverlay } from './ui/overlay.js?p10e';
import { updateHud } from './ui/hud.js?p2';
import { createToast } from './ui/toast.js';
import { bindAtlasMenu, setAtlasRegion } from './ui/atlas.js?p4';
import { createGameplay } from './gameplay.js?p39';
import { createCollection } from './collection.js?p19';
import { createAdventure } from './adventure.js?p31';
import { createAudioManager } from './core/audio.js?p24';
import { warmImage } from './core/assets.js';
import { createPrologue } from './ui/prologue.js?p22';
import { localDay } from './core/time.js';
import { encounterStep } from './world/encounters.js?p18';
import { restoreNpcPositions, wanderNpcs } from './world/npcs.js?p17c';
import { nextStep } from './systems/wayfinding.js?p1';
import { drawGuideMap } from './ui/guideMap.js?p1';
import { enterRegion, regionIdForMap, routeKey, saveCurrentRegion } from './systems/regions.js?p14';
import { revealRouteTile } from './world/fog.js?p2';
import { showGateOpening } from './ui/gateTransition.js';
import { activateVillagePortals } from './systems/ending.js';

const storage = window.localStorage;
const overlay = createOverlay($('#overlay'));
const toast = createToast($('#toast'));
const events = createEventBus();
const audio = createAudioManager();
audio.setVisible(!document.hidden);
const hud = {
  region: $('#hud-region'),
  level: $('#hud-level'),
  location: $('#hud-location'),
  playerLevel: $('#hud-player-level'),
  xp: $('#hud-xp'),
  xpBar: $('#hud-xp-bar'),
  hp: $('#hud-hp'),
  hpBar: $('#hud-hp-bar'),
  coins: $('#hud-coins'),
  spirits: $('#hud-spirits'),
  battles: $('#hud-battles'),
  streak: $('#hud-streak'),
  status: $('#save-status')
};

let levels = [];
let active = null;
let unbindInput = null;
let autosave = null;
let wanderTimer = null;
let stageObserver = null;
let gameplay = null;
let collection = null;
let adventure = null;
let prologueCompleted = false;
let lastRewardState = null;

function render() {
  if (!active) return;
  setAtlasRegion($('.game-shell'), active.levelPackage.region.id);
  const canvas = $('#world');
  const stage = $('#game-stage');
  stage.setAttribute('aria-label', `${active.levelPackage.map.name} map`);
  const width = Math.max(320, Math.round(stage.clientWidth));
  const height = Math.max(320, Math.round(stage.clientHeight));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const step = updateObjective();
  active.renderer.render({ ...active.state, guidePin: step.target });
  updateHud(hud, active.levelPackage, active.state);
  if (active.levelPackage.map.route) hud.region.textContent = active.levelPackage.map.name;
  const guideMap = $('#guide-map');
  guideMap.hidden = false;
  $('#guide-map-heading').textContent = active.levelPackage.map.route ? 'Route map' : 'Village map';
  const currentZone = drawGuideMap($('#guide-map-canvas'), active.levelPackage.map, active.state, step);
  const zoneLabel = $('#route-zone-label');
  zoneLabel.hidden = false;
  zoneLabel.textContent = currentZone ? `${currentZone.name} · Lesson ${currentZone.lesson}` : active.levelPackage.map.route ? 'Between lesson areas' : 'Safe town · battle on the road';
  const effects = $('#route-effects');
  const encounter = active.state.progress.encounter;
  const activeEffects = active.levelPackage.map.route ? [
    encounter.repellentSteps > 0 ? `🛡 Forest Repellent · ${encounter.repellentSteps} steps` : '',
    encounter.scholarsLanternSteps > 0 ? `🏮 Scholar’s Lantern · ${encounter.scholarsLanternSteps} steps` : ''
  ].filter(Boolean) : [];
  effects.hidden = activeEffects.length === 0;
  effects.innerHTML = activeEffects.map(effect => `<span>${escapeHtml(effect)}</span>`).join('');
}

function persist({ rewardSound = true } = {}) {
  if (!active || active.saveBlocked) return;
  try {
    const player = active.state.player;
    const rewardState = { level: player.level, xp: player.xp, coins: player.coins };
    if (rewardSound && lastRewardState && (rewardState.coins > lastRewardState.coins || rewardState.level > lastRewardState.level || (rewardState.level === lastRewardState.level && rewardState.xp > lastRewardState.xp))) audio.sfx('earn');
    lastRewardState = rewardState;
    active.state = saveLevelState(storage, active.state);
    updateHud(hud, active.levelPackage, active.state);
  } catch (error) {
    active.saveBlocked = true;
    hud.status.textContent = 'Save unavailable';
    hud.status.classList.add('warning');
    toast('Progress could not be saved.');
    console.error(error);
  }
}

function importCurrentLevelSave(state) {
  if (!active || state.level !== active.levelPackage.id) throw new Error('This save belongs to a different curriculum. Switch curriculum first.');
  const matchingMap = Object.values(active.levelPackage.campaigns).some(campaign => campaign.map.id === state.player.map || campaign.route?.id === state.player.map);
  if (!matchingMap) throw new Error('This save refers to a map that is not in this version of the game.');
  saveLevelState(storage, state);
  window.location.reload();
}

function showBattleQuotaNotice() {
  if (!active || gameplay?.battlesLeft() !== 0) return;
  if (active.levelPackage.map.route) changeRoute('rest');
  else {
    const inn = active.levelPackage.map.objects.find(object => object.id === 'inn-door');
    if (inn && isWalkable(active.levelPackage.map, inn.x, inn.y + 1)) {
      Object.assign(active.state.player, { x: inn.x, y: inn.y + 1, direction: 'up' });
      persist();
      render();
    }
  }
  overlay.open('<div class="panel result-panel"><p class="panel-kicker">Daily battle quota</p><h1>That’s all the battles for today</h1><p>You have used today’s battle quota. A parent can add five more battles in Parent Mode. For now, you are back at the Inn and can rest or try other town activities.</p><button class="primary" data-close-overlay>Continue at the Inn</button></div>', { dismissible: false });
}

function move(direction) {
  if (!active || overlay.isOpen) return;
  if (active.levelPackage.map.route && gameplay.battlesLeft() === 0) return showBattleQuotaNotice();
  const result = attemptStep(active.state.player, active.levelPackage.map, direction);
  active.state = { ...active.state, player: result.player };
  if (result.moved) {
    events.emit('player:moved', { ...result.player });
    if (active.levelPackage.map.route) {
      const route = active.state.progress.routes[routeKey(active.levelPackage.region.id)];
      route.position = { x: result.player.x, y: result.player.y, direction: result.player.direction };
      route.discovered = revealRouteTile(active.levelPackage.map, route.discovered, result.player.x, result.player.y);
    }
    const spot = active.levelPackage.map.route ? null : adventure?.scrollSpot();
    if (spot && result.player.x === spot.x && result.player.y === spot.y) adventure.collectDailyScroll();
    const previousEffects = active.state.progress.encounter;
    const encounter = encounterStep(previousEffects, active.levelPackage.map, result.player);
    active.state.progress.encounter = encounter.state;
    if (encounter.entered) toast(`${encounter.entered.name} · Lesson ${encounter.entered.lesson}`);
    persist();
    if (encounter.encounter) gameplay.startBattle(encounter.zone, { scholarsLanternActive: encounter.scholarsLanternActive });
    const expired = [previousEffects.repellentSteps > 0 && encounter.state.repellentSteps === 0 ? 'Forest Repellent' : '', previousEffects.scholarsLanternSteps > 0 && encounter.state.scholarsLanternSteps === 0 ? 'Scholar’s Lantern' : ''].filter(Boolean);
    if (expired.length) overlay.open(`<div class="panel result-panel effect-expired"><p class="panel-kicker">Travel effect ended</p><h1>${escapeHtml(expired.join(' and '))} wore off</h1><p>${expired.length > 1 ? 'These effects' : 'This effect'} will no longer protect your next forest steps. You can use another from your Bag.</p><button class="primary" data-close-overlay>Continue exploring</button></div>`);
  } else if (result.interaction) {
    events.emit('world:interaction', result.interaction);
    if (!gameplay?.handleInteraction(result.interaction) && !adventure?.handleInteraction(result.interaction)) overlay.dialogue(result.interaction.interaction);
  }
  render();
}

function startAutosave() {
  clearInterval(autosave);
  autosave = setInterval(() => {
    if (!active || overlay.isOpen || document.hidden) return;
    active.state.session.playMs += 5000;
    const today = localDay();
    const entry = active.state.progress.activity[today] || { battles: 0, school: 0, reading: 0, writing: 0, minutes: 0 };
    active.state.progress.activity[today] = { ...entry, minutes: entry.minutes + 1 / 12 };
    persist();
  }, 5000);
}

function updateObjective() {
  const step = nextStep(active.levelPackage, active.state);
  $('#objective-text').textContent = step.text;
  return step;
}

function startWorldTimers() {
  clearInterval(wanderTimer);
  wanderTimer = setInterval(() => {
    if (!active || overlay.isOpen || document.hidden) return;
    active.state.progress.npcs = wanderNpcs(active.levelPackage.map, active.state.player, active.state.progress.npcs);
    render();
  }, 1300);
}

function showWelcome(loadResult) {
  const messages = [];
  if (loadResult.migrated) messages.push('Your existing P5 prototype progress was copied into this preview. The original prototype save was left untouched.');
  if (loadResult.warning) messages.push(`Save recovery notice: ${loadResult.warning}`);
  messages.push(`Use the arrow pad to walk. Open Adventure to continue the ${active.levelPackage.region.name} story, or explore in any order.`);
  overlay.open(`<div class="panel">
    <h1>Welcome to ${escapeHtml(active.levelPackage.region.name)}</h1>
    ${messages.map(message => `<p>${message}</p>`).join('')}
    <p>Collect word spirits, help the residents, complete daily quests, earn the regional key item, and challenge the region boss.</p>
    <div class="button-row">${loadResult.blocked ? '<button class="primary" data-fresh-save>Start fresh</button><button class="secondary" data-download-recovery>Download damaged save</button>' : '<button class="primary" data-enter-world>Enter the village</button>'}</div>
  </div>`, { dismissible: false });
  $('[data-enter-world]')?.addEventListener('click', () => {
    active.state.session.seenWelcome = true;
    persist();
    overlay.close();
    render();
    if (!active.state.progress.story.flags.arrival) adventure?.storyJournal();
  }, { once: true });
  $('[data-download-recovery]')?.addEventListener('click', () => {
    const payload = storage.getItem(recoveryKey(active.levelPackage.id)) || '';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([payload], { type: 'text/plain' }));
    link.download = `word-spirit-quest-${active.levelPackage.id}-damaged-save.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
  $('[data-fresh-save]')?.addEventListener('click', event => {
    if (event.currentTarget.dataset.confirm !== 'true') {
      event.currentTarget.dataset.confirm = 'true';
      event.currentTarget.textContent = 'Confirm new save';
      toast('Download the damaged save first if you want to keep it for support.');
      return;
    }
    active.state = startFreshLevelState(storage, active.levelPackage);
    active.saveBlocked = false;
    active.state.session.seenWelcome = true;
    persist();
    overlay.close();
    render();
  });
}

async function startLevel(levelId) {
  overlay.open('<div class="panel"><h2>Opening the shared world…</h2><p>Loading curriculum, map and save data.</p></div>', { dismissible: false });
  try {
    let levelPackage = await loadLevelPackage(levelId);
    for (const campaign of Object.values(levelPackage.campaigns)) {
      for (const map of [campaign.map, campaign.route].filter(Boolean)) {
        const mapErrors = validateMap(map);
        if (mapErrors.length) throw new Error(`${map.name}: ${mapErrors.join(' ')}`);
      }
    }
    const loadResult = loadLevelState(storage, levelPackage);
    if (loadResult.state.progress.flags.worldRestored || loadResult.state.progress.regions?.r7?.story?.flags?.dictionaryHeart || (loadResult.state.player.map === levelPackage.campaigns.r7.map.id && loadResult.state.progress.story?.flags?.dictionaryHeart)) {
      loadResult.state.progress.flags.worldRestored = true;
      activateVillagePortals(levelPackage.campaigns);
    }
    const savedRegionId = regionIdForMap(levelPackage, loadResult.state.player.map);
    levelPackage = activateRegion(levelPackage, savedRegionId);
    if (loadResult.state.player.map === levelPackage.campaigns[savedRegionId].route?.id) {
      levelPackage.map = levelPackage.campaigns[savedRegionId].route;
      const key = routeKey(savedRegionId);
      loadResult.state.progress.routes[key] ||= { discovered: [], gateOpened: false, mapVersion: levelPackage.map.mapVersion };
      loadResult.state.progress.routes[key].discovered = revealRouteTile(levelPackage.map, loadResult.state.progress.routes[key].discovered, loadResult.state.player.x, loadResult.state.player.y);
    }
    if (!isWalkable(levelPackage.map, loadResult.state.player.x, loadResult.state.player.y)) {
      loadResult.state.player.x = levelPackage.map.spawn.x;
      loadResult.state.player.y = levelPackage.map.spawn.y;
      loadResult.warning = [loadResult.warning, 'The saved position was moved to the village entrance.'].filter(Boolean).join(' ');
    }
    saveProfile(storage, levelId);
    active = {
      levelPackage,
      state: loadResult.state,
      renderer: createRenderer($('#world'), levelPackage.map),
      saveBlocked: Boolean(loadResult.blocked)
    };
    lastRewardState = { level: active.state.player.level, xp: active.state.player.xp, coins: active.state.player.coins };
    restoreNpcPositions(levelPackage.map, active.state.progress.npcs);
    collection = createCollection({ overlay, getActive: () => active, persist, render, toast, audio });
    gameplay = createGameplay({ overlay, storage, getActive: () => active, persist, render, toast, audio, onSwitchLevel: showLevelPicker, onSwitchRegion: switchRegion, onReturnToVillage: () => changeRoute('rest'), onBattleQuotaExhausted: showBattleQuotaNotice, onImportSave: importCurrentLevelSave, onCollectionChanged: () => collection.applyMilestones(), onProgressEvent: (event, payload) => adventure?.recordEvent(event, payload) });
    adventure = createAdventure({ overlay, getActive: () => active, persist, render, toast, gameplay, audio, onSwitchRegion: switchRegion, onEnterRoute: changeRoute, onGateOpening: showGateOpening });
    adventure.initialize();
    collection.refreshMaxHp();
    unbindInput?.();
    unbindInput = bindInput({ dpad: $('#dpad'), onMove: move });
    stageObserver?.disconnect();
    if ('ResizeObserver' in window) {
      stageObserver = new ResizeObserver(() => render());
      stageObserver.observe($('#game-stage'));
    }
    startAutosave();
    startWorldTimers();
    audio.setEnabled(active.state.settings.sound);
    audio.setWorld(active.levelPackage.region.id);
    audio.setScene('village');
    $('#sound-button span').textContent = active.state.settings.sound ? 'Sound on' : 'Sound off';
    $('#sound-button').setAttribute('aria-pressed', String(active.state.settings.sound));
    $('#sound-button').setAttribute('aria-label', active.state.settings.sound ? 'Sound on' : 'Sound off');
    render();
    if (prologueCompleted && !loadResult.blocked && !loadResult.migrated && !loadResult.warning) {
      active.state.session.seenWelcome = true;
      persist();
    }
    if (active.levelPackage.map.route && gameplay.battlesLeft() === 0) showBattleQuotaNotice();
    else if (!active.state.session.seenWelcome || loadResult.migrated || loadResult.warning) showWelcome(loadResult);
    else {
      overlay.close();
      if (!active.state.progress.story.flags.arrival) adventure.storyJournal();
    }
  } catch (error) {
    console.error(error);
    overlay.open(`<div class="panel"><h2>The preview could not start</h2><p>${escapeHtml(error.message)}</p><button class="secondary" data-retry>Back to levels</button></div>`, { dismissible: false });
    $('[data-retry]').addEventListener('click', showLevelPicker, { once: true });
  }
}

function saveCurrentLocation() {
  const regionId = active.levelPackage.region.id;
  if (active.levelPackage.map.route) {
    const route = active.state.progress.routes[routeKey(regionId)];
    route.position = { x: active.state.player.x, y: active.state.player.y, direction: active.state.player.direction };
    saveCurrentRegion(active.state, regionId);
    active.state.progress.regions[regionId].position = route.villagePosition || active.levelPackage.campaigns[regionId].map.spawn;
  } else saveCurrentRegion(active.state, regionId);
}

function changeRoute(direction) {
  if (!active) return;
  if ((direction === 'enter' || direction === 'back') && gameplay?.battlesLeft() === 0) return showBattleQuotaNotice();
  let regionId = active.levelPackage.region.id;
  if (direction === 'back') {
    const previousId = `r${Number(regionId.slice(1)) - 1}`;
    if (!active.levelPackage.campaigns[previousId]?.route) return;
    saveCurrentLocation();
    active.levelPackage = activateRegion(active.levelPackage, previousId);
    enterRegion(active.state, active.levelPackage);
    regionId = previousId;
  }
  const routeMap = active.levelPackage.campaigns[regionId].route;
  if (!routeMap) return;
  const key = routeKey(regionId);
  active.state.progress.routes[key] ||= { discovered: [], gateOpened: false, mapVersion: routeMap.mapVersion };
  const route = active.state.progress.routes[key];
  if (direction === 'back') {
    const gate = routeMap.objects.find(object => object.id === 'next-region-gate');
    const position = [{ x: gate.x - 1, y: gate.y }, { x: gate.x + 1, y: gate.y }, { x: gate.x, y: gate.y + 1 }, { x: gate.x, y: gate.y - 1 }].find(candidate => isWalkable(routeMap, candidate.x, candidate.y));
    if (!position) throw new Error(`The ${routeMap.name} gate has no accessible approach.`);
    active.levelPackage.map = routeMap;
    active.state.player = { ...active.state.player, ...position, direction: 'left', map: routeMap.id };
    route.position = { ...position, direction: 'left' };
    route.discovered = revealRouteTile(routeMap, route.discovered, position.x, position.y);
  }
  if (direction === 'enter' && !active.levelPackage.map.route) {
    saveCurrentRegion(active.state, regionId);
    route.villagePosition = { x: active.state.player.x, y: active.state.player.y, direction: active.state.player.direction };
    const position = Number.isInteger(route.position?.x) && Number.isInteger(route.position?.y) && isWalkable(routeMap, route.position.x, route.position.y) ? route.position : routeMap.spawn;
    active.levelPackage.map = routeMap;
    active.state.player = { ...active.state.player, ...position, map: routeMap.id };
    route.discovered = revealRouteTile(routeMap, route.discovered, position.x, position.y);
  } else if ((direction === 'leave' || direction === 'rest') && active.levelPackage.map.route) {
    saveCurrentLocation();
    active.levelPackage = activateRegion(active.levelPackage, regionId);
    enterRegion(active.state, active.levelPackage);
    if (direction === 'rest') {
      const inn = active.levelPackage.map.objects.find(object => object.id === 'inn-door');
      if (inn) Object.assign(active.state.player, { x: inn.x, y: inn.y + 1, direction: 'up' });
    }
    restoreNpcPositions(active.levelPackage.map, active.state.progress.npcs);
  } else if (direction !== 'back') return;
  active.renderer.dispose?.();
  active.renderer = createRenderer($('#world'), active.levelPackage.map);
  persist();
  overlay.close();
  render();
  audio.setWorld(regionId);
  audio.setScene('village');
  toast(direction === 'enter' || direction === 'back' ? `${routeMap.name} is shrouded in fog. Each step reveals more.` : direction === 'rest' ? 'The villagers carried you to the Inn.' : `Returned to ${active.levelPackage.region.name}.`);
}

function switchRegion(regionId) {
  if (!active?.levelPackage.campaigns?.[regionId]) return toast('That region is not available yet.');
  const currentId = active.levelPackage.region.id;
  if (currentId === regionId) return;
  saveCurrentLocation();
  active.renderer.dispose?.();
  active.levelPackage = activateRegion(active.levelPackage, regionId);
  enterRegion(active.state, active.levelPackage);
  active.renderer = createRenderer($('#world'), active.levelPackage.map);
  restoreNpcPositions(active.levelPackage.map, active.state.progress.npcs);
  adventure?.initialize();
  persist();
  render();
  overlay.close();
  audio.setWorld(active.levelPackage.region.id);
  audio.setScene('village');
  toast(`Arrived in ${active.levelPackage.region.name}.`);
  if (!active.state.progress.story.flags.arrival) adventure.storyJournal();
}

function levelStatus(level) {
  if (level.worldMappingReady) return '';
  if (level.sourceReady) return 'Curriculum imported · world mapping in progress';
  return 'Coming soon';
}

function showLevelPicker() {
  if (!active) $('#game-stage').setAttribute('aria-label', 'Curriculum selection');
  overlay.open(`<div class="panel atlas-level-picker">
    <h1>Choose your curriculum</h1>
    <p>Every level follows the same seven-region adventure. Learning progress is saved separately for each curriculum.</p>
    <div class="level-grid">
      ${levels.map(level => `<button class="level-card" data-level="${level.id}" ${level.worldMappingReady ? '' : 'disabled'}>
        <i aria-hidden="true">${escapeHtml(level.badge || '学')}</i><b>${escapeHtml(level.label)}</b><span>${levelStatus(level) || 'Enter the seven-region adventure'}</span>
      </button>`).join('')}
    </div>
    ${active ? '<div class="button-row"><button class="secondary" data-close-overlay>Return to village</button></div>' : ''}
  </div>`, { dismissible: Boolean(active) });
  for (const button of document.querySelectorAll('[data-level]:not([disabled])')) {
    button.addEventListener('click', () => startLevel(button.dataset.level), { once: true });
  }
}

function showBuildStatus() {
  if (!active) return;
  const { levelPackage, state } = active;
  overlay.open(`<div class="panel">
    <div class="panel-header"><h2>Development status</h2><button class="secondary" data-close-overlay>Close</button></div>
    <p>Every playable curriculum shares the seven-region campaign with its own save, lessons and tuning.</p>
    ${active.saveBlocked ? '<p class="save-warning">Saving is paused because the stored save could not be recovered. Export the current in-memory state before reloading.</p>' : ''}
    <div class="status-grid">
      <div>Curriculum<b>${levelPackage.label}</b></div>
      <div>Content version<b>${levelPackage.content.contentVersion}</b></div>
      <div>Vocabulary loaded<b>${levelPackage.content.words.length}</b></div>
      <div>Local Hanzi loaded<b>${Object.keys(levelPackage.characters.characters).length}</b></div>
      <div>Position<b>${state.player.x}, ${state.player.y}</b></div>
      <div>Save integrity<b>${state.tampered ? 'Edited' : 'Verified'}</b></div>
    </div>
    <div class="button-row"><button class="primary" data-export-current>Export current state</button><button class="secondary" data-replay-intro>Replay introduction</button><button class="secondary" data-switch-level>Switch curriculum</button>${Object.values(levelPackage.campaigns).map(campaign => `<button class="secondary" data-debug-region="${campaign.region.id}" ${campaign.region.id === levelPackage.region.id ? 'disabled' : ''}>Open ${escapeHtml(campaign.region.name)}</button>`).join('')}</div>
  </div>`);
  $('[data-switch-level]').addEventListener('click', showLevelPicker, { once: true });
  $('[data-replay-intro]').addEventListener('click', () => {
    overlay.close();
    createPrologue({ root: $('#prologue'), audio, onComplete: render, skippable: true });
  }, { once: true });
  for (const button of document.querySelectorAll('[data-debug-region]:not([disabled])')) button.addEventListener('click', () => switchRegion(button.dataset.debugRegion), { once: true });
  $('[data-export-current]').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(exportSaveEnvelope(state), null, 2)], { type: 'application/json' }));
    link.download = `word-spirit-quest-${state.level}-export.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
}

async function boot() {
  bindAtlasMenu($('.game-shell'), $('#atlas-menu-toggle'), render, matchMedia('(min-width: 1000px)').matches);
  const walkingHero = $('#boot-loading-hero');
  walkingHero?.decode().then(() => walkingHero.classList.add('ready')).catch(() => {});
  const openingImage = new Image();
  openingImage.src = new URL('../assets/images/intro/dictionary-tree.jpg', import.meta.url).href;
  if (new URLSearchParams(location.search).get('debug') === '1') {
    for (const element of document.querySelectorAll('.debug-only')) element.hidden = false;
  }
  $('#status-button').addEventListener('click', showBuildStatus);
  $('#book-button').addEventListener('click', () => gameplay?.spiritBook());
  $('#dictation-button').addEventListener('click', () => gameplay?.dictationPractice());
  $('#character-button').addEventListener('click', () => collection?.character());
  $('#bag-button').addEventListener('click', () => collection?.bag());
  $('#room-button').addEventListener('click', () => collection?.room());
  $('#daily-button').addEventListener('click', () => adventure?.questBoard());
  $('#story-button').addEventListener('click', () => adventure?.storyJournal());
  $('#parent-button').addEventListener('click', () => gameplay?.parentPanel());
  $('#sound-button').addEventListener('click', event => {
    if (!active) return;
    active.state.settings.sound = !active.state.settings.sound;
    audio.setEnabled(active.state.settings.sound);
    event.currentTarget.querySelector('span').textContent = active.state.settings.sound ? 'Sound on' : 'Sound off';
    event.currentTarget.setAttribute('aria-pressed', String(active.state.settings.sound));
    event.currentTarget.setAttribute('aria-label', active.state.settings.sound ? 'Sound on' : 'Sound off');
    persist();
  });
  events.on('world:interaction', interaction => console.debug('Interaction', interaction.id));
  addEventListener('pointerdown', () => audio.unlock(), { once: true });
  addEventListener('keydown', () => audio.unlock(), { once: true });
  addEventListener('click', event => { if (event.target.closest('button')) audio.sfx('button'); });
  try {
    levels = await listLevels();
    const requestedLevel = new URLSearchParams(location.search).get('level');
    const profile = loadProfile(storage);
    const level = levels.find(candidate => candidate.id === (requestedLevel || profile?.level) && candidate.worldMappingReady);
    await openingImage.decode().catch(() => {});
    createPrologue({
      root: $('#prologue'),
      audio,
      skippable: true,
      onComplete: async () => {
        prologueCompleted = true;
        if (level) await startLevel(level.id);
        else showLevelPicker();
      }
    });
    requestAnimationFrame(() => $('#boot-loading')?.remove());
    const warmPaths = ['room/grandmas-room.jpg', 'intro/great-forgetter.jpg', 'intro/spirits-scattered.jpg', 'shop/shop-background.jpg', 'story/reading-scroll.jpg', 'hero/main-hero.webp', 'story/open-book.webp'];
    (async () => { for (const path of warmPaths) await warmImage(new URL(`../assets/images/${path}`, import.meta.url).href).catch(() => {}); })();
  } catch (error) {
    console.error(error);
    overlay.open(`<div class="panel"><h1>Could not load the game</h1><p>${escapeHtml(error.message)}</p><p>Serve the repository through HTTP; ES modules and content files cannot load from <code>file://</code>.</p></div>`, { dismissible: false });
    $('#boot-loading')?.remove();
  }
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).href }).catch(error => console.warn('Offline support could not start.', error));
}

addEventListener('offline', () => { hud.status.textContent = 'Offline · progress stays on this device'; hud.status.classList.add('warning'); });
addEventListener('online', () => { if (active && !active.saveBlocked) { hud.status.textContent = active.state.tampered ? 'Save edited' : 'Save verified'; hud.status.classList.toggle('warning', active.state.tampered); } });

window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => audio.setVisible(!document.hidden));
window.addEventListener('pagehide', () => audio.setVisible(false));
window.addEventListener('pageshow', () => audio.setVisible(!document.hidden));
window.__WSQ_GAME__ = { get active() { return active; }, get gameplay() { return gameplay; }, get adventure() { return adventure; }, events, startLevel, switchRegion };
boot();
