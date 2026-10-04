import { canCraft, craft } from './systems/crafting.js';
import { equipGear, gearBonuses, normalizeEquipment } from './systems/gear.js';
import { claimMilestones } from './systems/milestones.js';
import { eligiblePartners, partnerBonuses, setPartners } from './systems/partners.js?p10f';
import { offerSet, setProgress } from './systems/sets.js?p10f';
import { tierOf } from './learning/mastery.js?p10f';
import { escapeHtml } from './ui/dom.js';
import { goalProgress } from './systems/parent.js?p10f';
import { heroStats } from './battle/damage.js';
import { heroPortrait } from './ui/heroPortrait.js?p10o';
import { useConsumable } from './systems/inventory.js';
import { xpToNextLevel } from './core/progression.js';

const SPECIAL_ITEM_NAMES = Object.freeze({
  'cave-lantern': 'Cave Lantern',
  'grandmas-lantern': "Grandma's Lantern",
  'dawn-stroke': 'Dawn Stroke',
  'market-seal': 'Market Seal',
  'truth-stroke': 'Truth Stroke',
  'harbour-chronometer': 'Harbour Chronometer',
  'current-stroke': 'Current Stroke',
  'lantern-stage-pass': 'Lantern Stage Pass',
  'courage-stroke': 'Courage Stroke',
  'festival-medallion': 'Festival Medallion',
  'harmony-stroke': 'Harmony Stroke',
  'oracle-rubbing-kit': 'Oracle Rubbing Kit',
  'memory-stroke': 'Memory Stroke',
  'treeheart-lens': 'Treeheart Lens',
  'final-stroke': 'Final Stroke',
  'material-pouch': 'Material Pouch'
});

const RESTORATION_ICON_INDEX = Object.freeze(Object.fromEntries([
  'campfire', 'kitchen', 'healthy-eyes', 'kind-words', 'team-spirit', 'forest-shapes', 'finding-the-way',
  'safe-journey', 'open-pantry', 'clear-evidence', 'honest-breakfast', 'harbour-breakfast', 'helping-hands', 'weather-watch',
  'whale-rescue', 'future-clock', 'shore-and-sea', 'garden-friends', 'play-together', 'birthday-stage', 'mulan-stage',
  'important-things', 'kind-applause', 'pet-island-friends', 'rainbow-team', 'festival-harvest', 'martial-foundations', 'settle-the-misunderstanding',
  'national-night', 'story-roots', 'grove-night-market', 'quiet-and-lively', 'oracle-record', 'patient-team', 'ancient-tree',
  'summit-city-stories', 'summit-water-care', 'summit-open-air', 'summit-living-museum', 'summit-treehouse', 'summit-kindness'
].map((id, index) => [id, index])));

function restorationArt(id, label, extraClass = '') {
  const index = RESTORATION_ICON_INDEX[id];
  if (!Number.isInteger(index)) return '<span aria-hidden="true">✦</span>';
  return `<span class="restoration-art ${extraClass}" role="img" aria-label="${escapeHtml(label)}" style="--icon-column:${index % 7};--icon-row:${Math.floor(index / 7)}"></span>`;
}

