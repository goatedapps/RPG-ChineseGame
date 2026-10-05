import { makeExamQuestion } from './learning/questions.js';
import { recordAnswer, tierOf } from './learning/mastery.js?p10f';
import { checkPassageAnswer } from './systems/reading.js?p10f';
import { advanceLanternStreak, claimDailyChest, dailyChestReady, dailyScrollSpot, normalizeDaily, recordDailyEvent, unlockDailyScroll } from './systems/daily.js';
import { applyStoryCommands, bossGateQueue, gateStatus, normalizeStory, recordStoryEvent, regionWords, requestReady } from './systems/story.js?p18';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js?p18';
import { showWritingTask } from './ui/writingView.js?p15';
import { localDay } from './core/time.js';
import { recordActivity } from './systems/parent.js?p10f';
import { capBossDamage, heroStats } from './battle/damage.js?p1';
import { heroDamage } from './battle/battle.js';
import { activeCompanion, activateCompanion, companionStrike, companionCounterattack, partnerVictoryBonus } from './systems/companions.js';
import { companionBattleCard } from './ui/companion.js';
import { createBoss } from './battle/creatures.js';
import { gearBonuses } from './systems/gear.js';
import { creatureSvg } from './battle/creatureArt.js?p10n';
import { heroPortrait } from './ui/heroPortrait.js?p10o';
import { createSpeechController } from './learning/audio.js';
import { applyHealing, useConsumable } from './systems/inventory.js';
import { chooseGateDictationWords, gateDictationPool, gateDictationRules } from './systems/dictation.js';
import { addNeededMaterials } from './systems/crafting.js';
import { completeTidewaterClue, tidewaterClue, tidewaterCluesComplete, tidewaterDictationWords, tidewaterEvidenceReady } from './systems/tidewaterRescue.js?p1';
import { chapterDictationWords, chapterGroupComplete, chapterTask, completeChapterTask } from './systems/chapterQuests.js';
import { routeKey } from './systems/regions.js';
import { battleQuestionBadge } from './ui/battleBadge.js';
import { animateBattleHealth } from './ui/battleHealth.js';
import { completeDictionaryHeart, finaleLedger } from './systems/ending.js';
import { harvestPondPassage } from './content/harvestPond.js';
import { showFinalBlow, showFinalReform, showFinale } from './ui/ending.js';

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

const FRAGMENT_ART = Object.freeze({
  'dawn-stroke': 'assets/images/rewards/dawn-stroke.webp',
  'truth-stroke': 'assets/images/rewards/truth-stroke.webp',
  'current-stroke': 'assets/images/rewards/current-stroke.webp',
  'courage-stroke': 'assets/images/rewards/courage-stroke.webp',
  'harmony-stroke': 'assets/images/rewards/harmony-stroke.webp',
  'memory-stroke': 'assets/images/rewards/memory-stroke.webp',
  'final-stroke': 'assets/images/rewards/final-stroke.webp'
});

const BOSS_ITEM_COPY = Object.freeze({
  heal: item => `Restore at least ${item.amount} HP (${Math.round(item.healFraction * 100)}% max HP)`,
  'full-heal': () => 'Restore all HP',
  escape: () => 'Leave the boss battle safely',
  'attack-boost': item => `Increase successful boss attacks by ${Math.round(item.amount * 8)}%`,
  'defense-boost': item => `Reduce boss counterattacks by ${Math.round(item.amount * 8)}%`
});

