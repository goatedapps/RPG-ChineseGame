import { craft } from './systems/crafting.js';
import { equipGear, gearBonuses, normalizeEquipment } from './systems/gear.js';
import { claimMilestones } from './systems/milestones.js';
import { eligiblePartners, partnerBonuses, setPartners } from './systems/partners.js';
import { offerSet, setProgress } from './systems/sets.js';
import { tierOf } from './learning/mastery.js';
import { escapeHtml } from './ui/dom.js';
import { goalProgress } from './systems/parent.js?p10d';

export function createCollection({ overlay, getActive, persist, render, toast }) {
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
    if (result.due.length) toast(`Milestone reward: ${result.due.map(item => item.name).join(', ')}`);
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
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Equipment</p><h1>Character</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="character-preview"><div class="paper-hero ${equipment.equipped.hat || ''}">勇</div><div><b>HP bonus +${bonuses.maxHp}</b><p>Evasion +${Math.round(bonuses.evasion * 100)}% · XP +${Math.round(bonuses.xp * 100)}%</p></div></div><div class="gear-grid">${game.levelPackage.gear.map(gear => { const owned = equipment.owned.includes(gear.id); const equipped = equipment.equipped[gear.slot] === gear.id; return `<article><b>${escapeHtml(gear.name)}</b><span>${escapeHtml(gear.slot)} · ${escapeHtml(gear.effect)}</span><button data-equip="${gear.id}" ${owned && !equipped ? '' : 'disabled'}>${equipped ? 'Equipped' : owned ? 'Equip' : 'Not earned'}</button></article>`; }).join('')}</div><div class="button-row"><button class="primary" data-craft-open>Craft Table</button><button class="secondary" data-partners-open>Partner Spirits</button></div></div>`);
    for (const button of document.querySelectorAll('[data-equip]:not([disabled])')) button.addEventListener('click', () => {
      const gear = game.levelPackage.gear.find(item => item.id === button.dataset.equip);
      game.state.progress.equipment = equipGear(game.state.progress.equipment, gear);
      refreshMaxHp();
      commit();
      character();
    });
    document.querySelector('[data-craft-open]').addEventListener('click', crafting);
    document.querySelector('[data-partners-open]').addEventListener('click', partners);
  }

  function crafting() {
    const game = active();
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Workshop</p><h1>Craft Table</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Materials: ${Object.entries(game.state.progress.materials).map(([id, count]) => `${escapeHtml(id)} × ${count}`).join(' · ') || 'None yet'}</p><div class="gear-grid">${game.levelPackage.recipes.map(recipe => `<article><b>${escapeHtml(recipe.name)}</b><span>${recipe.coins} coins · ${Object.entries(recipe.materials).map(([id, count]) => `${escapeHtml(id)} × ${count}`).join(', ')}</span><button data-craft="${recipe.id}">Craft</button></article>`).join('')}</div></div>`);
    for (const button of document.querySelectorAll('[data-craft]')) button.addEventListener('click', () => {
      const recipe = game.levelPackage.recipes.find(item => item.id === button.dataset.craft);
      const result = craft(recipe, game.state.player, game.state.progress.materials, game.state.progress.equipment);
      if (!result.ok) return toast('You need more coins or materials for that recipe.');
      game.state.player = result.player;
      game.state.progress.materials = result.materials;
      game.state.progress.equipment = result.equipment;
      commit();
      crafting();
    });
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
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Scholar Village</p><h1>Restoration Board</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="set-grid">${states.map(state => `<article class="set-card ${state.completed ? 'complete' : ''}"><h2>${escapeHtml(state.set.name)}</h2><p>${state.words.map(word => `${['silver','gold'].includes(tierOf(game.state.progress.words[word])) ? '✓' : '○'} ${escapeHtml(word)}`).join(' · ')}</p><small>${escapeHtml(state.set.restoration)}</small><button data-offer="${state.set.id}" ${state.ready && !state.completed ? '' : 'disabled'}>${state.completed ? 'Restored' : state.ready ? 'Offer set' : 'Keep learning'}</button></article>`).join('') || '<p>No Restoration Sets are available for this curriculum yet.</p>'}</div></div>`);
    for (const button of document.querySelectorAll('[data-offer]:not([disabled])')) button.addEventListener('click', () => {
      const state = states.find(item => item.set.id === button.dataset.offer);
      const result = offerSet(state.set, state);
      if (!result.completed) return;
      game.state.progress.sets[state.set.id] = true;
      game.state.progress.room.decorations.push(state.set.id);
      if (Object.keys(game.state.progress.sets).length === states.filter(item => item.words.length >= 3).length) game.state.progress.room.trophies.push('Scholar Village Trophy');
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
    overlay.open(`<div class="panel room-panel"><div class="panel-header"><div><p class="panel-kicker">Grandma Wang's house</p><h1>Your Room</h1></div><button class="secondary" data-close-overlay>Leave room</button></div><p><b>Lantern Streak: ${game.state.progress.streak?.count || 0} days</b></p>${goal ? `<section class="room-goal ${goal.complete ? 'complete' : ''}"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></section>` : ''}<div class="room-scene"><div class="room-shelf">${game.state.progress.room.trophies.length ? game.state.progress.room.trophies.map(() => '<span>🏆</span>').join('') : '<span class="empty">Trophy shelf</span>'}</div><div class="room-bed">Rest</div><div class="room-partners">${partners.length ? partners.map(word => `<i>${escapeHtml(word.w)}</i>`).join('') : '<span>Partner spirits will rest here.</span>'}</div><div class="room-decor">${game.state.progress.room.decorations.map(item => `<b>${escapeHtml(item)}</b>`).join(' ')}</div></div><div class="button-row">${hasSets ? '<button class="primary" data-board-open>Restoration Board</button>' : ''}<button class="secondary" data-room-partners>Partners</button></div></div>`);
    document.querySelector('[data-board-open]')?.addEventListener('click', restorationBoard);
    document.querySelector('[data-room-partners]').addEventListener('click', partners);
  }

  return { character, crafting, partners, restorationBoard, room, applyMilestones, refreshMaxHp };
}

