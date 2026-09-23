import { createEventBus } from './core/events.js';
import { loadLevelState, loadProfile, saveLevelState, saveProfile } from './core/save.js';
import { listLevels, loadLevelPackage } from './content/loader.js?p5';
import { attemptStep, isWalkable, validateMap } from './world/map.js';
import { createRenderer } from './world/renderer.js';
import { bindInput } from './world/input.js';
import { $, escapeHtml } from './ui/dom.js';
import { createOverlay } from './ui/overlay.js';
import { updateHud } from './ui/hud.js';
import { createToast } from './ui/toast.js';
import { createGameplay } from './gameplay.js';
import { createCollection } from './collection.js';

const storage = window.localStorage;
const overlay = createOverlay($('#overlay'));
const toast = createToast($('#toast'));
const events = createEventBus();
const hud = {
  level: $('#hud-level'),
  location: $('#hud-location'),
  playerLevel: $('#hud-player-level'),
  xp: $('#hud-xp'),
  hp: $('#hud-hp'),
  hpBar: $('#hud-hp-bar'),
  coins: $('#hud-coins'),
  status: $('#save-status')
};

let levels = [];
let active = null;
let unbindInput = null;
let autosave = null;
let gameplay = null;
let collection = null;

function render() {
  if (!active) return;
  active.renderer.render(active.state);
  updateHud(hud, active.levelPackage, active.state);
}

function persist() {
  if (!active || active.saveBlocked) return;
  try {
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

function move(direction) {
  if (!active || overlay.isOpen) return;
  const result = attemptStep(active.state.player, active.levelPackage.map, direction);
  active.state = { ...active.state, player: result.player };
  if (result.moved) {
    events.emit('player:moved', { ...result.player });
    persist();
  } else if (result.interaction) {
    events.emit('world:interaction', result.interaction);
    if (!gameplay?.handleInteraction(result.interaction)) overlay.dialogue(result.interaction.interaction);
  }
  render();
}

function startAutosave() {
  clearInterval(autosave);
  autosave = setInterval(() => {
    if (!active || overlay.isOpen) return;
    active.state.session.playMs += 5000;
    persist();
  }, 5000);
}

function showWelcome(loadResult) {
  const messages = [];
  if (loadResult.migrated) messages.push('Your existing P5 prototype progress was copied into this preview. The original prototype save was left untouched.');
  if (loadResult.warning) messages.push(`Save recovery notice: ${loadResult.warning}`);
  messages.push('Walk with the keyboard arrows, WASD, or the on-screen arrows. Village signs lead to lesson battles, and each building now provides its full learning service.');
  overlay.open(`<div class="panel">
    <h1>Scholar Village engine preview</h1>
    ${messages.map(message => `<p>${message}</p>`).join('')}
    <p>Collect word spirits in battle, practise at School, complete a Reading Hall passage for the Cave Lantern, rest at the Inn, and buy Rice Balls at the Shop.</p>
    <button class="primary" data-enter-world>Enter the village</button>
  </div>`, { dismissible: false });
  $('[data-enter-world]').addEventListener('click', () => {
    active.state.session.seenWelcome = true;
    persist();
    overlay.close();
    render();
  }, { once: true });
}

async function startLevel(levelId) {
  overlay.open('<div class="panel"><h2>Opening the shared world…</h2><p>Loading curriculum, map and save data.</p></div>', { dismissible: false });
  try {
    const levelPackage = await loadLevelPackage(levelId);
    const mapErrors = validateMap(levelPackage.map);
    if (mapErrors.length) throw new Error(mapErrors.join(' '));
    const loadResult = loadLevelState(storage, levelPackage);
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
    collection = createCollection({ overlay, getActive: () => active, persist, render, toast });
    gameplay = createGameplay({ overlay, storage, getActive: () => active, persist, render, toast, onCollectionChanged: () => collection.applyMilestones() });
    collection.refreshMaxHp();
    unbindInput?.();
    unbindInput = bindInput({ dpad: $('#dpad'), onMove: move });
    startAutosave();
    render();
    if (!active.state.session.seenWelcome || loadResult.migrated || loadResult.warning) showWelcome(loadResult);
    else overlay.close();
  } catch (error) {
    console.error(error);
    overlay.open(`<div class="panel"><h2>The preview could not start</h2><p>${escapeHtml(error.message)}</p><button class="secondary" data-retry>Back to levels</button></div>`, { dismissible: false });
    $('[data-retry]').addEventListener('click', showLevelPicker, { once: true });
  }
}

function levelStatus(level) {
  if (level.worldMappingReady) return level.playableBuild === 'prototype' ? 'Engine preview ready · stable prototype also available' : 'Engine preview ready';
  if (level.sourceReady) return 'Curriculum imported · shared-world tuning comes after P5 parity';
  return 'Coming soon';
}

function showLevelPicker() {
  overlay.open(`<div class="panel">
    <h1>Choose your curriculum</h1>
    <p>Every level follows the same seven-region adventure. Learning progress is saved separately for each curriculum.</p>
    <div class="level-grid">
      ${levels.map(level => `<button class="level-card" data-level="${level.id}" ${level.worldMappingReady ? '' : 'disabled'}>
        <b>${level.label}</b><span>${levelStatus(level)}</span>
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
    <div class="panel-header"><h2>Modular build status</h2><button class="secondary" data-close-overlay>Close</button></div>
    <p>P0–P5 are complete. Region 1 now includes items, gear, crafting, partners, Restoration Sets, milestones and the player room on top of the complete learning loop.</p>
    <div class="status-grid">
      <div>Curriculum<b>${levelPackage.label}</b></div>
      <div>Content version<b>${levelPackage.content.contentVersion}</b></div>
      <div>Vocabulary loaded<b>${levelPackage.content.words.length}</b></div>
      <div>Local Hanzi loaded<b>${Object.keys(levelPackage.characters.characters).length}</b></div>
      <div>Position<b>${state.player.x}, ${state.player.y}</b></div>
      <div>Save integrity<b>${state.tampered ? 'Edited' : 'Verified'}</b></div>
    </div>
    <div class="button-row"><a class="primary" href="./lab.html">Open learning lab</a><button class="secondary" data-switch-level>Switch curriculum</button><a class="secondary" href="../prototype/">Open stable prototype</a></div>
  </div>`);
  $('[data-switch-level]').addEventListener('click', showLevelPicker, { once: true });
}

async function boot() {
  $('#status-button').addEventListener('click', showBuildStatus);
  $('#book-button').addEventListener('click', () => gameplay?.spiritBook());
  $('#character-button').addEventListener('click', () => collection?.character());
  $('#room-button').addEventListener('click', () => collection?.room());
  $('#parent-button').addEventListener('click', () => gameplay?.parentPanel());
  events.on('world:interaction', interaction => console.debug('Interaction', interaction.id));
  try {
    levels = await listLevels();
    const requestedLevel = new URLSearchParams(location.search).get('level');
    const profile = loadProfile(storage);
    const level = levels.find(candidate => candidate.id === (requestedLevel || profile?.level) && candidate.worldMappingReady);
    if (level) await startLevel(level.id);
    else showLevelPicker();
  } catch (error) {
    console.error(error);
    overlay.open(`<div class="panel"><h1>Could not load the game</h1><p>${escapeHtml(error.message)}</p><p>Serve the repository through HTTP; ES modules and content files cannot load from <code>file://</code>.</p></div>`, { dismissible: false });
  }
}

window.addEventListener('beforeunload', persist);
window.__WSQ_GAME__ = { get active() { return active; }, get gameplay() { return gameplay; }, events, startLevel };
boot();