export function splitStoryPage(text) {
  const normalized = String(text).replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = (normalized.match(/[^。！？!?]+[。！？!?]+[”"’']*|[^。！？!?]+$/g) || []).map(sentence => sentence.trim()).filter(Boolean);
  if (sentences.length < 2) return [sentences[0] || '', ''];
  const total = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
  let leftLength = 0;
  let splitAt = 1;
  for (let index = 0; index < sentences.length - 1; index += 1) {
    leftLength += sentences[index].length;
    splitAt = index + 1;
    if (leftLength >= total / 2) break;
  }
  return [sentences.slice(0, splitAt).join(''), sentences.slice(splitAt).join('')];
}

function fitStoryPages(spread) {
  for (const page of spread.querySelectorAll('.story-book-page')) {
    let size = Number.parseFloat(getComputedStyle(page).fontSize);
    while (page.scrollHeight > page.clientHeight + 1 && size > 10) {
      size -= 1;
      page.style.fontSize = `${size}px`;
    }
  }
}

export function createAdventure({ overlay, getActive, persist, render, toast, gameplay, audio, onSwitchRegion, onEnterRoute, onGateOpening, onCollectionChanged = () => {} }) {
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
    const completeCount = daily.quests.filter(quest => quest.complete).length;
    const chapterBoard = chapterBoardMarkup(game);
    const chestAction = ready
      ? '<button class="primary" data-daily-chest>Open Daily Chest</button>'
      : `<span class="quest-chest-status" role="status">${daily.chestClaimed ? 'Daily Chest claimed — come back tomorrow.' : `${completeCount}/${daily.quests.length} quests complete — finish the remaining quests to open the chest.`}</span>`;
    overlay.open(`<div class="panel daily-board-panel"><div class="collection-banner daily-board-banner"><div><p class="panel-kicker">Resets at local midnight</p><h1>Daily Quest Board</h1><p>Complete all three quests to open today's chest. Battle quests pause when the daily battle cap is reached.</p></div><img src="assets/images/ui/daily-board.webp" alt="" width="200" height="133"><button class="secondary" data-close-overlay>Close</button></div>${chapterBoard}<section class="daily-quests" aria-label="Today's quests"><div class="daily-section-heading"><div><p class="panel-kicker">A fresh list each day</p><h2>Today's quests</h2></div><strong>${completeCount} of ${daily.quests.length} complete</strong></div><div class="daily-board-progress"><div role="progressbar" aria-label="Daily quests complete" aria-valuemin="0" aria-valuemax="${daily.quests.length}" aria-valuenow="${completeCount}"><i style="width:${daily.quests.length ? completeCount / daily.quests.length * 100 : 0}%"></i></div></div><div class="quest-list">${daily.quests.map((quest, index) => `<article class="quest-card ${quest.complete ? 'complete' : ''} ${quest.event === 'battle-win' && battlePaused && !quest.complete ? 'paused' : ''}"><span class="quest-number">${quest.complete ? '✓' : index + 1}</span><div><b>${escapeHtml(quest.text)}</b><small>${quest.event === 'battle-win' && battlePaused && !quest.complete ? 'Battle quota reached · resumes tomorrow' : quest.complete ? 'Complete' : 'In progress'}</small></div><span class="quest-count">${quest.progress}/${quest.target}</span></article>`).join('')}</div><div class="button-row">${chestAction}<button class="secondary" data-scroll-library>Scroll Library</button></div></section></div>`);
    document.querySelector('[data-daily-chest]')?.addEventListener('click', () => {
      const claimed = claimDailyChest(game.state.progress.daily);
      if (!claimed.ok) return;
      game.state.progress.daily = claimed.daily;
      game.state.player.coins += 30;
      game.state.progress.inventory['rice-ball'] = (game.state.progress.inventory['rice-ball'] || 0) + 1;
      const materials = addNeededMaterials(game.state.progress.materials, { 'mist-drop': 1, 'echo-feather': 1 }, game.levelPackage.recipes, game.state.progress.equipment);
      game.state.progress.materials = materials.materials;
      commit();
      audio?.sfx('win');
      const extra = Object.entries(materials.awarded).map(([id, count]) => `${count} ${id === 'mist-drop' ? 'Mist Drop' : 'Echo Feather'}`).join(' and ');
      overlay.open(`<div class="panel result-panel"><h1>Daily Chest opened!</h1><p>You received 30 coins and one Rice Ball${extra ? `, plus ${extra}` : ''}.</p><button class="primary" data-close-overlay>Continue</button></div>`);
    }, { once: true });
    document.querySelector('[data-scroll-library]').addEventListener('click', scrollLibrary);
    document.querySelector('[data-board-journal]')?.addEventListener('click', storyJournal);
  }

  function chapterBoardMarkup(game) {
    const region = game.levelPackage.region.id;
    if (!['r3', 'r4', 'r6'].includes(region)) return '';
    const story = normalizeStory(game.state.progress.story);
    const chapters = {
      r3: { title: 'Help the stranded whale', location: 'Whale Rescue Dock', done: story.flags.tideWhaleRescued, next: story.bossDefeated ? 'Return to the Rescue Dock and guide the whale to deep water.' : story.flags.tideEvidenceCompared ? 'Find the Tide Pavilion and set the Clock Tower moving.' : 'Collect the three rescue clues, then bring them to Keeper Lan.' },
      r4: { title: 'Bring the play together', location: 'Lantern Theatre', done: story.flags.lanternPerformed, next: story.bossDefeated ? 'Return to the theatre for the final performance.' : story.flags.lanternRehearsed ? 'Face the Mocking Mirror at the Mirror Pavilion.' : 'Gather the stage cues and earlier memories for Director Luo.' },
      r6: { title: 'Reconstruct the ancient account', location: 'Excavation Lodge', done: story.flags.groveDisplayed, next: story.bossDefeated ? 'Return to Curator Wen and put the account on display.' : story.flags.groveAccountCompared ? 'Face the Give-Up Ghost at the Memory Pavilion.' : 'Collect the three records, then compare them with Curator Wen.' }
    };
    const chapter = chapters[region];
    return `<section class="daily-chapter" aria-label="Region story"><div><p class="panel-kicker">${escapeHtml(chapter.location)} · Region story</p><h2>${chapter.title}</h2><p>${chapter.done ? 'Chapter complete. The next road is ready when you are.' : chapter.next}</p></div><button class="secondary" data-board-journal>Open Journal</button></section>`;
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
    const finalReform = sceneId === 'reform' && game.levelPackage.region.id === 'r7';
    const finish = () => {
      const result = applyStoryCommands(game.state.progress.story, commands);
      game.state.progress.story = result.story;
      for (const key of result.rewards) addUnique(game.state.progress.inventory.keyItems, key);
      if (sceneId === 'reform') {
        if (game.levelPackage.region.id === 'r1') game.state.progress.story.flags.hiddenGrove = true;
        game.state.player.coins += 100;
        addUnique(game.state.progress.room.trophies, game.levelPackage.regionStory.fragmentName || (game.levelPackage.region.id === 'r2' ? 'Truth Stroke' : 'Dawn Stroke'));
      }
      commit();
      if (!finalReform) overlay.close();
      onDone?.();
    };
    if (finalReform) return showFinalReform(overlay, dialogue, finish);
    const next = () => {
      if (index >= dialogue.length) return finish();
      const command = dialogue[index++];
      overlay.open(`<div class="dialog-card"><p class="speaker">${escapeHtml(command.speaker)}</p><p>${escapeHtml(command.say)}</p><button class="primary" data-scene-next>${index === dialogue.length ? 'Continue' : 'Next'}</button></div>`, { dismissible: false });
      document.querySelector('[data-scene-next]').addEventListener('click', next, { once: true });
    };
    next();
  }

  function tidewaterJournalMarkup(game, story) {
    if (game.levelPackage.region.id !== 'r3') return '';
    const clues = Object.keys(game.levelPackage.regionStory.rescue.clues).map(id => {
      const clue = tidewaterClue(game.levelPackage, id);
      const done = story.flags.tideClues?.[id] === true;
      return `<li class="${done ? 'done' : ''}"><span aria-hidden="true">${done ? '✓' : '○'}</span><span>${escapeHtml(clue.person)}: ${escapeHtml(clue.name)} · ${clue.requiredCollected} Lesson ${clue.lesson} spirits collected</span></li>`;
    }).join('');
    const compared = story.flags.tideEvidenceCompared;
    const rescued = story.flags.tideWhaleRescued;
    return `<section class="rescue-journal"><div class="chapter-journal-heading"><p class="panel-kicker">The whale rescue</p><h2>Help the stranded whale</h2><p>Collect the Word Spirits each neighbour needs, then speak to them to uncover a rescue clue.</p></div><ol class="chapter-journal-list">${clues}<li class="${compared ? 'done' : ''}"><span aria-hidden="true">${compared ? '✓' : '○'}</span><span>Bring all three clues and the Harbour Chronometer to Keeper Lan</span></li><li class="${rescued ? 'done' : ''}"><span aria-hidden="true">${rescued ? '✓' : '○'}</span><span>${story.bossDefeated ? 'Return to the Whale Rescue Dock to guide the whale' : 'Set the Clock Tower moving by defeating the Idle Clock'}</span></li></ol></section>`;
  }

  function tidewaterKeeperLan() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    if (!story.flags.tideEvidenceCompared && !story.bossDefeated && tidewaterEvidenceReady(story, game.levelPackage.regionStory, game.state.progress.inventory)) {
      return playScene('compare', storyJournal);
    }
    storyJournal();
  }

  function tidewaterClueConversation(id) {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    const clue = tidewaterClue(game.levelPackage, id);
    if (!clue) return;
    const collected = tidewaterDictationWords(game.levelPackage, game.state.progress, id);
    const collectedCount = game.levelPackage.content.words.filter(word => word.lesson === clue.lesson && (game.state.progress.words[word.w]?.collected || game.state.progress.words[word.w]?.c)).length;
    const count = game.levelPackage.regionStory.rescue.wordsPerTest;
    const complete = story.flags.tideClues?.[id] === true;
    const regionZone = game.levelPackage.campaigns.r3.route.zones.find(zone => zone.lesson === clue.lesson);
    const status = complete ? clue.found : collected.length < count
      ? `You have ${collectedCount}/${clue.requiredCollected} collected Lesson ${clue.lesson} spirits for this clue. Explore ${regionZone?.name || 'Saltwind Coast'} to find more, then come back.`
      : clue.prompt;
    overlay.open(`<div class="panel tidewater-clue-panel"><p class="panel-kicker">Whale rescue · ${escapeHtml(clue.name)}</p><h1>${escapeHtml(clue.person)}</h1><p data-type-dialogue>${escapeHtml(status)}</p><div class="button-row">${!complete && collected.length >= count ? '<button class="primary" data-dialogue-next data-tide-test>Help with the clue</button>' : ''}<button class="secondary" data-tide-request>Optional request</button><button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-tide-test]')?.addEventListener('click', () => runTidewaterClueTest(id, collected), { once: true });
    document.querySelector('[data-tide-request]').addEventListener('click', () => regionalRequest(id), { once: true });
  }

  function runTidewaterClueTest(id, words) {
    const game = active();
    const clue = tidewaterClue(game.levelPackage, id);
    const pass = game.levelPackage.regionStory.rescue.correctToPass;
    let index = 0;
    let correct = 0;
    const next = () => {
      if (index === words.length) {
        const success = correct >= pass;
        if (success) {
          game.state.progress.story = completeTidewaterClue(game.state.progress.story, game.levelPackage.regionStory, id, correct);
          audio?.sfx('majorReward');
        }
        commit();
        overlay.open(`<div class="panel result-panel tidewater-clue-panel"><p class="panel-kicker">${escapeHtml(clue.person)} · rescue clue</p><h1>${success ? `${escapeHtml(clue.name)} found!` : 'Practise and try again'}</h1><p>You wrote <b>${correct}/${words.length}</b> words from memory. ${success ? escapeHtml(clue.found) : `You need ${pass} correct answers to earn this clue.`}</p><div class="button-row">${success ? '<button class="primary" data-tide-journal>See rescue plan</button>' : '<button class="primary" data-tide-retry>Try again</button>'}<button class="secondary" data-close-overlay>Later</button></div></div>`);
        document.querySelector('[data-tide-journal]')?.addEventListener('click', storyJournal, { once: true });
        document.querySelector('[data-tide-retry]')?.addEventListener('click', () => runTidewaterClueTest(id, words), { once: true });
        return;
      }
      const word = words[index++];
      showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        const recorded = recordAnswer(game.state.progress.words[word.w], { skill: 'w', correct: result.ok, day: localDay(), assisted: !result.earnsTick });
        game.state.progress.words[word.w] = recorded.progress;
        const accuracy = game.state.progress.accuracy.w || { correct: 0, total: 0 };
        game.state.progress.accuracy.w = { correct: accuracy.correct + Number(result.ok), total: accuracy.total + 1 };
        if (result.ok) {
          correct += 1;
          recordEvent('writing-success', { word: word.w, lesson: word.lesson });
        }
        if (recorded.tickEarned) onCollectionChanged();
        audio?.sfx(result.ok ? 'correct' : 'wrong');
        commit();
        overlay.open(`<div class="panel result-panel tidewater-clue-panel"><p class="panel-kicker">${escapeHtml(clue.person)} · ${index}/${words.length}</p><h1>${result.ok ? 'Correct!' : 'Keep practising'}</h1><p>${escapeHtml(word.w)} · ${escapeHtml(word.p)} · ${escapeHtml(word.m)}</p><p>${result.ok ? 'This word counts towards the clue.' : 'Using Show me how helps you learn, but does not count as a correct word this time.'}</p><button class="primary" data-tide-next>Continue</button></div>`, { dismissible: false });
        document.querySelector('[data-tide-next]').addEventListener('click', next, { once: true });
      }, { runId: `tide-${id}-${Date.now()}-${index}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, forceMemory: true, headerHtml: `<p class="panel-kicker">${escapeHtml(clue.person)} · rescue dictation ${index}/${words.length}</p>`, onExit: () => { commit(); overlay.close(); } });
    };
    next();
  }

  function tidewaterRescueDock() {
    const game = active();
    const story = game.state.progress.story;
    if (story.flags.tideWhaleRescued) return overlay.dialogue({ title: 'Whale Rescue Dock', lines: ['The young whale is safely in deep water. Sometimes we can see her beyond the harbour markers.'] });
    if (story.bossDefeated) return playScene('rescue', () => {
      audio?.sfx('majorReward');
      overlay.open('<div class="panel tidewater-rescue-panel"><img src="assets/images/story/tidewater-whale-rescue.webp" alt="The rescued young whale swims into deep water beside the harbour boats at sunrise" width="1200" height="675"><div><p class="panel-kicker">Tidewater Bay restored</p><h1>The whale is free!</h1><p>Fisher Yu’s route, Maker Chen’s gauge and Watcher An’s timing brought the rescue crew together. The Clock Tower is moving again.</p><button class="primary" data-close-overlay>Continue the journey</button></div></div>');
    });
    const clues = Object.keys(game.levelPackage.regionStory.rescue.clues).filter(id => story.flags.tideClues?.[id]).length;
    overlay.open(`<div class="panel tidewater-clue-panel"><p class="panel-kicker">Whale Rescue Dock</p><h1>Prepare the rescue</h1><p>The whale is waiting in the shallows. The crew has ${clues}/3 clues. Collect Word Spirits and talk to Fisher Yu, Maker Chen and Watcher An in any order. Then bring their clues and the Harbour Chronometer to Keeper Lan.</p><div class="button-row"><button class="primary" data-tide-fisher>Talk to Fisher Yu</button><button class="secondary" data-close-overlay>Return to town</button></div></div>`);
    document.querySelector('[data-tide-fisher]').addEventListener('click', () => tidewaterClueConversation('fisher-yu'), { once: true });
  }

  function chapterStory(game, regionId) {
    return normalizeStory(regionId === game.levelPackage.region.id
      ? game.state.progress.story
      : game.state.progress.regions?.[regionId]?.story);
  }

  function setChapterStory(game, regionId, story) {
    if (regionId === game.levelPackage.region.id) game.state.progress.story = story;
    else game.state.progress.regions[regionId].story = story;
  }

  function lanternMemoryAvailable(game, id) {
    const saved = game.state.progress.regions?.r4?.story;
    if (!saved || saved.bossDefeated || saved.flags?.lanternRehearsed) return false;
    const chapter = game.levelPackage.campaigns.r4.regionStory.chapter;
    if (!chapterGroupComplete(saved, chapter, 'cues')) return false;
    if (id === 'memory-r3') return game.levelPackage.region.id === 'r3';
    if (id === 'memory-r2') return game.levelPackage.region.id === 'r2' && saved.flags.chapterTasks?.['memory-r3'];
    return game.levelPackage.region.id === 'r1' && saved.flags.chapterTasks?.['memory-r2'];
  }

  function showChapterImage(scene, title, copy, alt) {
    const game = active();
    const src = game.levelPackage.regionStory.chapter.art[scene];
    audio?.sfx('majorReward');
    overlay.open(`<div class="panel chapter-scene-panel"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="1199" height="675"><div><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p><button class="primary" data-close-overlay>Continue</button></div></div>`);
  }

  function chapterTaskConversation(chapterRegion, id) {
    const game = active();
    const chapter = game.levelPackage.campaigns[chapterRegion].regionStory.chapter;
    const task = chapterTask(game.levelPackage, chapterRegion, id);
    const story = chapterStory(game, chapterRegion);
    const words = chapterDictationWords(game.levelPackage, game.state.progress, chapterRegion, id);
    const lessons = game.levelPackage.config.regionLessons[task.region];
    const collectedCount = game.levelPackage.content.words.filter(word => lessons.includes(word.lesson) && (task.lesson === null || word.lesson === task.lesson) && (game.state.progress.words[word.w]?.collected || game.state.progress.words[word.w]?.c)).length;
    const complete = story.flags.chapterTasks?.[id] === true;
    const subject = task.lesson === null ? game.levelPackage.campaigns[task.region].region.name : `Lesson ${task.lesson}`;
    const status = complete ? task.found : words.length < chapter.wordsPerTest
      ? `You have ${collectedCount}/${task.requiredCollected} collected ${subject} spirits for this clue. Find more in this region, then return.`
      : task.prompt;
    overlay.open(`<div class="panel chapter-task-panel"><p class="panel-kicker">${escapeHtml(chapterRegion === 'r4' ? 'Theatre performance' : 'Ancient account')} · ${escapeHtml(task.name)}</p><h1>${escapeHtml(task.person)}</h1><p data-type-dialogue>${escapeHtml(status)}</p><div class="button-row">${!complete && words.length >= chapter.wordsPerTest ? '<button class="primary" data-dialogue-next data-chapter-test>Help recover the clue</button>' : ''}${task.region === chapterRegion ? '<button class="secondary" data-chapter-request>Optional request</button>' : ''}<button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-chapter-test]')?.addEventListener('click', () => runChapterDictation(chapterRegion, id, words), { once: true });
    document.querySelector('[data-chapter-request]')?.addEventListener('click', () => regionalRequest(id), { once: true });
  }

  function runChapterDictation(chapterRegion, id, words) {
    const game = active();
    const chapter = game.levelPackage.campaigns[chapterRegion].regionStory.chapter;
    const task = chapterTask(game.levelPackage, chapterRegion, id);
    let index = 0;
    let correct = 0;
    const next = () => {
      if (index === words.length) {
        const success = correct >= chapter.correctToPass;
        const localChapter = game.levelPackage.region.id === chapterRegion;
        if (success) setChapterStory(game, chapterRegion, completeChapterTask(chapterStory(game, chapterRegion), chapter, id, correct));
        commit();
        overlay.open(`<div class="panel result-panel chapter-task-panel"><p class="panel-kicker">${escapeHtml(task.person)} · ${escapeHtml(task.name)}</p><h1>${success ? 'Memory recovered!' : 'Practise and try again'}</h1><p>You wrote <b>${correct}/${words.length}</b> words from memory. ${success ? escapeHtml(task.found) : `You need ${chapter.correctToPass} correct answers to earn this part.`}</p><div class="button-row">${success ? `<button class="primary" data-chapter-journal>${localChapter ? 'See the Journal' : 'Continue the journey'}</button>` : '<button class="primary" data-chapter-retry>Try again</button>'}<button class="secondary" data-close-overlay>Later</button></div></div>`);
        document.querySelector('[data-chapter-journal]')?.addEventListener('click', localChapter ? storyJournal : () => overlay.close(), { once: true });
        document.querySelector('[data-chapter-retry]')?.addEventListener('click', () => runChapterDictation(chapterRegion, id, words), { once: true });
        return;
      }
      const word = words[index++];
      showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        const recorded = recordAnswer(game.state.progress.words[word.w], { skill: 'w', correct: result.ok, day: localDay(), assisted: !result.earnsTick });
        game.state.progress.words[word.w] = recorded.progress;
        const accuracy = game.state.progress.accuracy.w || { correct: 0, total: 0 };
        game.state.progress.accuracy.w = { correct: accuracy.correct + Number(result.ok), total: accuracy.total + 1 };
        if (result.ok) {
          correct += 1;
          recordEvent('writing-success', { word: word.w, lesson: word.lesson });
        }
        if (recorded.tickEarned) onCollectionChanged();
        audio?.sfx(result.ok ? 'correct' : 'wrong');
        commit();
        overlay.open(`<div class="panel result-panel chapter-task-panel"><p class="panel-kicker">${escapeHtml(task.person)} · ${index}/${words.length}</p><h1>${result.ok ? 'Correct!' : 'Keep practising'}</h1><p>${escapeHtml(word.w)} · ${escapeHtml(word.p)} · ${escapeHtml(word.m)}</p><p>${result.ok ? 'This word counts towards the chapter.' : 'Show me how helps you learn, but does not count as a correct word this time.'}</p><button class="primary" data-chapter-next>Continue</button></div>`, { dismissible: false });
        document.querySelector('[data-chapter-next]').addEventListener('click', next, { once: true });
      }, { runId: `chapter-${chapterRegion}-${id}-${Date.now()}-${index}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, forceMemory: true, headerHtml: `<p class="panel-kicker">${escapeHtml(task.person)} · ${index}/${words.length}</p>`, onExit: () => { commit(); overlay.close(); } });
    };
    next();
  }

  function lanternDirector() {
    const game = active();
    const story = chapterStory(game, 'r4');
    const chapter = game.levelPackage.regionStory.chapter;
    if (!story.flags.lanternRehearsed && chapterGroupComplete(story, chapter, 'memories') && (game.state.progress.inventory.keyItems || []).includes(game.levelPackage.regionStory.readingKeyItem)) {
      return playScene('rehearsal', () => showChapterImage('rehearsal', 'The cast keeps going', 'When Min misses a line, the others give her the cue. The play can continue.', 'The cast helps Min through a missed line while the Mocking Mirror cracks behind the stage'));
    }
    storyJournal();
  }

  function lanternTheatre() {
    const story = active().state.progress.story;
    if (story.bossDefeated && !story.flags.lanternPerformed) return playScene('performance', () => showChapterImage('performance', 'The play has its ending', 'The cast finishes together under lantern flowers and harvest garlands.', 'The Lantern Theatre company performs together before a cheering village audience'));
    storyJournal();
  }

  function groveCurator() {
    const game = active();
    const story = game.state.progress.story;
    if (!story.flags.groveAccountCompared && chapterGroupComplete(story, game.levelPackage.regionStory.chapter, 'evidence') && (game.state.progress.inventory.keyItems || []).includes(game.levelPackage.regionStory.readingKeyItem)) {
      return groveEvidenceBoard();
    }
    storyJournal();
  }

  function groveEvidenceBoard() {
    const board = active().levelPackage.regionStory.chapter.board;
    const examined = new Set();
    const renderBoard = () => {
      const allExamined = board.evidence.every(item => examined.has(item.id));
      overlay.open(`<div class="panel chapter-evidence-panel"><div class="panel-header"><div><p class="panel-kicker">Ancient Grove · evidence board</p><h1>Reconstruct the account</h1></div><button class="secondary" data-close-overlay>Later</button></div><p>${escapeHtml(board.intro)}</p><div class="chapter-evidence-grid">${board.evidence.map(item => `<button type="button" data-grove-evidence="${escapeHtml(item.id)}" aria-pressed="${examined.has(item.id)}"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(examined.has(item.id) ? item.detail : 'Examine this record')}</span></button>`).join('')}</div>${allExamined ? `<fieldset class="chapter-evidence-choices"><legend>${escapeHtml(board.question)}</legend>${board.choices.map(choice => `<button type="button" data-grove-choice="${escapeHtml(choice.id)}">${escapeHtml(choice.label)}</button>`).join('')}</fieldset><p class="chapter-evidence-feedback" role="status"></p>` : '<p>Examine all three records to compare them.</p>'}</div>`);
      for (const button of document.querySelectorAll('[data-grove-evidence]')) button.addEventListener('click', () => {
        examined.add(button.dataset.groveEvidence);
        renderBoard();
      });
      for (const button of document.querySelectorAll('[data-grove-choice]')) button.addEventListener('click', () => {
        const choice = board.choices.find(item => item.id === button.dataset.groveChoice);
        if (!choice?.correct) {
          audio?.sfx('wrong');
          document.querySelector('.chapter-evidence-feedback').textContent = 'One record would be lost. Compare the three pieces and try another way.';
          return;
        }
        audio?.sfx('correct');
        playScene('compare', () => showChapterImage('compare', 'The correction is the clue', 'The researchers compare the fragments, copied line and living roots. They keep the uncertain mark visible.', 'Researchers compare old fragments and root patterns at a table in Ancient Grove'));
      });
    };
    renderBoard();
  }

  function groveLodge() {
    const story = active().state.progress.story;
    if (story.bossDefeated && !story.flags.groveDisplayed) return playScene('display', () => showChapterImage('display', 'The account is complete', 'Curator Wen displays the recovered account with its correction for everyone to study.', 'Curator Wen and villagers view the completed account inside the living tree library'));
    storyJournal();
  }

  function chapterJournalMarkup(game, story) {
    const regionId = game.levelPackage.region.id;
    if (regionId !== 'r4' && regionId !== 'r6') return '';
    const chapter = game.levelPackage.regionStory.chapter;
    const groups = regionId === 'r4' ? ['cues', 'memories'] : ['evidence'];
    const heading = regionId === 'r4' ? 'Bring the play together' : 'Reconstruct the ancient account';
    const tasks = groups.map(group => Object.keys(chapter.tasks).filter(id => chapter.tasks[id].group === group).map(id => {
      const task = chapterTask(game.levelPackage, regionId, id);
      const done = story.flags.chapterTasks?.[id] === true;
      const place = game.levelPackage.campaigns[task.region].region.name;
      return `<li class="${done ? 'done' : ''}"><span aria-hidden="true">${done ? '✓' : '○'}</span><span>Collect ${task.requiredCollected} ${task.lesson === null ? escapeHtml(place) : `Lesson ${task.lesson}`} spirits; speak to ${escapeHtml(task.person)} about ${escapeHtml(task.name.toLowerCase())}</span></li>`;
    }).join('')).join('');
    const compared = regionId === 'r4' ? story.flags.lanternRehearsed : story.flags.groveAccountCompared;
    const finished = regionId === 'r4' ? story.flags.lanternPerformed : story.flags.groveDisplayed;
    const compareText = regionId === 'r4' ? 'Bring the memories and Lantern Stage Pass to Director Luo for rehearsal' : 'Bring the evidence and Oracle Rubbing Kit to Curator Wen';
    const finishText = regionId === 'r4' ? 'Return to Lantern Theatre for the performance' : 'Return to the Excavation Lodge to display the account';
    return `<section class="rescue-journal"><div class="chapter-journal-heading"><p class="panel-kicker">${regionId === 'r4' ? 'The theatre production' : 'The recovered account'}</p><h2>${heading}</h2><p>Gather the clues the team needs to complete the story.</p></div><ol class="chapter-journal-list">${tasks}<li class="${compared ? 'done' : ''}"><span aria-hidden="true">${compared ? '✓' : '○'}</span><span>${compareText}</span></li><li class="${finished ? 'done' : ''}"><span aria-hidden="true">${finished ? '✓' : '○'}</span><span>${story.bossDefeated ? finishText : `Defeat the ${escapeHtml(game.levelPackage.regionStory.bossName)}, then ${finishText.toLowerCase()}`}</span></li></ol></section>`;
  }

  function storyJournal() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    game.state.progress.story = story;
    const gateRules = gateDictationRules(game.state.settings);
    const gateTask = story.flags.gateDictationPassed ? '✓ Gate dictation passed' : `○ Gate dictation: ${gateRules.pass} correct out of ${gateRules.count}`;
    if (!story.flags.arrival) return playScene('arrival', () => {
      if (game.state.progress.tutorial?.step < 16) {
        game.state.progress.story.flags.tutorial = true;
        commit();
      } else storyJournal();
    });
    if (game.levelPackage.region.id !== 'r1') {
      const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
      const requestsDone = Object.keys(game.levelPackage.regionStory.requests).filter(id => (story.requests[id] || 0) >= 3).length;
      const regionNumber = Number(game.levelPackage.region.id.slice(1));
      const requestTotal = Object.keys(game.levelPackage.regionStory.requests).length;
      const fragmentName = game.levelPackage.regionStory.fragmentName || 'Truth Stroke';
      const chapterReady = regionNumber === 3 ? story.flags.tideEvidenceCompared : regionNumber === 4 ? story.flags.lanternRehearsed : regionNumber === 6 ? story.flags.groveAccountCompared : true;
      const bossReady = gate.open && chapterReady;
      const postBossTask = regionNumber === 3 && !story.flags.tideWhaleRescued ? 'Return to the Whale Rescue Dock before using the onward gate.' : regionNumber === 4 && !story.flags.lanternPerformed ? 'Return to Lantern Theatre for the performance before using the onward gate.' : regionNumber === 6 && !story.flags.groveDisplayed ? 'Return to the Excavation Lodge to finish the account before using the onward gate.' : 'Find the onward gate.';
      const routeNote = regionNumber < 7 ? `<p>Explore ${escapeHtml(game.levelPackage.campaigns[game.levelPackage.region.id].route.name)}${game.levelPackage.map.route ? '' : ' beyond the town gate'}. ${story.bossDefeated ? postBossTask : 'Find its pavilion and onward gate.'}</p>` : `<p>Explore Crown Veil Trail beyond the summit exit. Find the hidden Final Seal Pavilion after freeing enough spirits.</p>`;
      const rescueJournal = tidewaterJournalMarkup(game, story) + chapterJournalMarkup(game, story);
      const returnAction = game.levelPackage.map.route ? 'leave' : 'back';
      overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Region ${regionNumber}</p><h1>${escapeHtml(game.levelPackage.region.name)} Journal</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="story-timeline"><p class="done">✓ Arrived in ${escapeHtml(game.levelPackage.region.name)}</p><p class="${story.storiesRead.length ? 'done' : ''}">${story.storiesRead.length ? '✓' : '○'} Heard a regional story</p>${rescueJournal}<p class="${requestsDone === requestTotal ? 'done' : ''}">${requestsDone === requestTotal ? '✓' : '○'} ${[3, 4, 6].includes(regionNumber) ? 'Optional neighbour requests' : 'Helped neighbours'}: ${requestsDone}/${requestTotal}</p>${routeNote}<p>${bossReady ? `✓ ${escapeHtml(game.levelPackage.regionStory.bossPlace)} gate ready` : `○ ${escapeHtml(game.levelPackage.regionStory.bossPlace)}: ${gate.bronze}/${gate.required} Bronze · ${escapeHtml(game.levelPackage.regionStory.gateKeyName)} ${gate.lantern ? 'ready' : 'missing'}${!chapterReady ? ' · complete the chapter investigation' : ''}`}</p><p class="${story.bossDefeated ? 'done' : ''}">${story.bossDefeated ? `✓ ${escapeHtml(fragmentName)} restored` : `○ Face the ${escapeHtml(game.levelPackage.regionStory.bossName)}`}</p>${regionNumber < 7 ? `<p class="${story.flags.gateDictationPassed ? 'done' : ''}">${gateTask}</p>` : ''}</div><div class="button-row"><button class="secondary" data-travel-previous>${returnAction === 'leave' ? 'Return to town' : 'Enter the return road'}</button></div></div>`);
      document.querySelector('[data-travel-previous]').addEventListener('click', () => onEnterRoute?.(returnAction));
      return;
    }
    if (!story.flags.attic) {
      story.flags.attic = true;
      commit();
    }
    if (!story.flags.tutorial) return gameplay.tutorialBattle(() => {
      active().state.progress.story.flags.tutorial = true;
      commit();
      overlay.open('<div class="panel result-panel"><h1>The adventure begins</h1><p>Visit the Storyteller to hear the first village story, then take the north gate to Mistwood Road when you are ready to meet wild creatures.</p><button class="primary" data-close-overlay>Explore</button></div>');
    });
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Region 1</p><h1>Adventure Journal</h1></div><button class="secondary" data-close-overlay>Close</button></div><div class="story-timeline"><p class="done">✓ Arrived in Scholar Village</p><p class="${story.flags.tutorial ? 'done' : ''}">${story.flags.tutorial ? '✓' : '○'} Found the Spirit Brush handle</p><p class="${story.storiesRead.includes(1) ? 'done' : ''}">${story.storiesRead.includes(1) ? '✓' : '○'} Heard the Camping Forest story</p><p>○ Help Xiaoqiang, Mr Lin and Chef Mei</p><p>Explore Mistwood Road through the north village gate; discover the Muddle Pavilion and the eastern town gate.</p><p>${gate.open ? '✓ Muddle Pavilion ready' : `○ Muddle Pavilion: ${gate.bronze}/${gate.required} Bronze · Cave Lantern ${gate.lantern ? 'ready' : 'missing'}`}</p><p class="${story.bossDefeated ? 'done' : ''}">${story.bossDefeated ? '✓ Dawn Stroke restored' : '○ Reform the Muddle King'}</p><p class="${story.flags.gateDictationPassed ? 'done' : ''}">${gateTask}</p></div>${story.bossDefeated ? '<div class="button-row"><button class="secondary" data-museum>Mistake Museum</button></div>' : ''}</div>`);
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
      overlay.open(`<article class="panel story-reader-panel"><header class="story-reader-header"><div><p class="panel-kicker">Lesson ${lesson} · Page ${page + 1}/${storyData.pages.length}</p><h1>${escapeHtml(storyData.title)}</h1></div></header><div class="story-book-spread" aria-label="${escapeHtml(pageText)}"><div class="story-book-page story-book-left">${escapeHtml(leftPage)}</div><div class="story-book-page story-book-right">${escapeHtml(rightPage)}</div></div><div class="story-reader-actions"><button class="secondary" data-story-dictation>Dictation · Read page aloud</button><button class="primary" data-story-next>${lastPage ? 'Finish story' : 'Next page'}</button></div></article>`, { dismissible: false, onClose: speech.stop });
      fitStoryPages(document.querySelector('.story-book-spread'));
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
      game.state.progress.materials = addNeededMaterials(game.state.progress.materials, { 'mist-drop': 3, 'ink-bead': 2 }, game.levelPackage.recipes, game.state.progress.equipment).materials;
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
      let feathers = 0;
      if (won) {
        game.state.progress.story.rivalDuels += 1;
        game.state.player.coins += 20;
        const materials = addNeededMaterials(game.state.progress.materials, { 'echo-feather': 2 }, game.levelPackage.recipes, game.state.progress.equipment);
        game.state.progress.materials = materials.materials;
        feathers = materials.awarded['echo-feather'] || 0;
        commit();
      }
      overlay.open(`<div class="panel result-panel"><h1>${won ? 'You won the duel!' : 'Ah Dong wins this round'}</h1><p>${score}/${total} correct.${won ? ` You received 20 coins${feathers ? ` and ${feathers} Echo Feather${feathers === 1 ? '' : 's'}` : ''}.` : ' Practise and challenge him again.'}</p><button class="primary" data-close-overlay>Continue</button></div>`);
    }), { once: true });
  }

  function gatekeeper() {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    if (story.bossDefeated) {
      if (game.levelPackage.region.id === 'r7') return dictionaryHeart();
      return overlay.dialogue({ title: game.levelPackage.map.objects?.find(object => object.id === 'boss-pavilion-building')?.name || 'Boss Pavilion', lines: ['The boss has left this pavilion. Find the onward gate to continue your journey.'] });
    }
    if (game.levelPackage.region.id === 'r3' && !story.flags.tideEvidenceCompared) {
      const missing = tidewaterCluesComplete(story, game.levelPackage.regionStory)
        ? 'Bring the three clues and the Harbour Chronometer to Keeper Lan before challenging the Idle Clock.'
        : 'Collect Word Spirits and speak to Fisher Yu, Maker Chen and Watcher An for their rescue clues, then return to Keeper Lan.';
      return overlay.dialogue({ title: 'Tide Pavilion', lines: [missing] });
    }
    if (game.levelPackage.region.id === 'r4' && !story.flags.lanternRehearsed) {
      return overlay.dialogue({ title: 'Mirror Pavilion', lines: ['Prepare the three stage cues with Min, Qiao and Su. Travel back through Tidewater Bay, Harvest Crossing and Scholar Village for their memories, then bring the Lantern Stage Pass to Director Luo for rehearsal.'] });
    }
    if (game.levelPackage.region.id === 'r6' && !story.flags.groveAccountCompared) {
      return overlay.dialogue({ title: 'Memory Pavilion', lines: ['Collect Word Spirits and speak to Mo, Yu and He to recover their evidence. Bring all three parts and the Oracle Rubbing Kit to Curator Wen before challenging the Give-Up Ghost.'] });
    }
    const gate = gateStatus(game.levelPackage, game.state.progress, game.state.progress.inventory, game.levelPackage.regionStory.gateBronzePct);
    const open = gate.open;
    const bossName = game.levelPackage.regionStory.bossName || 'Muddle King';
    const place = game.levelPackage.regionStory.bossPlace || 'Muddle Cave';
    const keyName = game.levelPackage.regionStory.gateKeyName || 'Cave Lantern';
    overlay.open(`<div class="panel"><p class="panel-kicker">${escapeHtml(place)} gate</p><h1>${open ? 'The gate is open' : 'Build your strength'}</h1><p>You need <b>${gate.required} Word Spirits</b> at Bronze or better. You have ${gate.bronze}.</p><p>${escapeHtml(keyName)}: <b>${gate.lantern ? 'ready' : 'not yet'}</b>.</p><div class="button-row">${open ? `<button class="primary" data-boss-start>Challenge ${escapeHtml(bossName)}</button>` : ''}<button class="secondary" data-close-overlay>Return</button></div></div>`);
    document.querySelector('[data-boss-start]')?.addEventListener('click', startBoss, { once: true });
  }

  function startBoss() {
    const regionLessons = active().levelPackage.config.regionLessons[active().levelPackage.region.id] || [];
    const queue = bossGateQueue(active().levelPackage.content, active().levelPackage.config, regionLessons);
    const boss = createBoss(active().levelPackage.balance, regionLessons);
    const startingPlayer = active().state.player;
    const battle = { queue, ...boss, hp: boss.maxHp, index: 0, displayedHealth: [startingPlayer.hp / startingPlayer.maxHp, 1] };
    const companion = activeCompanion(active().state.progress, active().levelPackage.companions);
    const companionControls = resume => {
      document.querySelector('[data-companion-skill]')?.addEventListener('click', () => {
        if (!activateCompanion(battle, active().state.player, companion)) return;
        commit();
        resume();
      }, { once: true });
    };
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
    const bossBag = resume => {
      const game = active();
      const usableEffects = new Set(Object.keys(BOSS_ITEM_COPY));
      const owned = game.levelPackage.items.filter(item => usableEffects.has(item.effect) && game.state.progress.inventory[item.id] > 0);
      overlay.open(`<div class="panel"><p class="panel-kicker">Boss battle bag</p><h1>Choose an item</h1><div class="service-grid">${owned.map(item => `<button data-use-boss-item="${item.id}"><b>${escapeHtml(item.name)} × ${game.state.progress.inventory[item.id]}</b><span>${escapeHtml(BOSS_ITEM_COPY[item.effect](item))}</span></button>`).join('') || '<p>Your usable boss-battle items are empty.</p>'}</div><div class="button-row"><button class="secondary" data-back-boss>Back to battle</button></div></div>`, { dismissible: false });
      document.querySelector('[data-back-boss]').addEventListener('click', resume, { once: true });
      for (const button of document.querySelectorAll('[data-use-boss-item]')) button.addEventListener('click', () => {
        const item = game.levelPackage.items.find(candidate => candidate.id === button.dataset.useBossItem);
        const consumed = useConsumable(game.state.progress.inventory, item.id);
        if (!consumed.ok) return;
        game.state.progress.inventory = consumed.inventory;
        if (item.effect === 'heal' || item.effect === 'full-heal') game.state.player = applyHealing(game.state.player, item);
        if (item.effect === 'attack-boost') battle.attackBoost = Math.max(battle.attackBoost || 0, item.amount || 1);
        if (item.effect === 'defense-boost') battle.defenseBoost = Math.max(battle.defenseBoost || 0, item.amount || 1);
        if (item.effect === 'escape') {
          commit();
          overlay.close();
          audio?.setScene('village');
          toast('The Smoke Ball carried you safely away from the boss.');
          return;
        }
        commit();
        toast(`${item.name} used.`);
        resume();
      }, { once: true });
    };
    audio?.setScene('boss');
    const next = () => {
      if (battle.hp <= 0) return bossWin();
      if (!battle.queue.length) battle.queue = bossGateQueue(active().levelPackage.content, active().levelPackage.config, regionLessons);
      const task = battle.queue.shift();
      const finish = correct => {
        const game = active();
        const bonuses = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
        let damage = 0;
        if (correct) {
          damage = capBossDamage(heroDamage(game.state.player.level, battle, { writing: task.kind === 'writing', bonusDamage: (task.kind === 'writing' ? bonuses.skillDamage.w : 0) + (battle.attackBoost || 0), roll: Math.random() * 3 }), battle.maxHp);
          damage = companionStrike(battle, game.state.player, damage);
          battle.hp = Math.max(0, battle.hp - damage);
          audio?.sfx('hit');
        } else battle.queue.push(task);
        let counter = { damage: 0, evaded: false };
        if (battle.hp > 0) {
          counter = companionCounterattack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion, damageReduction: bonuses.spellDefense, defenseBoost: battle.defenseBoost, damageMultiplier: correct ? 0.8 : 1 }, battle);
          game.state.player = counter.player;
          if (counter.damage > 0) audio?.sfx('playerHit');
        }
        if (game.state.player.hp === 0) {
          overlay.open(bossPanel('<p class="panel-kicker">The final counterattack</p><h1>Your hero needs a rest</h1>'), { dismissible: false });
          animateBattleHealth(battle, game.state.player, battle.hp);
          return setTimeout(() => {
            game.state.player.hp = game.state.player.maxHp;
            if (game.levelPackage.map.route) onEnterRoute?.('rest');
            commit();
            audio?.setScene('defeat');
            overlay.open(bossPanel(`<h1>The ${escapeHtml(game.levelPackage.regionStory.bossName || 'Muddle King')} overwhelmed you</h1><p>You woke at the Inn with full HP. Your progress is safe; grow stronger and try again.</p><button class="primary" data-close-overlay>Recover</button>`), { onClose: () => audio?.setScene('village') });
          }, 650);
        }
        commit();
        const bossName = game.levelPackage.regionStory.bossName || 'Muddle King';
        if (battle.hp <= 0) {
          audio?.setScene('victory');
          const bossArt = creatureSvg(game.levelPackage.region.boss, '');
          if (game.levelPackage.region.id === 'r7') {
            showFinalBlow(overlay, bossWin);
            return;
          }
          overlay.open(`<article class="battle-scene boss-victory-scene"><div class="boss-victory-stage"><div class="boss-victory-hero">${heroPortrait(game.state.progress.equipment?.equipped, 'victory-hero')}</div><div class="boss-victory-boss boss-split-left" aria-hidden="true">${bossArt}</div><div class="boss-victory-boss boss-split-right" aria-hidden="true">${bossArt}</div><div class="boss-victory-slash" aria-hidden="true"></div></div><div class="battle-console"><p class="panel-kicker">Victory</p><h1>${escapeHtml(bossName)} defeated!</h1><p>Your final spell dealt ${damage} damage. The Spirit Brush is ready to be restored.</p><button class="primary" data-boss-victory>Continue the story</button></div></article>`, { dismissible: false });
          document.querySelector('[data-boss-victory]').addEventListener('click', bossWin, { once: true });
          return;
        }
        const counterText = counter.evaded ? ' You dodged the counterattack.' : ` ${bossName} struck back for ${counter.damage} damage.`;
        const showTurnResult = () => {
          overlay.open(bossPanel(`<p class="panel-kicker">${escapeHtml(task.phase)}</p><h1>${correct ? 'Spell broken!' : 'The spell returns to the queue'}</h1><p>${correct ? `You dealt ${damage} damage. ` : ''}${escapeHtml(bossName)} HP ${battle.hp}/${battle.maxHp}.${counterText}</p><div class="button-row"><button class="primary" data-boss-next>Next spell</button><button class="secondary" data-boss-bag>Open bag</button></div>${companionBattleCard(companion, battle)}`), { dismissible: false });
          animateBattleHealth(battle, game.state.player, battle.hp);
          document.querySelector('[data-boss-next]').addEventListener('click', next, { once: true });
          document.querySelector('[data-boss-bag]').addEventListener('click', () => bossBag(showTurnResult), { once: true });
          companionControls(showTurnResult);
        };
        showTurnResult();
      };
      if (task.kind === 'writing') {
        const game = active();
        showWritingTask(overlay, task.word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
          game.state.progress.characters = characters;
          audio?.sfx(result.ok ? 'correct' : 'wrong');
          finish(result.ok);
        }, { runId: `boss-${Date.now()}-${battle.hp}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, forceMemory: true, headerHtml: arena() + battleQuestionBadge('attack') });
        return;
      }
      if (task.item.format === 'Fill-in') {
        overlay.open(`<article class="panel question-panel battle-question boss-question">${arena()}${battleQuestionBadge('attack')}<p class="panel-kicker">${escapeHtml(task.phase)} · ${escapeHtml(game.levelPackage.regionStory.bossName)} HP ${battle.hp}/${battle.maxHp}</p><h2>${escapeHtml(task.item.q)}</h2><label class="answer-field">Your answer<input data-boss-answer autocomplete="off"></label><div class="button-row"><button class="primary" data-boss-check>Break spell</button><button class="secondary" data-boss-giveup>I don't know</button></div></article>`, { dismissible: false });
        const check = answer => {
          const ok = checkPassageAnswer(task.item, answer);
          audio?.sfx(ok ? 'correct' : 'wrong');
          finish(ok);
        };
        document.querySelector('[data-boss-check]').addEventListener('click', () => check(document.querySelector('[data-boss-answer]').value), { once: true });
        document.querySelector('[data-boss-giveup]').addEventListener('click', () => check(''), { once: true });
        return;
      }
      const question = makeExamQuestion(task.item);
      showQuestion(overlay, question, null, result => finish(result.ok), { title: `${task.phase} · ${active().levelPackage.regionStory.bossName} HP ${battle.hp}/${battle.maxHp}`, headerHtml: arena() + battleQuestionBadge('attack'), onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
    };
    const showBossReady = () => {
      overlay.open(bossPanel(`<p class="panel-kicker">Boss challenge</p><h1>${escapeHtml(active().levelPackage.regionStory.bossName)} awaits</h1><p>Prepare before breaking the first spell.</p><div class="button-row"><button class="primary" data-boss-next>Begin battle</button><button class="secondary" data-boss-bag>Open bag</button></div>${companionBattleCard(companion, battle)}`), { dismissible: false });
      document.querySelector('[data-boss-next]').addEventListener('click', next, { once: true });
      document.querySelector('[data-boss-bag]').addEventListener('click', () => bossBag(showBossReady), { once: true });
      companionControls(showBossReady);
    };
    showBossReady();
  }

  function bossWin() {
    if (active().levelPackage.region.id !== 'r7') audio?.setScene('village');
    playScene('reform', () => {
      audio?.sfx('majorReward');
      const game = active();
      const partnerCoins = partnerVictoryBonus(game.state.progress);
      game.state.player.coins += partnerCoins;
      const fragment = game.levelPackage.regionStory.fragmentKey || (game.levelPackage.region.id === 'r2' ? 'truth-stroke' : 'dawn-stroke');
      const fragmentName = game.levelPackage.regionStory.fragmentName || (game.levelPackage.region.id === 'r2' ? 'Truth Stroke' : 'Dawn Stroke');
      const fragmentArt = FRAGMENT_ART[fragment] || FRAGMENT_ART['dawn-stroke'];
      if (game.levelPackage.region.id !== 'r1') addUnique(game.state.progress.room.trophies, fragmentName);
      commit();
      if (game.levelPackage.region.id === 'r7') return dictionaryHeart();
      const secretText = game.levelPackage.region.id === 'r3'
        ? 'The Clock Tower moves again. Return to the Whale Rescue Dock to guide the young whale into deep water.'
        : game.levelPackage.region.id === 'r4'
        ? 'The cast is waiting. Return to Lantern Theatre and finish the performance.'
        : game.levelPackage.region.id === 'r6'
        ? 'The researchers are waiting. Return to the Excavation Lodge to complete the account.'
        : game.levelPackage.region.id === 'r1'
        ? 'The hidden grove is open, and the Muddle King now runs the Mistake Museum.'
        : `${game.levelPackage.regionStory.secretName || 'The hidden place'} can now be opened.`;
      overlay.open(`<div class="panel result-panel boss-victory major-reward-panel"><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)} restored</p><div class="major-reward"><img src="${fragmentArt}" alt="${fragmentName}"><div><p class="panel-kicker">Major reward</p><h1>${fragmentName} obtained!</h1></div></div><p>${escapeHtml(secretText)}</p>${partnerCoins ? `<p>Your ${partnerCoins === 12 ? 'Golden' : 'Elite'} partner earned ${partnerCoins} bonus coins for this victory.</p>` : ''}<button class="primary" data-close-overlay>${game.levelPackage.map.route ? 'Continue exploring' : `Return to ${escapeHtml(game.levelPackage.region.name)}`}</button></div>`);
    });
  }

  function nextRegionGate() {
    const game = active();
    if (game.levelPackage.region.id === 'r3' && game.state.progress.story.bossDefeated && !game.state.progress.story.flags.tideWhaleRescued) {
      return overlay.dialogue({ title: 'Road to Lantern Theatre', lines: ['The Clock Tower is moving, but the whale is still in the shallows. Return to the Whale Rescue Dock and help the crew guide her to deep water first.'] });
    }
    if (game.levelPackage.region.id === 'r4' && game.state.progress.story.bossDefeated && !game.state.progress.story.flags.lanternPerformed) {
      return overlay.dialogue({ title: 'Road to Festival City', lines: ['The Mirror is gone, but the company has not performed its finished play. Return to Lantern Theatre first.'] });
    }
    if (game.levelPackage.region.id === 'r6' && game.state.progress.story.bossDefeated && !game.state.progress.story.flags.groveDisplayed) {
      return overlay.dialogue({ title: 'Road to Treehouse Summit', lines: ['The Give-Up Ghost is gone, but the ancient account is still unfinished. Return to the Excavation Lodge and complete the display first.'] });
    }
    const currentNumber = Number(game.levelPackage.region.id.slice(1));
    const nextNumber = currentNumber + 1;
    const nextRegionId = `r${nextNumber}`;
    const nextCampaign = game.levelPackage.campaigns[nextRegionId];
    if (!nextCampaign) return overlay.dialogue({ title: 'The road ahead', lines: ['This road will open in a future chapter.'] });
    const words = regionWords(game.levelPackage);
    const { count, pass } = gateDictationRules(game.state.settings);
    const available = gateDictationPool(words, game.state.progress.words).length;
    const fragmentReady = Boolean(game.state.progress.story.bossDefeated);
    const passed = Boolean(game.state.progress.story.flags.gateDictationPassed);
    const ready = fragmentReady && passed;
    const fragmentName = game.levelPackage.regionStory.fragmentName || (currentNumber === 1 ? 'Dawn Stroke' : 'Truth Stroke');
    const travel = async () => {
      game.state.settings.unlockedRegions = Math.max(nextNumber, game.state.settings.unlockedRegions);
      const route = game.state.progress.routes?.[routeKey(game.levelPackage.region.id)];
      if (game.levelPackage.map.route && route && !route.gateOpened) {
        route.gateOpened = true;
        commit();
        if (onGateOpening) {
          let switched = false;
          await onGateOpening(() => { switched = true; onSwitchRegion?.(nextRegionId); });
          if (!switched) onSwitchRegion?.(nextRegionId);
          return;
        }
      }
      onSwitchRegion?.(nextRegionId);
    };
    const runGateTest = () => {
      const testWords = chooseGateDictationWords(words, game.state.progress.words, count);
      if (testWords.length < count) return toast(`Collect ${count - testWords.length} more regional Word Spirits before the gate test.`);
      let index = 0;
      let correct = 0;
      const next = () => {
        if (index === testWords.length) {
          const success = correct >= pass;
          if (success) {
            game.state.progress.story.flags.gateDictationPassed = true;
            commit();
          }
          overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Gate dictation</p><h1>${success ? 'Gate test passed!' : 'Keep practising'}</h1><p>You wrote <b>${correct}/${count}</b> words correctly from memory. ${success ? `You needed ${pass} to pass.` : `You need ${pass} correct answers to pass. Try again when you are ready.`}</p><div class="button-row">${success ? `<button class="primary" data-travel-next>Travel to ${escapeHtml(nextCampaign.region.name)}</button>` : '<button class="primary" data-gate-retry>Try again</button>'}<button class="secondary" data-close-overlay>Later</button></div></div>`);
          document.querySelector('[data-travel-next]')?.addEventListener('click', travel, { once: true });
          document.querySelector('[data-gate-retry]')?.addEventListener('click', runGateTest, { once: true });
          return;
        }
        const word = testWords[index++];
        showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
          game.state.progress.characters = characters;
          audio?.sfx(result.ok ? 'correct' : 'wrong');
          if (result.ok) correct += 1;
          next();
        }, { runId: `gate-${Date.now()}-${index}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, forceMemory: true, headerHtml: `<p class="panel-kicker">Gate dictation · ${index}/${count}</p>`, onExit: () => { commit(); overlay.close(); } });
      };
      next();
    };
    const bossName = game.levelPackage.regionStory.bossName || (currentNumber === 1 ? 'Muddle King' : 'regional boss');
    const gateInstruction = ready ? 'The gate is open.' : !fragmentReady ? `Defeat the ${bossName} in the ${game.levelPackage.regionStory.bossPlace || 'boss pavilion'}, then return to this gate.` : `Pass a ${count}-word dictation from memory: ${pass} correct answers are needed.`;
    overlay.open(`<div class="panel"><p class="panel-kicker">Road to ${escapeHtml(nextCampaign.region.name)}</p><h1>${fragmentReady ? `${escapeHtml(fragmentName)} restored` : `Defeat the ${escapeHtml(bossName)}`}</h1><p>${escapeHtml(gateInstruction)}</p>${!ready && fragmentReady && available < count ? `<p>Collect ${count - available} more regional Word Spirits before the test.</p>` : ''}<div class="button-row">${ready ? `<button class="primary" data-travel-next>Travel to ${escapeHtml(nextCampaign.region.name)}</button>` : fragmentReady && available >= count ? '<button class="primary" data-gate-test>Begin gate dictation</button>' : ''}<button class="secondary" data-close-overlay>Return</button></div></div>`);
    document.querySelector('[data-travel-next]')?.addEventListener('click', travel, { once: true });
    document.querySelector('[data-gate-test]')?.addEventListener('click', runGateTest, { once: true });
  }

  function regionalRequest(id) {
    const game = active();
    const story = normalizeStory(game.state.progress.story);
    const request = game.levelPackage.regionStory.requests[id];
    const lessonWords = game.levelPackage.content.words.filter(word => word.lesson === request.lesson);
    const collected = lessonWords.filter(word => game.state.progress.words[word.w]?.collected).length;
    const step = story.requests[id] || 0;
    const ready = step === 0 ? collected >= 3 : step === 1 ? (story.counters.creatures[request.creature] || 0) >= request.count : step === 2 ? story.storiesRead.includes(request.lesson) : false;
    const tasks = [`Collect three Lesson ${request.lesson} Spirit cards (${collected}/3).`, `Defeat ${request.count} ${request.creature.split('-').join(' ')} creatures (${story.counters.creatures[request.creature] || 0}/${request.count}).`, `Hear the Lesson ${request.lesson} story from the Storyteller.`];
    if (step >= 3) return overlay.dialogue({ title: request.name, lines: [`Thank you. ${request.reward} has brought neighbours together again.`] });
    overlay.open(`<div class="panel"><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)} request · ${step + 1}/3</p><h1>${escapeHtml(request.name)}</h1><p>${escapeHtml(tasks[step])}</p><div class="button-row">${ready ? `<button class="primary" data-regional-request>Complete step</button>` : ''}<button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-regional-request]')?.addEventListener('click', () => {
      story.requests[id] = step + 1;
      game.state.progress.story = story;
      if (story.requests[id] === 3) {
        game.state.player.coins += 40;
        game.state.progress.inventory['rice-ball'] = (game.state.progress.inventory['rice-ball'] || 0) + 1;
        audio?.sfx('majorReward');
      }
      recordEvent('villager-help', { id });
      commit();
      regionalRequest(id);
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

  function tideVault() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Current-shaped lock', lines: ['The Tide Vault waits for the Current Stroke.'] });
    if (game.state.progress.story.flags.tideVault) return overlay.dialogue({ title: 'Tide Vault', lines: ['The rescue log reads: “A moment used kindly is never wasted.”'] });
    game.state.progress.story.flags.tideVault = true;
    game.state.player.coins += 70;
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: 'Tide Vault Rescue Log', type: 'Secret Scroll', text: 'A moment used kindly is never wasted.' });
    commit();
    overlay.open('<div class="panel result-panel"><p class="panel-kicker">Current Stroke secret</p><h1>The Tide Vault opens</h1><p>The rescued whale’s first journey is recorded inside. You found a Secret Scroll and 70 coins.</p><button class="primary" data-close-overlay>Continue</button></div>');
  }

  function courageLoft() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Brush-shaped seal', lines: ['The Courage Loft waits for the Courage Stroke.'] });
    if (game.state.progress.story.flags.courageLoft) return overlay.dialogue({ title: 'Courage Loft', lines: ['The old mask reads: “A brave voice may shake and still be heard.”'] });
    game.state.progress.story.flags.courageLoft = true;
    game.state.player.coins += 80;
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: 'Courage Loft Playbill', type: 'Secret Scroll', text: 'A brave voice may shake and still be heard.' });
    commit();
    overlay.open('<div class="panel result-panel"><p class="panel-kicker">Courage Stroke secret</p><h1>The oldest mask shines</h1><p>You found the first Lantern Theatre playbill, a Secret Scroll and 80 coins.</p><button class="primary" data-close-overlay>Continue</button></div>');
  }

  function harmonyPavilion() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Twin-stroke seal', lines: ['The Harmony Pavilion waits for the Harmony Stroke.'] });
    if (game.state.progress.story.flags.harmonyPavilion) return overlay.dialogue({ title: 'Harmony Pavilion', lines: ['The peace bell reads: “Listening turns two voices into one path forward.”'] });
    game.state.progress.story.flags.harmonyPavilion = true;
    game.state.player.coins += 90;
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: 'Harmony Pavilion Bell', type: 'Secret Scroll', text: 'Listening turns two voices into one path forward.' });
    commit();
    overlay.open('<div class="panel result-panel"><p class="panel-kicker">Harmony Stroke secret</p><h1>The peace bell rings</h1><p>You found the city founders’ pledge, a Secret Scroll and 90 coins.</p><button class="primary" data-close-overlay>Continue</button></div>');
  }

  function memoryVault() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Remembering seal', lines: ['The Memory Vault waits for the Memory Stroke.'] });
    if (game.state.progress.story.flags.memoryVault) return overlay.dialogue({ title: 'Memory Vault', lines: ['The first promise reads: “What we practise with care becomes part of us.”'] });
    game.state.progress.story.flags.memoryVault = true;
    game.state.player.coins += 100;
    game.state.progress.scrolls.unlocked.unshift({ day: localDay(), title: 'The Grove’s First Promise', type: 'Secret Scroll', text: 'What we practise with care becomes part of us.' });
    commit();
    overlay.open('<div class="panel result-panel"><p class="panel-kicker">Memory Stroke secret</p><h1>The first promise returns</h1><p>You found the oldest grove record, a Secret Scroll and 100 coins.</p><button class="primary" data-close-overlay>Continue</button></div>');
  }

  function dictionaryHeart() {
    const game = active();
    if (!game.state.progress.story.bossDefeated) return overlay.dialogue({ title: 'Sleeping Dictionary Heart', lines: ['The Tree waits for the Final Stroke of the Spirit Brush.'] });
    completeDictionaryHeart(game.levelPackage, game.state, localDay());
    commit();
    audio?.sfx('majorReward');
    audio?.setScene('intro');
    showFinale(overlay, finaleLedger(game.levelPackage, game.state), () => {
      game.state.progress.flags.endingSeen = true;
      commit();
      onSwitchRegion?.('r1');
      homecoming();
    });
  }

  function homecoming() {
    const game = active();
    const ledger = finaleLedger(game.levelPackage, game.state);
    const remaining = ledger.missing.map(entry => `<li><b>${escapeHtml(entry.region)}:</b> ${escapeHtml(entry.name)}</li>`).join('');
    game.state.progress.flags.grandmaHomecomingSeen = true;
    commit();
    overlay.open(`<div class="panel homecoming-panel"><div class="homecoming-copy"><p class="panel-kicker">Back in Scholar Village</p><h1>Grandma Wang welcomes you home</h1><p>“You brought the Word Spirits home and saved the Great Dictionary Tree. I am so proud of you. Every village now has a Word Portal, so you can visit our friends whenever you wish.”</p>${ledger.missing.length ? `<p>There are still ${ledger.missing.length} optional discoveries to find. Talk to neighbours, finish Spirit sets, and explore the hidden places. Nothing is missable.</p><details><summary>See every remaining discovery</summary><ul>${remaining}</ul></details>` : '<p>You have found every optional discovery. What a wonderful journey!</p>'}</div><div class="homecoming-actions"><button class="primary" data-close-overlay>Explore the restored world</button></div></div>`, { dismissible: false });
  }

  function wordPortal() {
    const game = active();
    if (!game.state.progress.flags.worldRestored) return false;
    const destinations = Object.values(game.levelPackage.campaigns).map(campaign => {
      const current = campaign.region.id === game.levelPackage.region.id;
      return `<button class="portal-destination${current ? ' is-current' : ''}" type="button" data-portal-region="${campaign.region.id}" ${current ? 'aria-current="location" disabled' : ''}><span class="portal-destination-number" aria-hidden="true">${campaign.region.id.slice(1)}</span><span class="portal-destination-name">${escapeHtml(campaign.region.name)}</span>${current ? '<span class="portal-destination-status">You are here</span>' : ''}</button>`;
    }).join('');
    overlay.open(`<div class="panel portal-panel"><header class="portal-header"><h1>Word Portal</h1><p>The restored Tree connects every village.</p></header><div class="portal-body"><p class="portal-intro">Choose where to go. Your progress and discoveries travel with you.</p><div class="portal-destinations" aria-label="Villages">${destinations}</div></div><div class="portal-footer"><button class="secondary" type="button" data-close-overlay>Stay here</button></div></div>`);
    for (const button of document.querySelectorAll('[data-portal-region]:not([disabled])')) button.addEventListener('click', () => onSwitchRegion?.(button.dataset.portalRegion), { once: true });
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

  function whisperingTree() {
    const image = 'assets/images/secrets/spirit-brush-whisper.png';
    overlay.open(`<div class="panel secret-tree-panel"><img src="${image}" alt="A glowing Spirit Brush rests among old tree roots and drifting Word Spirits" width="960" height="720"><div><p class="panel-kicker">Scholar Village · old tree</p><h1>A picture in the roots</h1><p>The Spirit Brush left a trace here. The picture seems to hold more than it shows.</p><div class="button-row"><a class="primary" href="${image}" download="spirit-brush-whisper.png">Save picture</a><button class="secondary" data-close-overlay>Continue exploring</button></div></div></div>`);
  }

  function harvestPond() {
    overlay.open(`<div class="panel harvest-pond-panel"><div class="pond-header"><div><p class="panel-kicker">Harvest Crossing / Schoolhouse Pond</p><h1>The Brush and the wandering pond</h1></div><button class="secondary" data-close-overlay>Close</button></div><p class="pond-passage">${escapeHtml(harvestPondPassage)}</p></div>`);
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
      'whispering-tree': whisperingTree,
      'harvest-decoy-tree': () => overlay.dialogue({ title: 'Old tree', lines: ['Not so easy! The real easter egg is somewhere else in this town'] }),
      'word-portal': wordPortal,
      gatekeeper
    };
    if (gameRegion() === 'r1') {
      handlers['grandma-wang'] = () => lanternMemoryAvailable(active(), 'memory-r1') ? chapterTaskConversation('r4', 'memory-r1') : active().state.progress.flags.worldRestored ? homecoming() : storyJournal();
      handlers['route-entrance'] = () => onEnterRoute?.('enter');
      handlers['return-village'] = () => onEnterRoute?.('leave');
      handlers['boss-pavilion-door'] = gatekeeper;
      handlers['next-region-gate'] = nextRegionGate;
    }
    if (gameRegion() === 'r2') {
      handlers['elder-sun'] = () => lanternMemoryAvailable(active(), 'memory-r2') ? chapterTaskConversation('r4', 'memory-r2') : storyJournal();
      handlers['hawker-lina'] = () => regionalRequest('hawker-lina');
      handlers['hawker-centre'] = () => regionalRequest('hawker-lina');
      handlers['courier-wei'] = () => regionalRequest('courier-wei');
      handlers['granary-door'] = gatekeeper;
      handlers['farmer-tan'] = () => regionalRequest('farmer-tan');
      handlers['hill-house'] = () => regionalRequest('farmer-tan');
      handlers['return-gate'] = () => onSwitchRegion?.('r1');
      handlers['next-region-gate'] = nextRegionGate;
      handlers['truth-terrace'] = truthTerrace;
    }
    if (gameRegion() === 'r3') {
      handlers['keeper-lan'] = () => lanternMemoryAvailable(active(), 'memory-r3') ? chapterTaskConversation('r4', 'memory-r3') : tidewaterKeeperLan();
      handlers['fisher-yu'] = () => tidewaterClueConversation('fisher-yu');
      handlers['rescue-dock'] = tidewaterRescueDock;
      handlers['maker-chen'] = () => tidewaterClueConversation('maker-chen');
      handlers['watcher-an'] = () => tidewaterClueConversation('watcher-an');
      handlers['tide-workshop'] = () => tidewaterClueConversation('maker-chen');
      handlers['clock-tower-door'] = gatekeeper;
      handlers['clock-warden'] = gatekeeper;
      handlers['return-gate'] = () => onSwitchRegion?.('r2');
      handlers['tide-vault'] = tideVault;
      handlers['next-region-gate'] = nextRegionGate;
    }
    if (gameRegion() === 'r4') {
      handlers['director-luo'] = lanternDirector;
      handlers['actor-min'] = () => chapterTaskConversation('r4', 'actor-min');
      handlers['theatre-door'] = lanternTheatre;
      handlers['farmer-qiao'] = () => chapterTaskConversation('r4', 'farmer-qiao');
      handlers['gardener-su'] = () => chapterTaskConversation('r4', 'gardener-su');
      handlers['farmhouse-door'] = () => chapterTaskConversation('r4', 'gardener-su');
      handlers['mirror-stage-door'] = gatekeeper;
      handlers['mirror-keeper'] = gatekeeper;
      handlers['return-gate'] = () => onSwitchRegion?.('r3');
      handlers['courage-loft'] = courageLoft;
      handlers['next-region-gate'] = nextRegionGate;
    }
    if (gameRegion() === 'r5') {
      handlers['mayor-shen'] = storyJournal;
      handlers['keeper-bao'] = () => regionalRequest('keeper-bao');
      handlers['harmony-dojo'] = () => regionalRequest('keeper-bao');
      handlers['artist-cai'] = () => regionalRequest('artist-cai');
      handlers['gardener-ren'] = () => regionalRequest('gardener-ren');
      handlers['festival-workshop'] = () => regionalRequest('gardener-ren');
      handlers['dragon-gate-door'] = gatekeeper;
      handlers['dragon-warden'] = gatekeeper;
      handlers['return-gate'] = () => onSwitchRegion?.('r4');
      handlers['harmony-pavilion'] = harmonyPavilion;
      handlers['next-region-gate'] = nextRegionGate;
    }
    if (gameRegion() === 'r6') {
      handlers['curator-wen'] = groveCurator;
      handlers['researcher-mo'] = () => chapterTaskConversation('r6', 'researcher-mo');
      handlers['excavation-lodge'] = groveLodge;
      handlers['scribe-yu'] = () => chapterTaskConversation('r6', 'scribe-yu');
      handlers['arborist-he'] = () => chapterTaskConversation('r6', 'arborist-he');
      handlers['root-library'] = () => chapterTaskConversation('r6', 'arborist-he');
      handlers['ghost-archive-door'] = gatekeeper;
      handlers['memory-keeper'] = gatekeeper;
      handlers['return-gate'] = () => onSwitchRegion?.('r5');
      handlers['memory-vault'] = memoryVault;
      handlers['next-region-gate'] = nextRegionGate;
    }
    if (gameRegion() === 'r7') {
      handlers['keeper-ming'] = storyJournal;
      handlers['builder-ru'] = () => regionalRequest('builder-ru');
      handlers['branch-workshop'] = () => regionalRequest('builder-ru');
      handlers['gardener-shui'] = () => regionalRequest('gardener-shui');
      handlers['water-garden'] = () => regionalRequest('gardener-shui');
      handlers['reader-lin'] = () => regionalRequest('reader-lin');
      handlers['return-gate'] = () => onSwitchRegion?.('r6');
      handlers['dictionary-heart'] = dictionaryHeart;
    }
    const game = active();
    if (game.levelPackage.map.route) {
      handlers['boss-pavilion-door'] = gatekeeper;
      handlers['next-region-gate'] = nextRegionGate;
      handlers['return-village'] = () => onEnterRoute?.('leave');
    } else {
      const route = game.levelPackage.campaigns[gameRegion()]?.route;
      if (route) {
        handlers['next-region-gate'] = () => onEnterRoute?.('enter');
        handlers['route-entrance'] = () => onEnterRoute?.('enter');
        for (const bossId of ['granary-door', 'gatekeeper', 'clock-tower-door', 'clock-warden', 'mirror-stage-door', 'mirror-keeper', 'dragon-gate-door', 'dragon-warden', 'ghost-archive-door', 'memory-keeper']) {
          if (handlers[bossId]) handlers[bossId] = () => overlay.dialogue({ title: route.name, lines: [`The boss awaits at the ${route.objects.find(item => item.id === 'boss-pavilion-building').name} beyond the town gate.`] });
        }
      }
      if (Number(gameRegion().slice(1)) > 1) handlers['return-gate'] = () => onEnterRoute?.('back');
    }
    if (!handlers[object.id]) return false;
    handlers[object.id]();
    return true;
  }

  function gameRegion() {
    return active().levelPackage.region.id;
  }

  return { initialize, recordEvent, questBoard, scrollLibrary, scrollSpot, collectDailyScroll, storyJournal, storyteller, handleInteraction, harvestPond, gatekeeper, startBoss };
}
