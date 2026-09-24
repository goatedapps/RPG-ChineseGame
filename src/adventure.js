import { makeExamQuestion } from './learning/questions.js';
import { tierOf } from './learning/mastery.js';
import { checkPassageAnswer } from './systems/reading.js';
import { advanceLanternStreak, claimDailyChest, dailyChestReady, dailyScrollSpot, normalizeDaily, recordDailyEvent, unlockDailyScroll } from './systems/daily.js';
import { applyStoryCommands, bossGateQueue, gateStatus, normalizeStory, recordStoryEvent, regionWords, requestReady } from './systems/story.js';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js';
import { showWritingTask } from './ui/writingView.js';
import { localDay } from './core/time.js';
import { recordActivity } from './systems/parent.js?p8';

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

export function createAdventure({ overlay, getActive, persist, render, toast, gameplay, audio }) {
  const active = () => getActive();
  const commit = () => { persist(); render(); };

  function ensureDaily() {
    const game = active();
    const day = localDay();
    game.state.progress.daily = normalizeDaily(game.state.progress.daily, day, game.levelPackage.dailyQuestTemplates, game.levelPackage.id);
    if (game.state.progress.scrolls.day !== day) game.state.progress.scrolls = { ...game.state.progress.scrolls, day, found: false, spot: dailyScrollSpot(day, game.levelPackage.regionStory.scrollSpots, game.levelPackage.id) };
    if (!game.state.progress.scrolls.spot) game.state.progress.scrolls.spot = dailyScrollSpot(day, game.levelPackage.regionStory.scrollSpots, game.levelPackage.id);
    game.state.progress.story = normalizeStory(game.state.progress.story);
  }

  function initialize() {
    ensureDaily();
    commit();
  }

  function recordEvent(event, payload = {}) {
    const game = active();
    ensureDaily();
    const before = game.state.progress.daily;
    game.state.progress.daily = recordDailyEvent(before, event);
    game.state.progress.activity = recordActivity(game.state.progress.activity, localDay(), event);
    if (!before.completedToday && game.state.progress.daily.completedToday) {
      const advanced = advanceLanternStreak(game.state.progress.streak, localDay());
      game.state.progress.streak = advanced.streak;
      if (advanced.usedFreeze) toast('Grandma kept your lantern lit while you were away.');
      if ([3, 7, 14, 30, 60, 100].includes(advanced.streak.count)) {
        addUnique(game.state.progress.room.decorations, `lantern-${advanced.streak.count}`);
        toast(`${advanced.streak.count}-day Lantern Streak! A new room decoration was earned.`);
      }
    }
    if (event === 'battle-win') game.state.progress.story = recordStoryEvent(game.state.progress.story, 'creature-win', { id: payload.creature });
    if (event === 'writing-success') game.state.progress.story = recordStoryEvent(game.state.progress.story, event, payload);
    if (event === 'tingxie-lesson3') game.state.progress.story = recordStoryEvent(game.state.progress.story, event, payload);
  }

  function questBoard() {
    const game = active();
    ensureDaily();
    const daily = game.state.progress.daily;
    const ready = dailyChestReady(daily);
    const battlePaused = gameplay.battlesLeft() === 0;
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Resets at local midnight</p><h1>Daily Quest Board</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Complete all three quests to open today's chest. Battle quests pause when the daily battle cap is reached.</p><div class="quest-list">${daily.quests.map(quest => `<article class="quest-card ${quest.complete ? 'complete' : ''} ${quest.event === 'battle-win' && battlePaused && !quest.complete ? 'paused' : ''}"><b>${quest.complete ? '✓' : '○'} ${escapeHtml(quest.text)}</b><span>${quest.progress}/${quest.target}${quest.event === 'battle-win' && battlePaused && !quest.complete ? ' · resumes tomorrow' : ''}</span></article>`).join('')}</div><div class="button-row"><button class="primary" data-daily-chest ${ready ? '' : 'disabled'}>${daily.chestClaimed ? 'Chest claimed' : ready ? 'Open Daily Chest' : 'Finish all quests'}</button><button class="secondary" data-scroll-library>Scroll Library</button></div></div>`);
    document.querySelector('[data-daily-chest]:not([disabled])')?.addEventListener('click', () => {
      const claimed = claimDailyChest(game.state.progress.daily);
      if (!claimed.ok) return;
      game.state.progress.daily = claimed.daily;
      game.state.player.coins += 30;
      game.state.progress.inventory['rice-ball'] = (game.state.progress.inventory['rice-ball'] || 0) + 1;
      game.state.progress.materials['mist-drop'] = (game.state.progress.materials['mist-drop'] || 0) + 1;
      game.state.progress.materials['echo-feather'] = (game.state.progress.materials['echo-feather'] || 0) + 1;
      commit();
      overlay.open('<div class="panel result-panel"><h1>Daily Chest opened!</h1><p>You received 30 coins, one Rice Ball, one Mist Drop and one Echo Feather.</p><button class="primary" data-close-overlay>Continue</button></div>');
    }, { once: true });
    document.querySelector('[data-scroll-library]').addEventListener('click', scrollLibrary);
  }

  function scrollSpot() {
    const game = active();
    ensureDaily();
    if (game.state.progress.scrolls.found) return null;
    return dailyScrollSpot(localDay(), game.levelPackage.regionStory.scrollSpots, game.levelPackage.id);
  }

  function collectDailyScroll() {
    const game = active();
    ensureDaily();
    if (game.state.progress.scrolls.found) return false;
    const regional = regionWords(game.levelPackage);
    const word = regional[(localDay().split('-').join('') * 1) % regional.length];
    const sentence = word.sb?.[0] || [word.ex, word.m];
    game.state.progress.scrolls = unlockDailyScroll(game.state.progress.scrolls, localDay(), {
      title: `${word.w} · ${word.p}`,
      type: word.isIdiom ? 'Idiom note' : 'Model sentence',
      text: `${sentence[0]} — ${sentence[1]}`
    });
    const libraryReward = game.state.progress.scrolls.unlocked.length % 7 === 0;
    if (libraryReward) {
      game.state.player.coins += 50;
      addUnique(game.state.progress.room.decorations, `scroll-library-${game.state.progress.scrolls.unlocked.length}`);
    }
    commit();
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Mystery Scroll found</p><h1>${escapeHtml(word.w)}</h1><p>${escapeHtml(sentence[0])}</p><p>${escapeHtml(sentence[1])}</p>${libraryReward ? '<p><b>Seven-scroll reward:</b> 50 coins and a room decoration!</p>' : ''}<button class="primary" data-close-overlay>Add to Scroll Library</button></div>`);
    return true;
  }

  function scrollLibrary() {
    const game = active();
    const entries = game.state.progress.scrolls.unlocked || [];
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Daily discoveries</p><h1>Scroll Library</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>${entries.length} scroll${entries.length === 1 ? '' : 's'} discovered.</p><div class="scroll-grid">${entries.map(entry => `<article><b>${escapeHtml(entry.title)}</b><small>${escapeHtml(entry.day)} · ${escapeHtml(entry.type)}</small><p>${escapeHtml(entry.text)}</p></article>`).join('') || '<p>Walk around the village to find today’s Mystery Scroll.</p>'}</div></div>`);
  }

  function playScene(sceneId, onDone) {
    const game = active();
    const commands = game.levelPackage.regionStory.scenes[sceneId] || [];
    const dialogue = commands.filter(command => command.say);
    let index = 0;
    const next = () => {
      if (index >= dialogue.length) {
        const result = applyStoryCommands(game.state.progress.story, commands);
        game.state.progress.story = result.story;
        for (const key of result.rewards) addUnique(game.state.progress.inventory.keyItems, key);
        if (sceneId === 'reform') {
          game.state.progress.story.flags.hiddenGrove = true;
          game.state.player.coins += 100;
          addUnique(game.state.progress.room.trophies, 'Dawn Stroke');
        }
        commit();
        overlay.close();
        onDone?.();
        return;
      }
      const command = dialogue[index++];
      overlay.open(`<div class="dialog-card"><p class="speaker">${escapeHtml(command.speaker)}</p><p>${escapeHtml(command.say)}</p><button class="primary" data-scene-next>${index === dialogue.length ? 'Continue' : 'Next'}</button></div>`, { dismissible: false });
      document.querySelector('[data-scene-next]').addEventListener('click', next, { once: true });
    };
    next();
  }

  function storyJournal() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    game.state.progress.story = story;
    if (!story.flags.arrival) return playScene('arrival', storyJournal);
    if (!story.flags.attic) return playScene('attic', storyJournal);
    if (!story.flags.tutorial) return gameplay.tutorialBattle(() => {
      active().state.progress.story.flags.tutorial = true;
      commit();
      overlay.open('<div class="panel result-panel"><h1>The adventure begins</h1><p>Visit the Storyteller to hear the first village story, then explore Camping Forest.</p><button class="primary" data-close-overlay>Explore</button></div>');
    });
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateSilverPct);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Region 1</p><h1>Adventure Journal</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="story-timeline"><p class="done">✓ Arrived in Scholar Village</p><p class="${story.flags.tutorial ? 'done' : ''}">${story.flags.tutorial ? '✓' : '○'} Found the Spirit Brush handle</p><p class="${story.storiesRead.includes(1) ? 'done' : ''}">${story.storiesRead.includes(1) ? '✓' : '○'} Heard the Camping Forest story</p><p>○ Help Xiaoqiang, Mr Lin and Chef Mei</p><p>${gate.open ? '✓ Muddle Cave gate ready' : `○ Muddle Cave: ${gate.silver}/${gate.required} Silver · Cave Lantern ${gate.lantern ? 'ready' : 'missing'}`}</p><p class="${story.bossDefeated ? 'done' : ''}">${story.bossDefeated ? '✓ Dawn Stroke restored' : '○ Reform the Muddle King'}</p></div><div class="button-row"><button class="primary" data-storyteller>Visit Storyteller</button>${story.bossDefeated ? '<button class="secondary" data-museum>Mistake Museum</button>' : ''}</div></div>`);
    document.querySelector('[data-storyteller]').addEventListener('click', storyteller);
    document.querySelector('[data-museum]')?.addEventListener('click', mistakeMuseum);
  }

  function storyteller() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Storyteller’s bench</p><h1>Region 1 Stories</h1></div><button class="secondary" data-close-overlay>Leave</button></div><div class="service-grid">${game.levelPackage.regionStory.stories.map(item => `<button data-story-lesson="${item.lesson}"><b>${story.storiesRead.includes(item.lesson) ? '✓ ' : ''}${escapeHtml(item.title)}</b><span>Lesson ${item.lesson} · ${item.pages.length} short pages</span></button>`).join('')}</div><div class="button-row"><button class="secondary" data-scroll-library>Scroll Library</button></div></div>`);
    for (const button of document.querySelectorAll('[data-story-lesson]')) button.addEventListener('click', () => readStory(Number(button.dataset.storyLesson)));
    document.querySelector('[data-scroll-library]').addEventListener('click', scrollLibrary);
  }

  function readStory(lesson) {
    const game = active();
    const storyData = game.levelPackage.regionStory.stories.find(item => item.lesson === lesson);
    let page = 0;
    const next = () => {
      if (page >= storyData.pages.length) {
        if (!game.state.progress.story.storiesRead.includes(lesson)) {
          game.state.progress.story.storiesRead.push(lesson);
          game.state.player.coins += 10;
          if (lesson === 1) game.state.progress.story.flags.campingForest = true;
          commit();
        }
        return storyteller();
      }
      overlay.open(`<article class="panel"><p class="panel-kicker">${escapeHtml(storyData.title)} · ${page + 1}/${storyData.pages.length}</p><h1>Lesson ${lesson}</h1><p class="story-page">${escapeHtml(storyData.pages[page++])}</p><button class="primary" data-story-next>${page === storyData.pages.length ? 'Finish story' : 'Next page'}</button></article>`, { dismissible: false });
      document.querySelector('[data-story-next]').addEventListener('click', next, { once: true });
    };
    next();
  }

  function villagerRequest(id) {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    const data = game.levelPackage.regionStory.requests[id];
    const step = story.requests[id] || 0;
    if (step >= data.steps.length) return overlay.dialogue({ title: data.name, lines: [id === 'mr-lin' ? 'Rest your eyes every 30 minutes!' : id === 'chef-mei' ? 'Salt and sugar finally have their proper labels.' : 'My pork-rib treasure is safe. Adventure is better with friends!'] });
    const ready = requestReady(id, step, game.state.progress, story);
    overlay.open(`<div class="panel"><p class="panel-kicker">Villager request · ${step + 1}/${data.steps.length}</p><h1>${escapeHtml(data.name)}</h1><p>${escapeHtml(data.steps[step])}</p><p>${ready ? 'You have completed this step.' : 'Come back when this step is complete.'}</p><div class="button-row"><button class="primary" data-request-complete ${ready ? '' : 'disabled'}>Help ${escapeHtml(data.name)}</button><button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-request-complete]:not([disabled])')?.addEventListener('click', () => {
      story.requests[id] = step + 1;
      game.state.progress.story = story;
      if (story.requests[id] === data.steps.length) grantRequestReward(id, game);
      recordEvent('villager-help', { id });
      commit();
      toast(story.requests[id] === data.steps.length ? `${data.name} is clear-minded again. Reward: ${data.reward}.` : 'Request step complete.');
      villagerRequest(id);
    }, { once: true });
  }

  function grantRequestReward(id, game) {
    if (id === 'xiaoqiang') {
      game.state.progress.materials['mist-drop'] = (game.state.progress.materials['mist-drop'] || 0) + 3;
      game.state.progress.materials['ink-bead'] = (game.state.progress.materials['ink-bead'] || 0) + 2;
    }
    if (id === 'mr-lin') addUnique(game.state.progress.inventory.keyItems, 'grandmas-lantern');
    if (id === 'chef-mei') game.state.progress.inventory.mooncake = (game.state.progress.inventory.mooncake || 0) + 1;
  }

  function treasureChest() {
    const game = active();
    if (game.state.progress.story.flags.treasureFound) return overlay.dialogue({ title: 'Empty treasure box', lines: ['Only a few pork-rib crumbs remain.'] });
    game.state.progress.story.flags.treasureFound = true;
    commit();
    overlay.dialogue({ title: 'Xiaoqiang’s treasure', lines: ['You found the missing box in Camping Forest.', 'Inside is… a pork rib! Xiaoqiang will be relieved.'] });
  }

  function ahDong() {
    const game = active();
    const collected = regionWords(game.levelPackage).filter(word => game.state.progress.words[word.w]?.collected).length;
    const duels = game.state.progress.story.rivalDuels || 0;
    const threshold = duels === 0 ? 5 : 20;
    if (duels >= 2) return overlay.dialogue({ title: 'Ah Dong', lines: ['That was a good duel. Next time we meet, let’s fight the Great Forgetter together!'] });
    if (collected < threshold) return overlay.dialogue({ title: 'Ah Dong', lines: [`Collect ${threshold} spirits and I’ll challenge you to a five-question quiz duel.`, `You have ${collected} so far.`] });
    overlay.open(`<div class="panel"><h1>Ah Dong’s quiz duel</h1><p>Five questions from Region 1. Score at least three to win.</p><div class="button-row"><button class="primary" data-duel>Start duel</button><button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-duel]').addEventListener('click', () => gameplay.rivalDuel((score, total) => {
      const won = score >= 3;
      if (won) {
        game.state.progress.story.rivalDuels += 1;
        game.state.player.coins += 20;
        game.state.progress.materials['echo-feather'] = (game.state.progress.materials['echo-feather'] || 0) + 2;
        commit();
      }
      overlay.open(`<div class="panel result-panel"><h1>${won ? 'You won the duel!' : 'Ah Dong wins this round'}</h1><p>${score}/${total} correct.${won ? ' You received 20 coins and two Echo Feathers.' : ' Practise and challenge him again.'}</p><button class="primary" data-close-overlay>Continue</button></div>`);
    }), { once: true });
  }

  function gatekeeper() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    if (story.bossDefeated) return nextRegionGate();
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateSilverPct);
    const open = gate.open || game.state.settings.testMode;
    const percent = Math.round(gate.silver / gate.total * 100);
    overlay.open(`<div class="panel"><p class="panel-kicker">Muddle Cave gate</p><h1>${open ? 'The gate is open' : 'Build your strength'}</h1><p>Silver or better: <b>${gate.silver}/${gate.total} (${percent}%)</b> · Need ${Math.round(gate.requiredPct * 100)}% (${gate.required} spirits).</p><p>Cave Lantern: <b>${gate.lantern ? 'ready' : 'not yet'}</b>.${game.state.settings.testMode ? ' Parent test mode is active.' : ''}</p><div class="button-row">${open ? '<button class="primary" data-boss-start>Challenge Muddle King</button>' : ''}<button class="secondary" data-close-overlay>Return</button></div></div>`);
    document.querySelector('[data-boss-start]')?.addEventListener('click', startBoss, { once: true });
  }

  function startBoss() {
    const queue = bossGateQueue(active().levelPackage.content);
    const battle = { queue, hp: queue.length * 4, maxHp: queue.length * 4, index: 0 };
    audio?.setScene('boss');
    const next = () => {
      if (battle.hp <= 0) return bossWin();
      if (!battle.queue.length) battle.queue = bossGateQueue(active().levelPackage.content);
      const task = battle.queue.shift();
      const finish = correct => {
        const game = active();
        if (correct) battle.hp = Math.max(0, battle.hp - 4);
        else {
          battle.queue.push(task);
          game.state.player.hp = Math.max(0, game.state.player.hp - 3);
          if (game.state.player.hp === 0) {
            game.state.player.hp = game.state.player.maxHp;
            commit();
            audio?.setScene('village');
            return overlay.open('<div class="panel result-panel"><h1>The Muddle King overwhelmed you</h1><p>You woke at the Inn with full HP. Your progress is safe; grow stronger and try again.</p><button class="primary" data-close-overlay>Recover</button></div>');
          }
        }
        commit();
        overlay.open(`<div class="panel result-panel"><p class="panel-kicker">${escapeHtml(task.phase)}</p><h1>${correct ? 'Spell broken!' : 'The spell returns to the queue'}</h1><p>Muddle King HP ${battle.hp}/${battle.maxHp}${correct ? '' : ' · You lost 3 HP'}.</p><button class="primary" data-boss-next>Next spell</button></div>`, { dismissible: false });
        document.querySelector('[data-boss-next]').addEventListener('click', next, { once: true });
      };
      if (task.kind === 'writing') {
        const game = active();
        showWritingTask(overlay, task.word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
          game.state.progress.characters = characters;
          finish(result.ok);
        }, { runId: `boss-${Date.now()}-${battle.hp}`, lenient: game.state.settings.lenientWriting, forceMemory: true });
        return;
      }
      if (task.item.format === 'Fill-in') {
        overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(task.phase)} · Muddle King HP ${battle.hp}/${battle.maxHp}</p><h2>${escapeHtml(task.item.q)}</h2><label class="answer-field">Your answer<input data-boss-answer></label><div class="button-row"><button class="primary" data-boss-check>Break spell</button><button class="secondary" data-boss-giveup>I don't know</button></div></article>`, { dismissible: false });
        const check = answer => finish(checkPassageAnswer(task.item, answer));
        document.querySelector('[data-boss-check]').addEventListener('click', () => check(document.querySelector('[data-boss-answer]').value), { once: true });
        document.querySelector('[data-boss-giveup]').addEventListener('click', () => check(''), { once: true });
        return;
      }
      showQuestion(overlay, makeExamQuestion(task.item), null, result => finish(result.ok), { title: `${task.phase} · Muddle King HP ${battle.hp}/${battle.maxHp}` });
    };
    next();
  }

  function bossWin() {
    audio?.sfx('win');
    audio?.setScene('village');
    playScene('reform', () => overlay.open('<div class="panel result-panel boss-victory"><p class="panel-kicker">Region 1 restored</p><h1>Dawn Stroke obtained!</h1><p>The hidden grove is open, and the Muddle King now runs the Mistake Museum.</p><button class="primary" data-close-overlay>Return to Scholar Village</button></div>'));
  }

  function nextRegionGate() {
    const game = active();
    const words = regionWords(game.levelPackage);
    const gold = words.filter(word => tierOf(game.state.progress.words[word.w]) === 'gold').length;
    const required = Math.ceil(words.length * game.levelPackage.regionStory.nextRegionGoldPct);
    const parentUnlocked = game.state.settings.testMode || game.state.settings.unlockedRegions >= 2;
    overlay.open(`<div class="panel"><p class="panel-kicker">Road to Harvest Crossing</p><h1>Dawn Stroke restored</h1><p>Gold spirits: <b>${gold}/${words.length}</b> · Need 70% (${required}) before Region 2.</p><p>${parentUnlocked ? 'A parent has unlocked Region 2 for testing. ' : ''}Region 2 will be built after the P2 vertical slice and device pilot.</p><button class="secondary" data-close-overlay>Return</button></div>`);
  }

  function mistakeMuseum() {
    const game = active();
    const misses = Object.entries(game.state.progress.words).sort((a, b) => (b[1].misses || 0) - (a[1].misses || 0)).slice(0, 5);
    overlay.open(`<div class="panel"><p class="panel-kicker">Curator: the reformed Muddle King</p><h1>Mistake Museum</h1><p>Every corrected muddle belongs in a museum!</p>${misses.length ? misses.map(([word, progress]) => `<p><b>${escapeHtml(word)}</b> · ${progress.misses || 0} muddle${progress.misses === 1 ? '' : 's'} fixed</p>`).join('') : '<p>No muddles recorded yet.</p>'}<button class="secondary" data-close-overlay>Leave museum</button></div>`);
  }

  function hiddenGrove() {
    const game = active();
    if (!game.state.progress.story.flags.hiddenGrove) return overlay.dialogue({ title: 'Thick fog', lines: ['The path disappears into silver fog. A restored Brush Fragment may clear it.'] });
    if ((game.state.progress.scrolls.unlocked || []).some(entry => entry.type === 'Idiom Scroll')) return overlay.dialogue({ title: 'Hidden Grove', lines: ['Elite word spirits patrol the bright clearing. The old chest is empty now.'] });
    const idiom = game.levelPackage.content.words.find(word => word.isIdiom && word.lesson <= 3);
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: idiom?.w || 'Region 1 Idiom', type: 'Idiom Scroll', text: `${idiom?.p || ''} · ${idiom?.m || 'A special Region 1 move'}` });
    game.state.player.coins += 30;
    commit();
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Hidden Grove chest</p><h1>${escapeHtml(idiom?.w || 'Idiom Scroll')}</h1><p>You found the first idiom scroll and 30 coins. Elite creatures now guard this clearing for advanced practice.</p><button class="primary" data-close-overlay>Continue</button></div>`);
  }

  function handleInteraction(object) {
    const handlers = {
      'quest-board': questBoard,
      storyteller,
      xiaoqiang: () => villagerRequest('xiaoqiang'),
      'mr-lin': () => villagerRequest('mr-lin'),
      'chef-mei': () => villagerRequest('chef-mei'),
      'ah-dong': ahDong,
      'treasure-chest': treasureChest,
      'hidden-grove': hiddenGrove,
      gatekeeper
    };
    if (!handlers[object.id]) return false;
    handlers[object.id]();
    return true;
  }

  return { initialize, recordEvent, questBoard, scrollLibrary, scrollSpot, collectDailyScroll, storyJournal, storyteller, handleInteraction, gatekeeper, startBoss };
}