function itemName(id) {
  return SPECIAL_ITEM_NAMES[id] || id.split('-').map(part => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`).join(' ');
}

function gearImage(id) {
  return `assets/images/gear/${id}.webp`;
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function battleItemDescription(item) {
  if (item.effect === 'heal') return `Restores at least ${item.amount} HP (${Math.round(item.healFraction * 100)}% max HP) in battle`;
  if (item.effect === 'full-heal') return 'Restores all HP in battle';
  if (item.effect === 'writing-retry') return 'Gives another writing attempt';
  if (item.effect === 'escape') return 'Guarantees escape from battle';
  if (item.effect === 'attack-boost') return `Increases attack damage by ${Math.round(item.amount * 8)}% for one battle`;
  if (item.effect === 'defense-boost') return `Reduces incoming damage by ${Math.round(item.amount * 8)}% for one battle`;
  if (item.effect === 'repellent') return `Prevents encounters for ${item.amount} forest steps`;
  if (item.effect === 'repel-mastered') return `Avoids Silver and Gold Word Spirits for ${item.amount} forest steps`;
  return item.effect;
}

export function createCollection({ overlay, getActive, persist, render, toast, audio, onTutorialAction = () => {}, tutorialStep = () => null }) {
  const active = () => getActive();
  const commit = () => { persist(); render(); };

  function collectedWords(game) {
    return game.levelPackage.content.words.filter(word => game.state.progress.words[word.w]?.collected || game.state.progress.words[word.w]?.c);
  }

  function applyMilestones() {
    const game = active();
    const collected = collectedWords(game);
    const result = claimMilestones(collected.length, game.levelPackage.milestones, game.state.progress.milestones);
    game.state.progress.milestones = result.claimed;
    const equipment = normalizeEquipment(game.state.progress.equipment);
    for (const milestone of result.due) {
      if (game.levelPackage.gear.some(gear => gear.id === milestone.reward) && !equipment.owned.includes(milestone.reward)) equipment.owned.push(milestone.reward);
      else game.state.progress.inventory[milestone.reward] = 1;
    }
    if (collected.length === game.levelPackage.content.words.length && !equipment.owned.includes('gold-crown')) {
      equipment.owned.push('gold-crown');
      game.state.progress.room.trophies.push('Word Sage');
    }
    const goldCount = collected.filter(word => tierOf(game.state.progress.words[word.w]) === 'gold').length;
    for (const count of [10, 30, 60, 100]) {
      const decoration = `gold-${count}`;
      if (goldCount >= count && !game.state.progress.room.decorations.includes(decoration)) game.state.progress.room.decorations.push(decoration);
    }
    game.state.progress.equipment = equipment;
    if (result.due.length) {
      audio?.sfx('majorReward');
      toast(`Milestone reward: ${result.due.map(item => item.name).join(', ')}`);
    }
    return result.due;
  }

  function refreshMaxHp() {
    const game = active();
    const gear = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const wordsById = Object.fromEntries(game.levelPackage.content.words.map(word => [word.id, word]));
    const partners = partnerBonuses(game.state.progress.partners, wordsById, game.state.progress.words);
    game.state.player.maxHp = 18 + game.state.player.level * 2 + gear.maxHp + partners.maxHp;
    game.state.player.hp = Math.min(game.state.player.hp, game.state.player.maxHp);
  }

  function character() {
    const game = active();
    applyMilestones();
    const equipment = normalizeEquipment(game.state.progress.equipment);
    const bonuses = gearBonuses(equipment, game.levelPackage.gear);
    const stats = heroStats(game.state.player.level);
    const xpNeeded = xpToNextLevel(game.state.player.level);
    const xpPercent = Math.min(100, game.state.player.xp / xpNeeded * 100);
    overlay.open(`<div class="panel hero-status-panel"><div class="panel-header"><div><p class="panel-kicker">Main character</p><h1>Hero Status</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="character-preview">${heroPortrait(equipment.equipped, 'paper-hero')}<div class="hero-level"><b>Level ${game.state.player.level}</b><span>${game.state.player.xp}/${xpNeeded} XP to Level ${game.state.player.level + 1}</span><div class="hero-xp" role="progressbar" aria-label="Experience toward next level" aria-valuemin="0" aria-valuemax="${xpNeeded}" aria-valuenow="${game.state.player.xp}"><i style="width:${xpPercent}%"></i></div></div></div><div class="hero-stat-grid"><div><span>Health</span><b>${game.state.player.hp}/${game.state.player.maxHp}</b></div><div><span>Attack</span><b>${stats.attack}</b></div><div><span>Defence</span><b>${stats.defense}</b></div><div><span>Evasion</span><b>${Math.round((stats.evasion + bonuses.evasion) * 100)}%</b></div><div><span>Coins</span><b>${game.state.player.coins}</b></div><div><span>Battles won</span><b>${game.state.progress.battles || 0}</b></div></div><section class="equipment-section"><h2>Equipment</h2><p>Equipped gear currently adds +${bonuses.maxHp} maximum HP, +${Math.round(bonuses.evasion * 100)}% evasion, and +${Math.round(bonuses.xp * 100)}% XP.</p><div class="gear-grid">${game.levelPackage.gear.map(gear => { const owned = equipment.owned.includes(gear.id); const equipped = equipment.equipped[gear.slot] === gear.id; return `<article class="gear-card ${equipped ? 'is-equipped' : ''} ${owned ? '' : 'is-locked'}"><img src="${gearImage(gear.id)}" alt="" width="72" height="72"><div><b>${escapeHtml(gear.name)}</b><span>${escapeHtml(gear.slot)} · ${escapeHtml(gear.effect)}</span></div><button data-equip="${gear.id}" ${owned && !equipped ? '' : 'disabled'}>${equipped ? 'Equipped' : owned ? 'Equip' : 'Not earned'}</button></article>`; }).join('')}</div></section><div class="button-row"><button class="primary" data-craft-open>Craft Table</button></div></div>`);
    for (const button of document.querySelectorAll('[data-equip]:not([disabled])')) button.addEventListener('click', () => {
      const gear = game.levelPackage.gear.find(item => item.id === button.dataset.equip);
      game.state.progress.equipment = equipGear(game.state.progress.equipment, gear);
      refreshMaxHp();
      commit();
      character();
    });
    document.querySelector('[data-craft-open]').addEventListener('click', () => crafting());
  }

  function crafting(craftedName = null) {
    const game = active();
    const owned = normalizeEquipment(game.state.progress.equipment).owned;
    overlay.open(`<div class="panel craft-panel"><div class="panel-header"><div><p class="panel-kicker">Workshop</p><h1>Craft Table</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Coins: <b>${game.state.player.coins}</b>. Each piece of gear can be crafted once.</p><p class="craft-message ${craftedName ? 'craft-success' : ''}" data-craft-message role="status" tabindex="-1" ${craftedName ? '' : 'hidden'}>${craftedName ? `${escapeHtml(craftedName)} crafted! Find it in Hero Status or your Bag.` : ''}</p><div class="gear-grid">${game.levelPackage.recipes.map(recipe => {
      const crafted = owned.includes(recipe.id);
      const ready = canCraft(recipe, game.state.player, game.state.progress.materials, game.state.progress.equipment);
      const label = crafted ? 'Crafted' : ready ? 'Craft' : game.state.player.coins < recipe.coins ? 'Need coins' : 'Need materials';
      return `<article class="craft-card ${crafted ? 'is-crafted' : ready ? 'is-ready' : 'is-missing'}"><b>${escapeHtml(recipe.name)}</b><div class="craft-requirements"><span class="${game.state.player.coins >= recipe.coins ? 'has-enough' : 'needs-more'}">Coins ${game.state.player.coins}/${recipe.coins}</span>${Object.entries(recipe.materials).map(([id, count]) => `<span class="${(game.state.progress.materials[id] || 0) >= count ? 'has-enough' : 'needs-more'}">${escapeHtml(itemName(id))} ${game.state.progress.materials[id] || 0}/${count}</span>`).join('')}</div><button class="${ready ? 'primary' : ''}" data-craft="${recipe.id}" ${ready ? '' : 'disabled'}>${label}</button></article>`;
    }).join('')}</div></div>`);
    onTutorialAction('open-craft');
    if (craftedName) document.querySelector('[data-craft-message]')?.focus();
    for (const button of document.querySelectorAll('[data-craft]:not([disabled])')) button.addEventListener('click', () => {
      const recipe = game.levelPackage.recipes.find(item => item.id === button.dataset.craft);
      const result = craft(recipe, game.state.player, game.state.progress.materials, game.state.progress.equipment);
      if (!result.ok) {
        const message = document.querySelector('[data-craft-message]');
        if (message) {
          message.hidden = false;
          message.textContent = 'You need more coins or materials for that recipe.';
          message.setAttribute('role', 'alert');
          message.focus();
        }
        return;
      }
      game.state.player = result.player;
      game.state.progress.materials = result.materials;
      game.state.progress.equipment = result.equipment;
      commit();
      crafting(recipe.name);
    });
  }

  function bag() {
    const game = active();
    applyMilestones();
    const inventory = game.state.progress.inventory || {};
    const battleItems = game.levelPackage.items.filter(item => (inventory[item.id] || 0) > 0);
    const itemIds = new Set(game.levelPackage.items.map(item => item.id));
    const keyItems = [...new Set(inventory.keyItems || [])];
    const specialItems = Object.entries(inventory).filter(([id, count]) => id !== 'keyItems' && !itemIds.has(id) && Number(count) > 0);
    const equipment = normalizeEquipment(game.state.progress.equipment);
    const ownedGear = equipment.owned.map(id => game.levelPackage.gear.find(item => item.id === id)).filter(Boolean);
    const materials = Object.entries(game.state.progress.materials || {}).filter(([, count]) => Number(count) > 0);
    const baits = game.state.progress.baits || [];
    const scrolls = game.state.progress.scrolls?.unlocked || [];
    const total = battleItems.reduce((sum, item) => sum + Number(inventory[item.id] || 0), 0) + keyItems.length + specialItems.reduce((sum, [, count]) => sum + Number(count), 0) + ownedGear.length + materials.reduce((sum, [, count]) => sum + Number(count), 0) + baits.length + scrolls.length;
    const empty = message => `<p class="bag-empty">${message}</p>`;
    const activeEffects = [game.state.progress.encounter.repellentSteps > 0 ? `Forest Repellent: ${game.state.progress.encounter.repellentSteps} steps` : '', game.state.progress.encounter.scholarsLanternSteps > 0 ? `Scholar's Lantern: ${game.state.progress.encounter.scholarsLanternSteps} steps` : ''].filter(Boolean);
    const illustratedKeys = ['cave-lantern', 'dawn-stroke', 'market-seal', 'truth-stroke', 'harbour-chronometer', 'current-stroke', 'lantern-stage-pass', 'courage-stroke', 'festival-medallion', 'harmony-stroke', 'oracle-rubbing-kit', 'memory-stroke', 'treeheart-lens', 'final-stroke'];
    overlay.open(`<div class="panel bag-panel"><div class="panel-header"><div><p class="panel-kicker">Everything you carry</p><h1>Bag</h1></div><button class="secondary" data-close-overlay>Close</button></div><p class="bag-summary"><b>${total}</b> owned items across all collections. Battle boosts are used during battle; repellents and the Scholar’s Lantern can be activated here.</p>${activeEffects.length ? `<p class="bag-summary">Active: ${activeEffects.join(' · ')}</p>` : ''}<div class="bag-grid"><section class="bag-section battle-supplies"><h2>Supplies <span>${battleItems.reduce((sum, item) => sum + Number(inventory[item.id] || 0), 0)}</span></h2>${battleItems.length ? `<div class="bag-list">${battleItems.map(item => `<article><b>${escapeHtml(item.name)}</b><span>${escapeHtml(battleItemDescription(item))}</span><strong>×${inventory[item.id]}</strong>${['repellent', 'repel-mastered'].includes(item.effect) ? `<button data-use-repellent="${item.id}">Use</button>` : ''}</article>`).join('')}</div>` : empty('No supplies yet. Visit the village shop.')}</section><section class="bag-section special-items"><h2>Special items <span>${keyItems.length + specialItems.length}</span></h2>${keyItems.length || specialItems.length ? `<div class="bag-list">${keyItems.map(id => `<article class="${illustratedKeys.includes(id) ? 'illustrated-item' : ''}">${illustratedKeys.includes(id) ? `<img class="bag-item-art" src="assets/images/rewards/${id}.webp" alt="">` : ''}<b>${escapeHtml(itemName(id))}</b><span>Key item</span><strong>◆</strong></article>`).join('')}${specialItems.map(([id, count]) => `<article><b>${escapeHtml(itemName(id))}</b><span>Special reward</span><strong>×${count}</strong></article>`).join('')}</div>` : empty('Important story and milestone items will appear here.')}</section><section class="bag-section equipment-items"><h2>Equipment <span>${ownedGear.length}</span></h2>${ownedGear.length ? `<div class="bag-list">${ownedGear.map(gear => { const equipped = equipment.equipped[gear.slot] === gear.id; return `<article><b>${escapeHtml(gear.name)}</b><span>${equipped ? 'Equipped' : 'Owned'} · ${escapeHtml(gear.slot)}</span><strong>${equipped ? '✓' : '○'}</strong></article>`; }).join('')}</div>` : empty('No equipment collected.')}</section><section class="bag-section material-items"><h2>Materials <span>${materials.reduce((sum, [, count]) => sum + Number(count), 0)}</span></h2>${materials.length ? `<div class="bag-list">${materials.map(([id, count]) => `<article><b>${escapeHtml(itemName(id))}</b><span>Crafting material</span><strong>×${count}</strong></article>`).join('')}</div>` : empty('Creature drops used at the Craft Table will appear here.')}</section><section class="bag-section bait-items"><h2>Spirit bait <span>${baits.length}</span></h2>${baits.length ? `<div class="bag-list">${baits.map(bait => `<article><b>${escapeHtml(bait.word || `Lesson ${bait.lesson} bait`)}</b><span>Lesson ${bait.lesson} · controls the next encounter</span><strong>×1</strong></article>`).join('')}</div>` : empty('No bait prepared. Choose exact-word bait in the village shop.')}</section><section class="bag-section scroll-items"><h2>Scrolls <span>${scrolls.length}</span></h2>${scrolls.length ? `<div class="bag-scrolls">${scrolls.map(scroll => `<details><summary><b>${escapeHtml(scroll.title || 'Untitled scroll')}</b><span>${escapeHtml(scroll.type || 'Scroll')}</span></summary><p>${escapeHtml(scroll.text || 'This scroll has no written text.')}</p>${scroll.day ? `<small>Found ${escapeHtml(scroll.day)}</small>` : ''}</details>`).join('')}</div>` : empty('Reading Hall and Mystery Scroll discoveries will be stored here.')}</section></div></div>`);
    for (const button of document.querySelectorAll('[data-use-repellent]')) button.addEventListener('click', event => {
      const item = game.levelPackage.items.find(candidate => candidate.id === event.currentTarget.dataset.useRepellent);
      const consumed = useConsumable(game.state.progress.inventory, item.id);
      if (!consumed.ok) return;
      game.state.progress.inventory = consumed.inventory;
      const field = item.effect === 'repel-mastered' ? 'scholarsLanternSteps' : 'repellentSteps';
      game.state.progress.encounter[field] = Math.max(game.state.progress.encounter[field] || 0, item.amount || 40);
      commit();
      toast(`${item.name} active for ${item.amount || 40} forest steps.`);
      bag();
    }, { once: true });
  }

  function partners() {
    const game = active();
    const eligible = eligiblePartners(game.levelPackage.content.words, game.state.progress.words);
    const eligibleIds = eligible.map(word => word.id);
    overlay.open(`<div class="panel partner-panel"><div class="panel-header"><div><p class="panel-kicker">Travelling party</p><h1>Choose Partner Spirits</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Choose up to three Silver or Gold Spirits. All selected partners follow you on the map; the first Gold partner leads your once-per-battle move.</p>${tutorialStep() === 8 ? '<p class="tutorial-overlay-reminder">Tap a Silver Spirit card, then tap “Travel with selected spirits.”</p>' : ''}${eligible.length ? `<p class="partner-count" data-partner-count>${game.state.progress.partners.length}/3 travelling</p><div class="spirit-grid">${eligible.map(word => `<label class="spirit-card partner-choice ${tierOf(game.state.progress.words[word.w])}"><input type="checkbox" data-partner="${word.id}" ${game.state.progress.partners.includes(word.id) ? 'checked' : ''}> <b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.m)}</span></label>`).join('')}</div><div class="button-row"><button class="primary" data-save-partners>Travel with selected spirits</button></div>` : '<p>No spirits are Silver yet. Complete three skill stars to make one eligible.</p>'}</div>`);
    for (const input of document.querySelectorAll('[data-partner]')) input.addEventListener('change', () => {
      const selected = [...document.querySelectorAll('[data-partner]:checked')];
      if (selected.length > 3) {
        input.checked = false;
        toast('Your travelling party can have up to three Partner Spirits.');
      }
      const count = document.querySelector('[data-partner-count]');
      if (count) count.textContent = `${document.querySelectorAll('[data-partner]:checked').length}/3 travelling`;
      onTutorialAction('partner-selection');
    });
    document.querySelector('[data-save-partners]')?.addEventListener('click', () => {
      const guidedChoice = tutorialStep() === 8;
      const selected = [...document.querySelectorAll('[data-partner]:checked')].map(input => input.dataset.partner);
      game.state.progress.partners = setPartners(game.state.progress.partners, selected, eligibleIds);
      refreshMaxHp();
      commit();
      toast(`${game.state.progress.partners.length || 'No'} Partner Spirit${game.state.progress.partners.length === 1 ? '' : 's'} travelling with you.`);
      onTutorialAction('partners-saved');
      if (guidedChoice && game.state.progress.partners.length) overlay.close();
      else room();
    });
  }

  function restorationBoard() {
    const game = active();
    const completed = game.state.progress.sets;
    const states = game.levelPackage.sets.map(set => ({ set, ...setProgress(set, game.state.progress.words, game.levelPackage.content.words), completed: Boolean(completed[set.id]) })).filter(state => state.words.length >= 3);
    const first = states[0];
    const firstReady = first?.words.filter(word => ['silver', 'gold'].includes(tierOf(game.state.progress.words[word]))).length || 0;
    if (tutorialStep() === 9 && first && !game.state.progress.tutorial.boardExplained) {
      game.state.progress.tutorial.boardExplained = true;
      commit();
      onTutorialAction('open-board');
      overlay.tutorialDialogue([`This first set is ${first.set.name}. You have ${firstReady} of the ${first.words.length} Silver Spirits it needs.`, firstReady === first.words.length ? 'It is ready to restore now. That will earn a decoration for your room.' : 'Grow the remaining Spirits to Silver to earn a decoration for your room. You can finish the set later.'], () => restorationBoard());
      return;
    }
    const junNote = tutorialStep() === 9 && first ? '<div class="button-row tutorial-board-note"><button type="button" class="primary" data-tutorial-board-done>I see what this set needs</button></div>' : '';
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)}</p><h1>Restoration Board</h1></div><button class="secondary" data-close-overlay>Close</button></div><aside class="board-explainer"><b>Repair the region with mastered words</b><span>Raise every Spirit card in a themed set to Silver or Gold, then offer the completed set to restore part of ${escapeHtml(game.levelPackage.region.name)} and earn a room decoration. Your Spirit cards are never consumed.</span></aside>${junNote}<div class="set-grid">${states.map(state => `<article class="set-card ${state.completed ? 'complete' : ''}"><h2>${escapeHtml(state.set.name)}</h2><p>${state.words.map(word => `${['silver','gold'].includes(tierOf(game.state.progress.words[word])) ? '✓' : '○'} ${escapeHtml(word)}`).join(' · ')}</p><small>${escapeHtml(state.set.restoration)}</small><button data-offer="${state.set.id}" ${state.ready && !state.completed ? '' : 'disabled'}>${state.completed ? 'Restored' : state.ready ? 'Restore region' : 'Keep learning'}</button></article>`).join('') || '<p>No Restoration Sets are available for this curriculum yet.</p>'}</div></div>`);
    onTutorialAction('open-board');
    document.querySelector('[data-tutorial-board-done]')?.addEventListener('click', () => {
      onTutorialAction('board-acknowledged');
      overlay.close();
    }, { once: true });
    for (const button of document.querySelectorAll('[data-offer]:not([disabled])')) button.addEventListener('click', () => {
      const state = states.find(item => item.set.id === button.dataset.offer);
      const result = offerSet(state.set, state);
      if (!result.completed) return;
      game.state.progress.sets[state.set.id] = true;
      addUnique(game.state.progress.room.decorations, state.set.id);
      if (states.every(item => item.set.id === state.set.id || item.completed)) addUnique(game.state.progress.room.trophies, `${game.levelPackage.region.name} Trophy`);
      commit();
      audio?.sfx('majorReward');
      overlay.open(`<div class="panel restoration-reveal"><div class="restoration-radiance" aria-hidden="true"></div>${restorationArt(state.set.id, `${state.set.name} decoration`, 'restoration-reward-art')}<p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)} restored</p><h1>${escapeHtml(state.set.name)} lives again!</h1><p>${escapeHtml(result.restoration)}</p><p class="restoration-room-note">A keepsake has appeared in My Room.</p><button class="primary" data-restoration-continue>Place it in my room</button></div>`, { dismissible: false });
      document.querySelector('[data-restoration-continue]').addEventListener('click', room, { once: true });
    });
  }

  function room() {
    const game = active();
    applyMilestones();
    const travellingPartners = game.state.progress.partners.map(id => game.levelPackage.content.words.find(word => word.id === id)).filter(Boolean);
    const gold = Object.values(game.state.progress.words).filter(value => tierOf(value) === 'gold').length;
    const goal = goalProgress(game.state.progress.parent.goal, game.state, gold);
    if (goal?.complete && !game.state.progress.parent.goal.celebrated) { game.state.progress.parent.goal.celebrated = true; commit(); toast(`Goal reached: ${goal.label}!`); }
    const hasSets = game.levelPackage.sets.some(set => setProgress(set, game.state.progress.words, game.levelPackage.content.words).words.length >= 3);
    const trophies = game.state.progress.room.trophies;
    const decorations = game.state.progress.room.decorations;
    const trophyArt = name => {
      const id = Object.keys(SPECIAL_ITEM_NAMES).find(key => SPECIAL_ITEM_NAMES[key] === name);
      return id && ['dawn-stroke', 'truth-stroke', 'current-stroke', 'courage-stroke', 'harmony-stroke', 'memory-stroke', 'final-stroke'].includes(id)
        ? `<img src="assets/images/rewards/${id}.webp" alt="">`
        : '<span aria-hidden="true">✦</span>';
    };
    overlay.open(`<div class="panel room-panel">
      <div class="panel-header room-header"><div><p class="panel-kicker">Grandma Wang's house</p><h1>My Room</h1><p>A place for your partners and the things you have restored.</p></div><button class="secondary" data-close-overlay>Leave room</button></div>
      <div class="room-scene" role="img" aria-label="Warm bedroom with trophy shelf, village window, desk and bed">
        <div class="room-shelf-count"><b>${trophies.length}</b><span>keepsakes earned</span></div>
        <div class="room-restoration-display" aria-label="Restoration keepsakes displayed in the room">${decorations.slice(-4).map(id => restorationArt(id, `${itemName(id)} decoration`)).join('')}</div>
        <div class="room-companion-nook"><b>Partner Spirits</b><div>${travellingPartners.length ? travellingPartners.map(word => `<span class="room-spirit" title="${escapeHtml(word.m)}">${escapeHtml(word.w)}</span>`).join('') : '<span class="room-companion-empty">Your chosen spirits will appear here.</span>'}</div></div>
      </div>
      <div class="room-progress"><section class="room-streak"><span>Lantern Streak</span><b>${game.state.progress.streak?.count || 0} days</b></section>${goal ? `<section class="room-goal ${goal.complete ? 'complete' : ''}"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div role="progressbar" aria-label="Real-world goal progress" aria-valuemin="0" aria-valuemax="${goal.target}" aria-valuenow="${goal.value}"><i style="width:${goal.percent}%"></i></div></section>` : '<section class="room-goal room-goal-empty"><b>Real-world goal</b><span>A parent can add a goal in Parent Mode.</span></section>'}</div>
      <section class="room-keepsakes"><div class="room-section-heading"><h2>What you have earned</h2><span>${trophies.length} trophies · ${decorations.length} decorations</span></div>${trophies.length || decorations.length ? `<div class="room-keepsake-grid">${trophies.map(name => `<div class="room-keepsake">${trophyArt(name)}<b>${escapeHtml(name)}</b></div>`).join('')}${decorations.map(id => `<div class="room-keepsake room-decoration">${restorationArt(id, `${itemName(id)} decoration`)}<b>${escapeHtml(itemName(id))}</b></div>`).join('')}</div>` : '<p class="room-empty">Your shelf will fill as you restore regions and complete Spirit sets.</p>'}</section>
      <div class="room-action-grid"><button type="button" class="room-action" data-room-partners><b>Choose Partner Spirits</b><span>Pick up to three Silver or Gold Spirits to travel with you.</span></button>${hasSets ? `<button type="button" class="room-action" data-board-open><b>View Restoration Board</b><span>Offer complete Spirit sets to repair ${escapeHtml(game.levelPackage.region.name)}.</span></button>` : ''}</div>
      <div class="room-explainers"><details><summary>What are Partner Spirits?</summary><p>Silver partners increase your maximum HP. Gold partners increase it further and may unlock a battle move.</p></details>${hasSets ? `<details><summary>What is the Restoration Board?</summary><p>Raise every Spirit card in a themed set to Silver or Gold, then restore part of ${escapeHtml(game.levelPackage.region.name)}. Your cards are never used up.</p></details>` : ''}</div>
    </div>`);
    document.querySelector('[data-board-open]')?.addEventListener('click', restorationBoard);
    document.querySelector('[data-room-partners]').addEventListener('click', partners);
  }

  return { bag, character, crafting, partners, restorationBoard, room, applyMilestones, refreshMaxHp };
}
