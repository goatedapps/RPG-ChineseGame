import { makeExamQuestion } from './learning/questions.js';
import { tierOf } from './learning/mastery.js?p10f';
import { checkPassageAnswer } from './systems/reading.js?p10f';
import { advanceLanternStreak, claimDailyChest, dailyChestReady, dailyScrollSpot, normalizeDaily, recordDailyEvent, unlockDailyScroll } from './systems/daily.js';
import { applyStoryCommands, bossGateQueue, gateStatus, normalizeStory, recordStoryEvent, regionWords, requestReady } from './systems/story.js?p10f';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js?p10m';
import { showWritingTask } from './ui/writingView.js?p12b';
import { localDay } from './core/time.js';
import { recordActivity } from './systems/parent.js?p10f';
import { calculateDamage, heroStats } from './battle/damage.js';
import { enemyAttack } from './battle/battle.js';
import { createBoss } from './battle/creatures.js';
import { gearBonuses } from './systems/gear.js';
import { creatureSvg } from './battle/creatureArt.js?p10m';
import { heroPortrait } from './ui/heroPortrait.js?p10n';
import { createSpeechController } from './learning/audio.js';

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

export function splitStoryPage(text) {
  const sentences = String(text).split(/(?<=[。！？!?])\s*|\r?\n+/).map(sentence => sentence.trim()).filter(Boolean);
  if (sentences.length < 2) return [sentences[0] || '', ''];
  const total = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
  let leftLength = 0;
  let splitAt = 1;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    leftLength += sentences[index].length;
    splitAt = index + 1;
    if (leftLength >= total / 2) break;
  }
  return [sentences.slice(0, splitAt).join('\n\n'), sentences.slice(splitAt).join('\n\n')];
}

