import { createEventBus } from './core/events.js';
import { loadLevelState, loadProfile, saveLevelState, saveProfile } from './core/save.js?p8b';
import { listLevels, loadLevelPackage } from './content/loader.js?p8b';
import { attemptStep, isWalkable, validateMap } from './world/map.js';
import { createRenderer } from './world/renderer.js?p8b';
import { bindInput } from './world/input.js';
import { $, escapeHtml } from './ui/dom.js';
import { createOverlay } from './ui/overlay.js';
import { updateHud } from './ui/hud.js';
import { createToast } from './ui/toast.js';
import { createGameplay } from './gameplay.js?p8b';
import { createCollection } from './collection.js?p8b';
import { createAdventure } from './adventure.js?p8b';
import { createAudioManager } from './core/audio.js?p8b';
import { localDay } from './core/time.js';
import { encounterStep } from './world/encounters.js?p8b';
import { restoreNpcPositions, wanderNpcs } from './world/npcs.js?p8b';
import { tierOf } from './learning/mastery.js';

const storage = window.localStorage;
const overlay = createOverlay($('#overlay'));
const toast = createToast($('#toast'));
const events = createEventBus();
const audio = createAudioManager();
const hud = {
  level: $('#hud-level'),
  location: $('#hud-location'),
  playerLevel: $('#hud-player-level'),
  xp: $('#hud-xp'),
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
let objectiveTimer = null;
let objectiveIndex = 0;
let gameplay = null;
let collection = null;
let adventure = null;

function render() {
  if (!active) return;
  active.renderer.render(active.state);
  updateHud(hud, active.levelPackage, active.state);
  updateObjective();
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
    const spot = adventure?.scrollSpot();
    if (spot && result.player.x === spot.x && result.player.y === spot.y) adventure.collectDailyScroll();
    const encounter = encounterStep(active.state.progress.encounter, active.levelPackage.map, result.player);
    active.state.progress.encounter = encounter.state;
    if (encounter.entered) toast(`${encounter.entered.name} · Lesson ${encounter.entered.lesson}`);
    persist();
    if (encounter.encounter) {
      if (gameplay.battlesLeft() === 0) {
        if (active.state.progress.encounter.capNoticeDay !== localDay()) {
          active.state.progress.encounter.capNoticeDay = localDay();
          persist();
          overlay.dialogue({ title: 'The creatures are asleep', lines: ['You have reached today’s battle limit. Stories, writing, School and the Scroll Library are still open. A parent can add five battles from the Parent Panel.'] });
        } else toast(active.levelPackage.strings.battleCap);
      } else gameplay.startBattle(encounter.zone);
    }
  } else if (result.interaction) {
    events.emit('world:interaction', result.interaction);
    if (!gameplay?.handleInteraction(result.interaction) && !adventure?.handleInteraction(result.interaction)) overlay.dialogue(result.interaction.interaction);
  }
  render();
}

function startAutosave() {
  clearInterval(autosave);
  autosave = setInterval(() => {
    if (!active || overlay.isOpen) return;
    active.state.session.playMs += 5000;
    const today = localDay();
    const entry = active.state.progress.activity[today] || { battles: 0, school: 0, reading: 0, writing: 0, minutes: 0 };
    active.state.progress.activity[today] = { ...entry, minutes: entry.minutes + 1 / 12 };
    persist();
  }, 5000);
}

function objectiveTasks() {
  if (!active) return [];
  const game = active;
  const words = game.levelPackage.content.words.filter(word => game.levelPackage.config.regionLessons.r1.includes(word.lesson));
  const tasks = [];
  const reading = game.state.progress.reading;
  if (reading.active) tasks.push(`Answer the villagers’ passage questions: ${Object.keys(reading.results || {}).length}/${reading.questionCount}.`);
  else if (!(reading.completed || []).length) tasks.push('Read a passage in the Reading Hall to earn the Cave Lantern.');
  for (const zone of game.levelPackage.map.zones) {
    const lessonWords = words.filter(word => word.lesson === zone.lesson);
    const collected = lessonWords.filter(word => game.state.progress.words[word.w]?.collected).length;
    if (collected < lessonWords.length) tasks.push(`Explore ${zone.name} and collect Lesson ${zone.lesson} spirits (${collected}/${lessonWords.length}).`);
  }
  const runs = game.state.progress.school.day === localDay() ? game.state.progress.school.runs : 0;
  if (runs < 3) tasks.push(`Take a rewarded quiz or tingxie session at School (${3 - runs} left today).`);
  const unread = game.levelPackage.regionStory.stories.length - game.state.progress.story.storiesRead.length;
  if (unread > 0) tasks.push(`Hear an unread story from the Storyteller (${unread} left).`);
  if (game.state.player.hp < game.state.player.maxHp / 2) tasks.push('Your HP is low. Rest and review at the Inn.');
  const silver = words.filter(word => ['silver', 'gold'].includes(tierOf(game.state.progress.words[word.w]))).length;
  const required = Math.ceil(words.length * game.levelPackage.regionStory.gateSilverPct);
  if (!game.state.progress.story.bossDefeated && silver < required) tasks.push(`Raise ${required - silver} more spirits to Silver for the Muddle Cave gate.`);
  else if (!game.state.progress.story.bossDefeated) tasks.push('The Muddle Cave gate is ready. Challenge the Muddle King!');
  return tasks.length ? tasks : ['Region 1 is clear. Keep turning spirits Gold while the next region is built.'];
}

