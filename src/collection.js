import { craft } from './systems/crafting.js';
import { equipGear, gearBonuses, normalizeEquipment } from './systems/gear.js';
import { claimMilestones } from './systems/milestones.js';
import { eligiblePartners, partnerBonuses, setPartners } from './systems/partners.js?p10f';
import { offerSet, setProgress } from './systems/sets.js?p10f';
import { tierOf } from './learning/mastery.js?p10f';
import { escapeHtml } from './ui/dom.js';
import { goalProgress } from './systems/parent.js?p10f';
import { heroStats } from './battle/damage.js';
import { heroPortrait } from './ui/heroPortrait.js?p10n';
import { useConsumable } from './systems/inventory.js';

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
  'material-pouch': 'Material Pouch'
});

function itemName(id) {
  return SPECIAL_ITEM_NAMES[id] || id.split('-').map(part => `${part[0]?.toUpperCase() || ''}${part.slice(1)}`).join(' ');
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function battleItemDescription(item) {
  if (item.effect === 'heal') return `Restores ${item.amount} HP in battle`;
  if (item.effect === 'full-heal') return 'Restores all HP in battle';
  if (item.effect === 'remove-option') return 'Removes one wrong answer option';
  if (item.effect === 'writing-retry') return 'Gives another writing attempt';
  if (item.effect === 'escape') return 'Guarantees escape from battle';
  if (item.effect === 'double-coins') return 'Doubles coins from one battle';
  if (item.effect === 'attack-boost') return `Adds ${item.amount} attack damage for one battle`;
  if (item.effect === 'defense-boost') return `Reduces incoming damage by ${item.amount} for one battle`;
  if (item.effect === 'repellent') return `Prevents encounters for ${item.amount} forest steps`;
  return item.effect;
}

export function createCollection({ overlay, getActive, persist, render, toast, audio }) {
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
    const xpNeeded = game.state.player.level * 30;
    const xpPercent = Math.min(100, game.state.player.xp / xpNeeded * 100);
    overlay.open(`<div class="panel hero-status-panel"><div class="panel-header"><div><p class="panel-kicker">Main character</p><h1>Hero Status</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="character-preview">${heroPortrait(equipment.equipped, 'paper-hero')}<div class="hero-level"><b>Level ${game.state.player.level}</b><span>${game.state.player.xp}/${xpNeeded} XP to Level ${game.state.player.level + 1}</span><div class="hero-xp" role="progressbar" aria-label="Experience toward next level" aria-valuemin="0" aria-valuemax="${xpNeeded}" aria-valuenow="${game.state.player.xp}"><i style="width:${xpPercent}%"></i></div></div></div><div class="hero-stat-grid"><div><span>Health</span><b>${game.state.player.hp}/${game.state.player.maxHp}</b></div><div><span>Attack</span><b>${stats.attack}</b></div><div><span>Defence</span><b>${stats.defense}</b></div><div><span>Evasion</span><b>${Math.round((stats.evasion + bonuses.evasion) * 100)}%</b></div><div><span>Coins</span><b>${game.state.player.coins}</b></div><div><span>Battles won</span><b>${game.state.progress.battles || 0}</b></div></div><section class="equipment-section"><h2>Equipment</h2><p>Equipped gear currently adds +${bonuses.maxHp} maximum HP, +${Math.round(bonuses.evasion * 100)}% evasion, and +${Math.round(bonuses.xp * 100)}% XP.</p><div class="gear-grid">${game.levelPackage.gear.map(gear => { const owned = equipment.owned.includes(gear.id); const equipped = equipment.equipped[gear.slot] === gear.id; return `<article><b>${escapeHtml(gear.name)}</b><span>${escapeHtml(gear.slot)} · ${escapeHtml(gear.effect)}</span><button data-equip="${gear.id}" ${owned && !equipped ? '' : 'disabled'}>${equipped ? 'Equipped' : owned ? 'Equip' : 'Not earned'}</button></article>`; }).join('')}</div></section><div class="button-row"><button class="primary" data-craft-open>Craft Table</button></div></div>`);
    for (const button of document.querySelectorAll('[data-equip]:not([disabled])')) button.addEventListener('click', () => {
      const gear = game.levelPackage.gear.find(item => item.id === button.dataset.equip);
      game.state.progress.equipment = equipGear(game.state.progress.equipment, gear);
      refreshMaxHp();
      commit();
      character();
    });
    document.querySelector('[data-craft-open]').addEventListener('click', crafting);
  }

  function crafting() {
    const game = active();
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Workshop</p><h1>Craft Table</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Materials: ${Object.entries(game.state.progress.materials).map(([id, count]) => `${escapeHtml(id)} × ${count}`).join(' · ') || 'None yet'}</p><p class="craft-message" data-craft-message role="alert" tabindex="-1" hidden></p><div class="gear-grid">${game.levelPackage.recipes.map(recipe => `<article><b>${escapeHtml(recipe.name)}</b><span>${recipe.coins} coins · ${Object.entries(recipe.materials).map(([id, count]) => `${escapeHtml(id)} × ${count}`).join(', ')}</span><button data-craft="${recipe.id}">Craft</button></article>`).join('')}</div></div>`);
    for (const button of document.querySelectorAll('[data-craft]')) button.addEventListener('click', () => {
      const recipe = game.levelPackage.recipes.find(item => item.id === button.dataset.craft);
      const result = craft(recipe, game.state.player, game.state.progress.materials, game.state.progress.equipment);
      if (!result.ok) {
        const message = document.querySelector('[data-craft-message]');
        if (message) {
          message.hidden = false;
          message.textContent = 'You need more coins or materials for that recipe.';
          message.focus();
        }
        return;
      }
      game.state.player = result.player;
      game.state.progress.materials = result.materials;
      game.state.progress.equipment = result.equipment;
      commit();
      crafting();
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
    const illustratedKeys = ['cave-lantern', 'dawn-stroke', 'market-seal', 'truth-stroke', 'harbour-chronometer', 'current-stroke', 'lantern-stage-pass', 'courage-stroke', 'festival-medallion', 'harmony-stroke', 'oracle-rubbing-kit', 'memory-stroke'];
    overlay.open(`<div class="panel bag-panel"><div class="panel-header"><div><p class="panel-kicker">Everything you carry</p><h1>Bag</h1></div><button class="secondary" data-close-overlay>Close</button></div><p class="bag-summary"><b>${total}</b> owned items across all collections. Battle boosts are used during battle; Forest Repellent can be activated here.</p><div class="bag-grid"><section class="bag-section battle-supplies"><h2>Supplies <span>${battleItems.reduce((sum, item) => sum + Number(inventory[item.id] || 0), 0)}</span></h2>${battleItems.length ? `<div class="bag-list">${battleItems.map(item => `<article><b>${escapeHtml(item.name)}</b><span>${escapeHtml(battleItemDescription(item))}</span><strong>×${inventory[item.id]}</strong>${item.effect === 'repellent' ? `<button data-use-repellent="${item.id}">Use</button>` : ''}</article>`).join('')}</div>` : empty('No supplies yet. Visit the village shop.')}</section><section class="bag-section special-items"><h2>Special items <span>${keyItems.length + specialItems.length}</span></h2>${keyItems.length || specialItems.length ? `<div class="bag-list">${keyItems.map(id => `<article class="${illustratedKeys.includes(id) ? 'illustrated-item' : ''}">${illustratedKeys.includes(id) ? `<img class="bag-item-art" src="../assets/images/rewards/${id}.png" alt="">` : ''}<b>${escapeHtml(itemName(id))}</b><span>Key item</span><strong>◆</strong></article>`).join('')}${specialItems.map(([id, count]) => `<article><b>${escapeHtml(itemName(id))}</b><span>Special reward</span><strong>×${count}</strong></article>`).join('')}</div>` : empty('Important story and milestone items will appear here.')}</section><section class="bag-section equipment-items"><h2>Equipment <span>${ownedGear.length}</span></h2>${ownedGear.length ? `<div class="bag-list">${ownedGear.map(gear => { const equipped = equipment.equipped[gear.slot] === gear.id; return `<article><b>${escapeHtml(gear.name)}</b><span>${equipped ? 'Equipped' : 'Owned'} · ${escapeHtml(gear.slot)}</span><strong>${equipped ? '✓' : '○'}</strong></article>`; }).join('')}</div>` : empty('No equipment collected.')}</section><section class="bag-section material-items"><h2>Materials <span>${materials.reduce((sum, [, count]) => sum + Number(count), 0)}</span></h2>${materials.length ? `<div class="bag-list">${materials.map(([id, count]) => `<article><b>${escapeHtml(itemName(id))}</b><span>Crafting material</span><strong>×${count}</strong></article>`).join('')}</div>` : empty('Creature drops used at the Craft Table will appear here.')}</section><section class="bag-section bait-items"><h2>Spirit bait <span>${baits.length}</span></h2>${baits.length ? `<div class="bag-list">${baits.map(bait => `<article><b>${escapeHtml(bait.word || `Lesson ${bait.lesson} bait`)}</b><span>Lesson ${bait.lesson} · controls the next encounter</span><strong>×1</strong></article>`).join('')}</div>` : empty('No bait prepared. Choose exact-word bait in the village shop.')}</section><section class="bag-section scroll-items"><h2>Scrolls <span>${scrolls.length}</span></h2>${scrolls.length ? `<div class="bag-scrolls">${scrolls.map(scroll => `<details><summary><b>${escapeHtml(scroll.title || 'Untitled scroll')}</b><span>${escapeHtml(scroll.type || 'Scroll')}</span></summary><p>${escapeHtml(scroll.text || 'This scroll has no written text.')}</p>${scroll.day ? `<small>Found ${escapeHtml(scroll.day)}</small>` : ''}</details>`).join('')}</div>` : empty('Reading Hall and Mystery Scroll discoveries will be stored here.')}</section></div></div>`);
    document.querySelector('[data-use-repellent]')?.addEventListener('click', event => {
      const item = game.levelPackage.items.find(candidate => candidate.id === event.currentTarget.dataset.useRepellent);
      const consumed = useConsumable(game.state.progress.inventory, item.id);
      if (!consumed.ok) return;
      game.state.progress.inventory = consumed.inventory;
      game.state.progress.encounter.repellentSteps = Math.max(game.state.progress.encounter.repellentSteps || 0, item.amount || 40);
      commit();
      toast(`Forest Repellent active for ${item.amount || 40} forest steps.`);
      bag();
    }, { once: true });
  }

  function partners() {
    const game = active();
    const eligible = eligiblePartners(game.levelPackage.content.words, game.state.progress.words);
    const eligibleIds = eligible.map(word => word.id);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Party of three</p><h1>Partner Spirits</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Silver partners give +1 max HP. Gold partners give +2 max HP and later unlock their lesson skill.</p>${eligible.length ? `<div class="spirit-grid">${eligible.map(word => `<label class="spirit-card ${tierOf(game.state.progress.words[word.w])}"><input type="checkbox" data-partner="${word.id}" ${game.state.progress.partners.includes(word.id) ? 'checked' : ''}> <b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.m)}</span></label>`).join('')}</div><div class="button-row"><button class="primary" data-save-partners>Save partners</button></div>` : '<p>No spirits are Silver yet. Complete three skill stars to make one eligible.</p>'}</div>`);
    document.querySelector('[data-save-partners]')?.addEventListener('click', () => {
      const selected = [...document.querySelectorAll('[data-partner]:checked')].map(input => input.dataset.partner);
      game.state.progress.partners = setPartners(game.state.progress.partners, selected, eligibleIds);
      refreshMaxHp();
      commit();
      partners();
    });
  }

  function restorationBoard() {
    const game = active();
    const completed = game.state.progress.sets;
    const states = game.levelPackage.sets.map(set => ({ set, ...setProgress(set, game.state.progress.words, game.levelPackage.content.words), completed: Boolean(completed[set.id]) })).filter(state => state.words.length >= 3);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)}</p><h1>Restoration Board</h1></div><button class="secondary" data-close-overlay>Close</button></div><aside class="board-explainer"><b>Repair the region with mastered words</b><span>Raise every Spirit card in a themed set to Silver or Gold, then offer the completed set to restore part of ${escapeHtml(game.levelPackage.region.name)} and earn a room decoration. Your Spirit cards are never consumed.</span></aside><div class="set-grid">${states.map(state => `<article class="set-card ${state.completed ? 'complete' : ''}"><h2>${escapeHtml(state.set.name)}</h2><p>${state.words.map(word => `${['silver','gold'].includes(tierOf(game.state.progress.words[word])) ? '✓' : '○'} ${escapeHtml(word)}`).join(' · ')}</p><small>${escapeHtml(state.set.restoration)}</small><button data-offer="${state.set.id}" ${state.ready && !state.completed ? '' : 'disabled'}>${state.completed ? 'Restored' : state.ready ? 'Restore region' : 'Keep learning'}</button></article>`).join('') || '<p>No Restoration Sets are available for this curriculum yet.</p>'}</div></div>`);
    for (const button of document.querySelectorAll('[data-offer]:not([disabled])')) button.addEventListener('click', () => {
      const state = states.find(item => item.set.id === button.dataset.offer);
      const result = offerSet(state.set, state);
      if (!result.completed) return;
      game.state.progress.sets[state.set.id] = true;
      game.state.progress.room.decorations.push(state.set.id);
      if (states.every(item => item.set.id === state.set.id || item.completed)) addUnique(game.state.progress.room.trophies, `${game.levelPackage.region.name} Trophy`);
      commit();
      toast(result.restoration);
      restorationBoard();
    });
  }

  function room() {
    const game = active();
    applyMilestones();
    const partners = game.state.progress.partners.map(id => game.levelPackage.content.words.find(word => word.id === id)).filter(Boolean);
    const gold = Object.values(game.state.progress.words).filter(value => tierOf(value) === 'gold').length;
    const goal = goalProgress(game.state.progress.parent.goal, game.state, gold);
    if (goal?.complete && !game.state.progress.parent.goal.celebrated) { game.state.progress.parent.goal.celebrated = true; commit(); toast(`Goal reached: ${goal.label}!`); }
    const hasSets = game.levelPackage.sets.some(set => setProgress(set, game.state.progress.words, game.levelPackage.content.words).words.length >= 3);
    overlay.open(`<div class="panel room-panel"><div class="panel-header"><div><p class="panel-kicker">Grandma Wang's house</p><h1>Your Room</h1></div><button class="secondary" data-close-overlay>Leave room</button></div><p><b>Lantern Streak: ${game.state.progress.streak?.count || 0} days</b></p>${goal ? `<section class="room-goal ${goal.complete ? 'complete' : ''}"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></section>` : ''}<div class="room-scene"><div class="room-shelf">${game.state.progress.room.trophies.length ? game.state.progress.room.trophies.map(() => '<span>🏆</span>').join('') : '<span class="empty">Trophy shelf</span>'}</div><div class="room-bed">Rest</div><div class="room-partners">${partners.length ? partners.map(word => `<i>${escapeHtml(word.w)}</i>`).join('') : '<span>Partner spirits will rest here.</span>'}</div><div class="room-decor">${game.state.progress.room.decorations.map(item => `<b>${escapeHtml(item)}</b>`).join(' ')}</div></div><aside class="room-help"><b>What are Partner Spirits?</b><span>Choose up to three Silver or Gold Spirit cards to travel with you. They increase your maximum HP, and Gold partners can also unlock a special battle move.</span></aside>${hasSets ? `<aside class="room-help restoration-help"><b>What is the Restoration Board?</b><span>Complete themed sets of Silver or Gold Spirit cards to repair ${escapeHtml(game.levelPackage.region.name)} and earn room decorations. Offering a set does not use up your cards.</span></aside>` : ''}<div class="button-row">${hasSets ? '<button class="primary" data-board-open>View Restoration Board</button>' : ''}<button class="secondary" data-room-partners>Choose Partner Spirits</button></div></div>`);
    document.querySelector('[data-board-open]')?.addEventListener('click', restorationBoard);
    document.querySelector('[data-room-partners]').addEventListener('click', partners);
  }

  return { bag, character, crafting, partners, restorationBoard, room, applyMilestones, refreshMaxHp };
}