export function createAdventure({ overlay, getActive, persist, render, toast, gameplay, audio, onSwitchRegion }) {
  const active = () => getActive();
  const commit = () => { persist(); render(); };
  const speech = createSpeechController();

  function ensureDaily() {
    const game = active();
    const day = localDay();
    const regionId = game.levelPackage.region.id;
    game.state.progress.daily = normalizeDaily(game.state.progress.daily, day, game.levelPackage.dailyQuestTemplates, game.levelPackage.id);
    if (game.state.progress.scrolls.day !== day) game.state.progress.scrolls = { ...game.state.progress.scrolls, day, region: regionId, found: false, spot: dailyScrollSpot(day, game.levelPackage.regionStory.scrollSpots, `${game.levelPackage.id}-${regionId}`) };
    if (!game.state.progress.scrolls.found && game.state.progress.scrolls.region !== regionId) game.state.progress.scrolls = { ...game.state.progress.scrolls, region: regionId, spot: dailyScrollSpot(day, game.levelPackage.regionStory.scrollSpots, `${game.levelPackage.id}-${regionId}`) };
    if (!game.state.progress.scrolls.spot) game.state.progress.scrolls.spot = dailyScrollSpot(day, game.levelPackage.regionStory.scrollSpots, `${game.levelPackage.id}-${regionId}`);
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
        audio?.sfx('majorReward');
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
      audio?.sfx('win');
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
      audio?.sfx('majorReward');
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
          if (game.levelPackage.region.id === 'r1') game.state.progress.story.flags.hiddenGrove = true;
          game.state.player.coins += 100;
          addUnique(game.state.progress.room.trophies, game.levelPackage.region.id === 'r2' ? 'Truth Stroke' : 'Dawn Stroke');
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
    if (game.levelPackage.region.id === 'r2') {
      const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
      const requestsDone = Object.keys(game.levelPackage.regionStory.requests).filter(id => (story.requests[id] || 0) >= 3).length;
      overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Region 2</p><h1>Harvest Crossing Journal</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="story-timeline"><p class="done">✓ Arrived in Harvest Crossing</p><p class="${story.storiesRead.length ? 'done' : ''}">${story.storiesRead.length ? '✓' : '○'} Heard a crossing story</p><p class="${requestsDone === 3 ? 'done' : ''}">${requestsDone === 3 ? '✓' : '○'} Helped ${requestsDone}/3 neighbours</p><p>${gate.open ? `✓ ${escapeHtml(game.levelPackage.regionStory.bossPlace)} gate ready` : `○ ${escapeHtml(game.levelPackage.regionStory.bossPlace)}: ${gate.bronze}/${gate.required} Bronze · ${escapeHtml(game.levelPackage.regionStory.gateKeyName)} ${gate.lantern ? 'ready' : 'missing'}`}</p><p class="${story.bossDefeated ? 'done' : ''}">${story.bossDefeated ? '✓ Truth Stroke restored' : '○ Face the Doubt Serpent'}</p></div><div class="button-row"><button class="primary" data-storyteller>Visit Storyteller</button><button class="secondary" data-travel-r1>Return to Scholar Village</button></div></div>`);
      document.querySelector('[data-storyteller]').addEventListener('click', storyteller);
      document.querySelector('[data-travel-r1]').addEventListener('click', () => onSwitchRegion?.('r1'));
      return;
    }
    if (!story.flags.attic) return playScene('attic', storyJournal);
    if (!story.flags.tutorial) return gameplay.tutorialBattle(() => {
      active().state.progress.story.flags.tutorial = true;
      commit();
      overlay.open('<div class="panel result-panel"><h1>The adventure begins</h1><p>Visit the Storyteller to hear the first village story, then explore Camping Forest.</p><button class="primary" data-close-overlay>Explore</button></div>');
    });
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Region 1</p><h1>Adventure Journal</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="story-timeline"><p class="done">✓ Arrived in Scholar Village</p><p class="${story.flags.tutorial ? 'done' : ''}">${story.flags.tutorial ? '✓' : '○'} Found the Spirit Brush handle</p><p class="${story.storiesRead.includes(1) ? 'done' : ''}">${story.storiesRead.includes(1) ? '✓' : '○'} Heard the Camping Forest story</p><p>○ Help Xiaoqiang, Mr Lin and Chef Mei</p><p>${gate.open ? '✓ Muddle Cave gate ready' : `○ Muddle Cave: ${gate.bronze}/${gate.required} Bronze · Cave Lantern ${gate.lantern ? 'ready' : 'missing'}`}</p><p class="${story.bossDefeated ? 'done' : ''}">${story.bossDefeated ? '✓ Dawn Stroke restored' : '○ Reform the Muddle King'}</p></div><div class="button-row"><button class="primary" data-storyteller>Visit Storyteller</button>${story.bossDefeated ? '<button class="secondary" data-museum>Mistake Museum</button>' : ''}</div></div>`);
    document.querySelector('[data-storyteller]').addEventListener('click', storyteller);
    document.querySelector('[data-museum]')?.addEventListener('click', mistakeMuseum);
  }

  function storyteller() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    overlay.open(`<div class="panel storyteller-panel"><div class="panel-header"><div><p class="panel-kicker">Storyteller’s bench</p><h1>${escapeHtml(game.levelPackage.region.name)} Stories</h1></div><button class="secondary" data-close-overlay>Leave</button></div><div class="storyteller-welcome"><span aria-hidden="true">说</span><p>Let me tell you a story. Which one do you want to know about?</p></div><div class="service-grid">${game.levelPackage.regionStory.stories.map(item => `<button data-story-lesson="${item.lesson}"><b>${story.storiesRead.includes(item.lesson) ? '✓ ' : ''}${escapeHtml(item.title)}</b><span>Lesson ${item.lesson} · ${item.pages.length} short pages</span></button>`).join('')}</div><div class="button-row"><button class="secondary" data-scroll-library>Scroll Library</button></div></div>`);
    for (const button of document.querySelectorAll('[data-story-lesson]')) button.addEventListener('click', () => readStory(Number(button.dataset.storyLesson)));
    document.querySelector('[data-scroll-library]').addEventListener('click', scrollLibrary);
  }

  function readStory(lesson) {
    const game = active();
    const storyData = game.levelPackage.regionStory.stories.find(item => item.lesson === lesson);
    let page = 0;
    const next = () => {
      speech.stop();
      if (page >= storyData.pages.length) {
        if (!game.state.progress.story.storiesRead.includes(lesson)) {
          game.state.progress.story.storiesRead.push(lesson);
          game.state.player.coins += 10;
          if (game.levelPackage.region.id === 'r1' && lesson === 1) game.state.progress.story.flags.campingForest = true;
          commit();
        }
        return storyteller();
      }
      const pageText = storyData.pages[page];
      const [leftPage, rightPage] = splitStoryPage(pageText);
      const lastPage = page === storyData.pages.length - 1;
      overlay.open(`<article class="panel story-reader-panel"><header class="story-reader-header"><div><p class="panel-kicker">Lesson ${lesson} · Page ${page + 1}/${storyData.pages.length}</p><h1>${escapeHtml(storyData.title)}</h1></div></header><div class="story-book-spread" aria-label="${escapeHtml(pageText)}"><div class="story-book-page story-book-left">${escapeHtml(leftPage).replaceAll('\n', '<br>')}</div><div class="story-book-page story-book-right">${escapeHtml(rightPage).replaceAll('\n', '<br>')}</div></div><div class="story-reader-actions"><button class="secondary" data-story-dictation>Dictation · Read page aloud</button><button class="primary" data-story-next>${lastPage ? 'Finish story' : 'Next page'}</button></div></article>`, { dismissible: false, onClose: speech.stop });
      const dictation = document.querySelector('[data-story-dictation]');
      dictation.addEventListener('click', () => {
        if (speech.isSpeaking) {
          speech.stop();
          dictation.textContent = 'Dictation · Read page aloud';
          return;
        }
        const started = speech.speak(pageText, { rate: game.state.settings.speechRate, onEnd: () => { if (dictation.isConnected) dictation.textContent = 'Dictation · Read page aloud'; } });
        if (started) dictation.textContent = 'Stop dictation';
        else toast('Chinese speech is not available on this device.');
      });
      page += 1;
      document.querySelector('[data-story-next]').addEventListener('click', next, { once: true });
    };
    next();
  }

  function villagerRequest(id) {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    const data = game.levelPackage.regionStory.requests[id];
    const bindings = game.levelPackage.config.region1?.requests || {};
    const bound = bindings[id] || {};
    const steps = id === 'xiaoqiang'
      ? [`Collect ${(bound.collect || ['贵重', '探险']).join(' and ')}.`, 'Find the treasure box in Camping Forest.', `Raise ${bound.bronze || bound.silver || '狼吞虎咽'} to Bronze.`]
      : id === 'mr-lin'
        ? [`Raise ${(bound.bronze || bound.silver || ['模糊', '眼圈']).join(' and ')} to Bronze.`, 'Defeat three Twin Shades.', `Practise writing ${bound.write || '距离'} successfully.`]
        : [`Raise ${(bound.bronze || bound.silver || ['调味料', '材料']).join(' and ')} to Bronze.`, 'Defeat two Ink Imps.', 'Complete a clean Lesson 3 tingxie.'];
    const step = story.requests[id] || 0;
    if (step >= steps.length) return overlay.dialogue({ title: data.name, lines: [id === 'mr-lin' ? 'Rest your eyes every 30 minutes!' : id === 'chef-mei' ? 'Salt and sugar finally have their proper labels.' : 'My pork-rib treasure is safe. Adventure is better with friends!'] });
    const ready = requestReady(id, step, game.state.progress, story, bindings);
    overlay.open(`<div class="panel"><p class="panel-kicker">Villager request · ${step + 1}/${steps.length}</p><h1>${escapeHtml(data.name)}</h1><p>${escapeHtml(steps[step])}</p><p>${ready ? 'You have completed this step.' : 'Come back when this step is complete.'}</p><div class="button-row">${ready ? `<button class="primary" data-request-complete>Help ${escapeHtml(data.name)}</button>` : ''}<button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-request-complete]')?.addEventListener('click', () => {
      story.requests[id] = step + 1;
      game.state.progress.story = story;
      if (story.requests[id] === steps.length) grantRequestReward(id, game);
      recordEvent('villager-help', { id });
      commit();
      if (story.requests[id] === steps.length) audio?.sfx('majorReward');
      toast(story.requests[id] === steps.length ? `${data.name} is clear-minded again. Reward: ${data.reward}.` : 'Request step complete.');
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
    if (story.bossDefeated) return game.levelPackage.region.id === 'r1' ? nextRegionGate() : truthTerrace();
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
    const open = gate.open || game.state.settings.testMode;
    const percent = Math.round(gate.bronze / gate.total * 100);
    const bossName = game.levelPackage.regionStory.bossName || 'Muddle King';
    const place = game.levelPackage.regionStory.bossPlace || 'Muddle Cave';
    const keyName = game.levelPackage.regionStory.gateKeyName || 'Cave Lantern';
    overlay.open(`<div class="panel"><p class="panel-kicker">${escapeHtml(place)} gate</p><h1>${open ? 'The gate is open' : 'Build your strength'}</h1><p>Bronze or better: <b>${gate.bronze}/${gate.total} (${percent}%)</b> · Need ${Math.round(gate.requiredPct * 100)}% (${gate.required} spirits).</p><p>${escapeHtml(keyName)}: <b>${gate.lantern ? 'ready' : 'not yet'}</b>.${game.state.settings.testMode ? ' Parent test mode is active.' : ''}</p><div class="button-row">${open ? `<button class="primary" data-boss-start>Challenge ${escapeHtml(bossName)}</button>` : ''}<button class="secondary" data-close-overlay>Return</button></div></div>`);
    document.querySelector('[data-boss-start]')?.addEventListener('click', startBoss, { once: true });
  }

  function startBoss() {
    const regionLessons = active().levelPackage.config.regionLessons[active().levelPackage.region.id] || [];
    const queue = bossGateQueue(active().levelPackage.content, active().levelPackage.config, regionLessons);
    const boss = createBoss(active().levelPackage.balance, regionLessons);
    const battle = { queue, ...boss, hp: boss.maxHp, index: 0 };
    const arena = () => {
      const game = active();
      const hero = heroStats(game.state.player.level);
      const bossName = game.levelPackage.regionStory.bossName || 'Muddle King';
      const bossId = game.levelPackage.region.boss;
      const bossArt = bossId === 'muddle-king' ? creatureSvg('muddle-king', '') : creatureSvg(bossId, '');
      return `<div class="boss-battle-arena">
        <div class="battle-player">${heroPortrait(game.state.progress.equipment?.equipped, 'battle-hero')}<div class="battle-nameplate"><b>You · Lv ${game.state.player.level}</b><small>ATK ${hero.attack} · DEF ${hero.defense}</small><div class="enemy-hp player-hp"><i style="width:${game.state.player.hp / game.state.player.maxHp * 100}%"></i></div><strong>HP ${game.state.player.hp}/${game.state.player.maxHp}</strong></div></div>
        <div class="battle-enemy boss-enemy"><div class="battle-nameplate"><b>${escapeHtml(bossName)} · Lv ${battle.level} Boss</b><small>ATK ${battle.attack} · DEF ${battle.defense}</small><div class="enemy-hp"><i style="width:${battle.hp / battle.maxHp * 100}%"></i></div><strong>HP ${battle.hp}/${battle.maxHp}</strong></div><div class="creature-art">${bossArt}</div></div>
      </div>`;
    };
    const bossPanel = content => `<article class="battle-scene boss-battle-scene">${arena()}<div class="battle-console">${content}</div></article>`;
    audio?.setScene('boss');
    const next = () => {
      if (battle.hp <= 0) return bossWin();
      if (!battle.queue.length) battle.queue = bossGateQueue(active().levelPackage.content, active().levelPackage.config, regionLessons);
      const task = battle.queue.shift();
      const finish = correct => {
        const game = active();
        const hero = heroStats(game.state.player.level);
        const bonuses = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
        let damage = 0;
        if (correct) {
          damage = calculateDamage({ attack: hero.attack, defense: battle.defense, moveBonus: task.kind === 'writing' ? 3 + bonuses.skillDamage.w : 2, roll: Math.random() * 3 });
          battle.hp = Math.max(0, battle.hp - damage);
          audio?.sfx('hit');
        } else battle.queue.push(task);
        let counter = { damage: 0, evaded: false };
        if (battle.hp > 0) {
          counter = enemyAttack({ creature: battle }, game.state.player, Math.random, { evasionBonus: bonuses.evasion, damageReduction: bonuses.spellDefense, damageMultiplier: correct ? 0.8 : 1 });
          game.state.player = counter.player;
        }
        if (game.state.player.hp === 0) {
          game.state.player.hp = game.state.player.maxHp;
          commit();
          audio?.setScene('village');
          return overlay.open(bossPanel(`<h1>The ${escapeHtml(game.levelPackage.regionStory.bossName || 'Muddle King')} overwhelmed you</h1><p>You woke at the Inn with full HP. Your progress is safe; grow stronger and try again.</p><button class="primary" data-close-overlay>Recover</button>`));
        }
        commit();
        const bossName = game.levelPackage.regionStory.bossName || 'Muddle King';
        const counterText = battle.hp <= 0 ? '' : counter.evaded ? ' You dodged the counterattack.' : ` ${bossName} struck back for ${counter.damage} damage.`;
        overlay.open(bossPanel(`<p class="panel-kicker">${escapeHtml(task.phase)}</p><h1>${correct ? 'Spell broken!' : 'The spell returns to the queue'}</h1><p>${correct ? `You dealt ${damage} damage. ` : ''}${escapeHtml(bossName)} HP ${battle.hp}/${battle.maxHp}.${counterText}</p><button class="primary" data-boss-next>Next spell</button>`), { dismissible: false });
        document.querySelector('[data-boss-next]').addEventListener('click', next, { once: true });
      };
      if (task.kind === 'writing') {
        const game = active();
        showWritingTask(overlay, task.word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
          game.state.progress.characters = characters;
          finish(result.ok);
        }, { runId: `boss-${Date.now()}-${battle.hp}`, lenient: game.state.settings.lenientWriting, forceMemory: true, headerHtml: arena() });
        return;
      }
      if (task.item.format === 'Fill-in') {
        overlay.open(`<article class="panel question-panel boss-question">${arena()}<p class="panel-kicker">${escapeHtml(task.phase)} · Muddle King HP ${battle.hp}/${battle.maxHp}</p><h2>${escapeHtml(task.item.q)}</h2><label class="answer-field">Your answer<input data-boss-answer autocomplete="off"></label><div class="button-row"><button class="primary" data-boss-check>Break spell</button><button class="secondary" data-boss-giveup>I don't know</button></div></article>`, { dismissible: false });
        const check = answer => finish(checkPassageAnswer(task.item, answer));
        document.querySelector('[data-boss-check]').addEventListener('click', () => check(document.querySelector('[data-boss-answer]').value), { once: true });
        document.querySelector('[data-boss-giveup]').addEventListener('click', () => check(''), { once: true });
        return;
      }
      showQuestion(overlay, makeExamQuestion(task.item), null, result => finish(result.ok), { title: `${task.phase} · Muddle King HP ${battle.hp}/${battle.maxHp}`, headerHtml: arena() });
    };
    next();
  }

  function bossWin() {
    audio?.setScene('village');
    playScene('reform', () => {
      audio?.sfx('majorReward');
      const game = active();
      const r2 = game.levelPackage.region.id === 'r2';
      const fragment = r2 ? 'truth-stroke' : 'dawn-stroke';
      const fragmentName = r2 ? 'Truth Stroke' : 'Dawn Stroke';
      const fragmentArt = r2 ? '../assets/images/rewards/truth-stroke.png' : '../assets/images/rewards/dawn-stroke.png';
      if (r2) addUnique(game.state.progress.room.trophies, fragmentName);
      commit();
      overlay.open(`<div class="panel result-panel boss-victory major-reward-panel"><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)} restored</p><div class="major-reward"><img src="${fragmentArt}" alt="${fragmentName}"><div><p class="panel-kicker">Major reward</p><h1>${fragmentName} obtained!</h1></div></div><p>${r2 ? 'Hidden writing on Truth Terrace can now be revealed.' : 'The hidden grove is open, and the Muddle King now runs the Mistake Museum.'}</p><button class="primary" data-close-overlay>Return to ${escapeHtml(game.levelPackage.region.name)}</button></div>`);
    });
  }

  function nextRegionGate() {
    const game = active();
    const words = regionWords(game.levelPackage);
    const silver = words.filter(word => ['silver', 'gold'].includes(tierOf(game.state.progress.words[word.w]))).length;
    const required = Math.ceil(words.length * game.levelPackage.regionStory.nextRegionSilverPct);
    const ready = silver >= required || game.state.settings.testMode;
    overlay.open(`<div class="panel"><p class="panel-kicker">Road to Harvest Crossing</p><h1>Dawn Stroke restored</h1><p>Silver or better: <b>${silver}/${words.length}</b> · Need ${Math.round(game.levelPackage.regionStory.nextRegionSilverPct * 100)}% (${required}) before Region 2. Gold spirits are optional bonuses.</p><div class="button-row">${ready ? '<button class="primary" data-travel-r2>Travel to Harvest Crossing</button>' : ''}<button class="secondary" data-close-overlay>Return</button></div></div>`);
    document.querySelector('[data-travel-r2]')?.addEventListener('click', () => {
      game.state.settings.unlockedRegions = Math.max(2, game.state.settings.unlockedRegions);
      onSwitchRegion?.('r2');
    });
  }

  function regionTwoRequest(id) {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    const request = game.levelPackage.regionStory.requests[id];
    const lessonWords = game.levelPackage.content.words.filter(word => word.lesson === request.lesson);
    const collected = lessonWords.filter(word => game.state.progress.words[word.w]?.collected).length;
    const step = story.requests[id] || 0;
    const ready = step === 0 ? collected >= 3 : step === 1 ? (story.counters.creatures[request.creature] || 0) >= request.count : step === 2 ? story.storiesRead.includes(request.lesson) : false;
    const tasks = [`Collect three Lesson ${request.lesson} Spirit cards (${collected}/3).`, `Defeat ${request.count} ${request.creature.split('-').join(' ')} creatures (${story.counters.creatures[request.creature] || 0}/${request.count}).`, `Hear the Lesson ${request.lesson} story from the Storyteller.`];
    if (step >= 3) return overlay.dialogue({ title: request.name, lines: [`Thank you. ${request.reward} has brought neighbours together again.`] });
    overlay.open(`<div class="panel"><p class="panel-kicker">Harvest Crossing request · ${step + 1}/3</p><h1>${escapeHtml(request.name)}</h1><p>${escapeHtml(tasks[step])}</p><div class="button-row">${ready ? `<button class="primary" data-r2-request>Complete step</button>` : ''}<button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-r2-request]')?.addEventListener('click', () => {
      story.requests[id] = step + 1;
      game.state.progress.story = story;
      if (story.requests[id] === 3) {
        game.state.player.coins += 40;
        game.state.progress.inventory['rice-ball'] = (game.state.progress.inventory['rice-ball'] || 0) + 1;
        audio?.sfx('majorReward');
      }
      recordEvent('villager-help', { id });
      commit();
      regionTwoRequest(id);
    }, { once: true });
  }

  function truthTerrace() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Faded stone', lines: ['A hidden message waits for the Truth Stroke.'] });
    if (game.state.progress.story.flags.truthTerrace) return overlay.dialogue({ title: 'Truth Terrace', lines: ['The stone reads: “Ask clearly. Check carefully. Speak kindly.”'] });
    game.state.progress.story.flags.truthTerrace = true;
    game.state.player.coins += 60;
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: 'Truth Terrace', type: 'Secret Scroll', text: 'Ask clearly. Check carefully. Speak kindly.' });
    commit();
    overlay.open('<div class="panel result-panel"><p class="panel-kicker">Truth Stroke secret</p><h1>The hidden words shine</h1><p>“Ask clearly. Check carefully. Speak kindly.” You found a Secret Scroll and 60 coins.</p><button class="primary" data-close-overlay>Continue</button></div>');
  }

  function mistakeMuseum() {
    const game = active();
    const misses = Object.entries(game.state.progress.words).sort((a, b) => (b[1].misses || 0) - (a[1].misses || 0)).slice(0, 5);
    overlay.open(`<div class="panel"><p class="panel-kicker">Curator: the reformed Muddle King</p><h1>Mistake Museum</h1><p>Every corrected muddle belongs in a museum!</p>${misses.length ? misses.map(([word, progress]) => `<p><b>${escapeHtml(word)}</b> · ${progress.misses || 0} muddle${progress.misses === 1 ? '' : 's'} fixed</p>`).join('') : '<p>No muddles recorded yet.</p>'}<button class="secondary" data-close-overlay>Leave museum</button></div>`);
  }

  function hiddenGrove() {
    const game = active();
    if (!game.state.progress.story.flags.hiddenGrove) return overlay.dialogue({ title: 'Thick fog', lines: ['The path disappears into silver fog. A restored Brush Fragment may clear it.'] });
    const supportsIdioms = game.levelPackage.config.features.idioms;
    const scrollType = supportsIdioms ? 'Idiom Scroll' : 'Word Wisdom Scroll';
    if ((game.state.progress.scrolls.unlocked || []).some(entry => entry.type === scrollType)) return overlay.dialogue({ title: 'Hidden Grove', lines: ['Elite word spirits patrol the bright clearing. The old chest is empty now.'] });
    const featured = supportsIdioms
      ? game.levelPackage.content.words.find(word => word.isIdiom && word.lesson <= 3)
      : game.levelPackage.content.words.find(word => word.lesson <= 3);
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: featured?.w || 'Region 1 Wisdom', type: scrollType, text: `${featured?.p || ''} · ${featured?.m || 'A special Region 1 word'}` });
    game.state.player.coins += 30;
    commit();
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Hidden Grove chest</p><h1>${escapeHtml(featured?.w || scrollType)}</h1><p>You found a ${supportsIdioms ? 'special idiom' : 'word wisdom'} scroll and 30 coins. Elite creatures now guard this clearing for advanced practice.</p><button class="primary" data-close-overlay>Continue</button></div>`);
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
    if (gameRegion() === 'r2') {
      handlers['elder-sun'] = storyJournal;
      handlers['hawker-lina'] = () => regionTwoRequest('hawker-lina');
      handlers['hawker-centre'] = () => regionTwoRequest('hawker-lina');
      handlers['courier-wei'] = () => regionTwoRequest('courier-wei');
      handlers['granary-door'] = gatekeeper;
      handlers['farmer-tan'] = () => regionTwoRequest('farmer-tan');
      handlers['hill-house'] = () => regionTwoRequest('farmer-tan');
      handlers['return-gate'] = () => onSwitchRegion?.('r1');
      handlers['truth-terrace'] = truthTerrace;
    }
    if (!handlers[object.id]) return false;
    handlers[object.id]();
    return true;
  }

  function gameRegion() {
    return active().levelPackage.region.id;
  }

  return { initialize, recordEvent, questBoard, scrollLibrary, scrollSpot, collectDailyScroll, storyJournal, storyteller, handleInteraction, gatekeeper, startBoss };
}