function updateObjective(advance = false) {
  const tasks = objectiveTasks();
  if (!tasks.length) return;
  if (advance) objectiveIndex = (objectiveIndex + 1) % tasks.length;
  else objectiveIndex = Math.min(objectiveIndex, tasks.length - 1);
  $('#objective-text').textContent = tasks[objectiveIndex];
}

function startWorldTimers() {
  clearInterval(wanderTimer);
  clearInterval(objectiveTimer);
  wanderTimer = setInterval(() => {
    if (!active || overlay.isOpen) return;
    active.state.progress.npcs = wanderNpcs(active.levelPackage.map, active.state.player, active.state.progress.npcs);
    render();
  }, 2200);
  objectiveTimer = setInterval(() => updateObjective(true), 60000);
  updateObjective();
}

function showWelcome(loadResult) {
  const messages = [];
  if (loadResult.migrated) messages.push('Your existing P5 prototype progress was copied into this preview. The original prototype save was left untouched.');
  if (loadResult.warning) messages.push(`Save recovery notice: ${loadResult.warning}`);
  messages.push('Walk with the keyboard arrows, WASD, or the on-screen arrows. Open Adventure to begin the Region 1 story, or explore the village in any order.');
  overlay.open(`<div class="panel">
    <h1>Scholar Village engine preview</h1>
    ${messages.map(message => `<p>${message}</p>`).join('')}
    <p>Collect word spirits, help the muddled villagers, complete daily quests, earn the Cave Lantern, and challenge the Muddle King.</p>
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
    restoreNpcPositions(levelPackage.map, active.state.progress.npcs);
    collection = createCollection({ overlay, getActive: () => active, persist, render, toast });
    gameplay = createGameplay({ overlay, storage, getActive: () => active, persist, render, toast, audio, onSwitchLevel: showLevelPicker, onCollectionChanged: () => collection.applyMilestones(), onProgressEvent: (event, payload) => adventure?.recordEvent(event, payload) });
    adventure = createAdventure({ overlay, getActive: () => active, persist, render, toast, gameplay, audio });
    adventure.initialize();
    collection.refreshMaxHp();
    unbindInput?.();
    unbindInput = bindInput({ dpad: $('#dpad'), onMove: move });
    startAutosave();
    startWorldTimers();
    audio.setEnabled(active.state.settings.sound);
    audio.setScene('village');
    $('#sound-button').textContent = active.state.settings.sound ? 'Sound on' : 'Sound off';
    $('#sound-button').setAttribute('aria-pressed', String(active.state.settings.sound));
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
    <p>P0–P8 are complete. Region 1 now has random tall-grass encounters, full creature presentation and audio, daily quests, the complete village story, and parent goals, summaries and save transfer.</p>
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
  $('#daily-button').addEventListener('click', () => adventure?.questBoard());
  $('#story-button').addEventListener('click', () => adventure?.storyJournal());
  $('#parent-button').addEventListener('click', () => gameplay?.parentPanel());
  $('#sound-button').addEventListener('click', event => {
    if (!active) return;
    active.state.settings.sound = !active.state.settings.sound;
    audio.setEnabled(active.state.settings.sound);
    event.currentTarget.textContent = active.state.settings.sound ? 'Sound on' : 'Sound off';
    event.currentTarget.setAttribute('aria-pressed', String(active.state.settings.sound));
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
    if (level) await startLevel(level.id);
    else showLevelPicker();
  } catch (error) {
    console.error(error);
    overlay.open(`<div class="panel"><h1>Could not load the game</h1><p>${escapeHtml(error.message)}</p><p>Serve the repository through HTTP; ES modules and content files cannot load from <code>file://</code>.</p></div>`, { dismissible: false });
  }
}

window.addEventListener('beforeunload', persist);
window.__WSQ_GAME__ = { get active() { return active; }, get gameplay() { return gameplay; }, get adventure() { return adventure; }, events, startLevel };
boot();
