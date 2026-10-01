import { battleRewardAmounts, createBattleState, enemyAttack, escapeSucceeded, gainBattleRewards, playerAttack } from './battle/battle.js?p10f';
import { createCreature, creatureSpellName } from './battle/creatures.js?p19';
import { heroStats } from './battle/damage.js';
import { creatureSvg } from './battle/creatureArt.js?p10n';
import { buyItem } from './systems/economy.js';
import { applyHealing, useConsumable } from './systems/inventory.js';
import { gearBonuses } from './systems/gear.js';
import { partnerBonuses, partnerMove } from './systems/partners.js?p10f';
import { battlesLeft, useBattle } from './systems/energy.js';
import { ensureParentPin, giftSpiritCards, goalProgress, parentPinMatches, setParentPin, setTestingPlayerLevel, weeklySummary } from './systems/parent.js?p15';
import { weightedCreature } from './world/encounters.js?p10e';
import { exportSaveEnvelope, importSaveEnvelope } from './core/save.js?p10h';
import { xpToNextLevel } from './core/progression.js';
import { checkPassageAnswer, completePassage, normalizeReading, repairActiveReading, selectPassage } from './systems/reading.js?p10g';
import { normalizeSchool, schoolRun, weekKey } from './systems/school.js';
import { chooseDictationWords, chooseGuidedDictationWord, dictationLessons, dictationResult, gateDictationRules } from './systems/dictation.js';
import { filterSupportedQuestions, enabledQuestionKinds } from './learning/examAdapters.js';
import { makeExamQuestion, makeQuestion } from './learning/questions.js?p1';
import { completeReview, isReviewDue, normalizeWordProgress, recordAnswer, SKILLS, SKILL_TICKS_REQUIRED, starsOf, tierOf } from './learning/mastery.js?p10f';
import { eligibleBattleWords, recommendedSkill, selectWord } from './learning/selection.js?p10i';
import { localDay } from './core/time.js';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js?p19';
import { showWritingTask } from './ui/writingView.js?p14';
import { createSpeechController } from './learning/audio.js';
import { heroPortrait } from './ui/heroPortrait.js?p10o';
import { battleQuestionBadge } from './ui/battleBadge.js';
import { animateBattleHealth } from './ui/battleHealth.js';
import { downloadSaveFile, readSaveFile } from './ui/saveTransfer.js';

const SHOP_ITEM_COPY = Object.freeze({
  heal: item => `Restore at least ${item.amount} HP (${Math.round(item.healFraction * 100)}% max HP) during battle`,
  'full-heal': () => 'Restore all HP during battle',
  'writing-retry': () => 'Retry one writing challenge safely',
  escape: () => 'Guarantee a safe escape from battle',
  'attack-boost': item => `Increase attack damage by ${Math.round(item.amount * 8)}% for one battle`,
  'defense-boost': item => `Reduce incoming damage by ${Math.round(item.amount * 8)}% for one battle`,
  repellent: item => `Prevent forest encounters for ${item.amount} forest steps`,
  'repel-mastered': item => `Avoid Silver and Gold Word Spirits for ${item.amount} forest steps`
});

const itemDescription = item => (SHOP_ITEM_COPY[item.effect]?.(item) || item.effect);
const itemIcon = id => `assets/images/shop/${id}.webp`;
const BAIT_PRICE = 10;
const rewardArt = (id, name) => `<div class="major-reward"><img src="assets/images/rewards/${id}.webp" alt="${escapeHtml(name)}"><div><p class="panel-kicker">Major reward</p><h1>${escapeHtml(name)} received!</h1></div></div>`;
const passageRewardArt = (id, name) => id === 'cave-lantern' ? rewardArt('cave-lantern', 'Cave Lantern') : rewardArt(id, name);
const passageScroll = text => `<div class="passage-art"><div class="passage-text" role="region" aria-label="Passage text" tabindex="0">${escapeHtml(text).replaceAll('\n', '<br>')}</div></div>`;

export function passageReviewMarkup(group, item, answer = null) {
  return `<div class="passage-review"><h3>Review the question</h3><p>${escapeHtml(item.q)}</p>${answer === null ? '' : `<p class="passage-review-answer"><b>Answer:</b> ${escapeHtml(answer || 'Discuss this answer with an adult.')}</p>`}<details class="passage-scroll" open><summary>Read ${escapeHtml(group.passage.title)} again</summary>${passageScroll(group.passage.text)}</details></div>`;
}

export function passageChoices(group, item) {
  return item.format === 'Fill-in' && Array.isArray(group.optionBank) ? group.optionBank : item.o || [];
}

function addXp(player, amount, { xpMultiplier = 1, maxHpBonus = 0 } = {}) {
  let level = player.level;
  let xp = player.xp + Math.round(amount * xpMultiplier);
  let maxHp = player.maxHp;
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    maxHp = 18 + level * 2 + maxHpBonus;
  }
  return { ...player, level, xp, maxHp, hp: level > player.level ? maxHp : player.hp };
}

function accuracyRecord(accuracy, skill, ok) {
  const current = accuracy[skill] || { correct: 0, total: 0 };
  return { ...accuracy, [skill]: { correct: current.correct + (ok ? 1 : 0), total: current.total + 1 } };
}

function levelUpMarkup(before, after) {
  if (after.level <= before.level) return '';
  const oldStats = heroStats(before.level);
  const newStats = heroStats(after.level);
  return `<div class="level-up"><strong>LEVEL UP!</strong><p>Level ${before.level} → ${after.level} · Max HP ${before.maxHp} → ${after.maxHp}</p><p>ATK ${oldStats.attack} → ${newStats.attack} · DEF ${oldStats.defense} → ${newStats.defense} · Evasion ${Math.round(oldStats.evasion * 100)}% → ${Math.round(newStats.evasion * 100)}%</p></div>`;
}

function accuracyLabel(skill) {
  if (skill === 'reading') return 'Reading comprehension';
  return SKILLS[skill]?.name || skill;
}

export function makeBattleQuestion(word, skill, words, authoredQuestions = []) {
  if (skill === 'u') {
    const matches = authoredQuestions.filter(question => (
      (question.kind === 'usage' || question.kind === 'vocab')
      && question.word === word.w
      && question.lessons?.includes(word.lesson)
      && question.subject !== 'Higher Chinese'
      && Array.isArray(question.o)
      && question.o.length >= 2
      && question.o.includes(question.c)
    ));
    const usage = matches.filter(question => question.kind === 'usage');
    const candidates = usage.length ? usage : matches;
    if (candidates.length) return { ...makeExamQuestion(candidates[Math.floor(Math.random() * candidates.length)]), skill };
  }
  const question = makeQuestion(word, skill, words);
  return skill === 'h' ? { ...question, prompt: word.m } : question;
}

export function schoolQuestionPool(levelPackage) {
  const lessons = new Set(levelPackage.config.regionLessons[levelPackage.region.id] || []);
  return filterSupportedQuestions(levelPackage.content, levelPackage.config)
    .filter(question => question.lessons?.length && question.lessons.every(lesson => lessons.has(lesson)));
}

export function innReviewPool(levelPackage, progress) {
  const lessons = new Set(levelPackage.config.regionLessons[levelPackage.region.id] || []);
  const regionalWords = levelPackage.content.words.filter(word => lessons.has(word.lesson));
  const review = regionalWords
    .filter(word => progress.words[word.w]?.collected || progress.words[word.w]?.c)
    .sort((a, b) => starsOf(progress.words[a.w]) - starsOf(progress.words[b.w]));
  return { regionalWords, review };
}

export function createGameplay({ overlay, storage, getActive, persist, render, toast, audio, onSwitchLevel = () => {}, onSwitchPlayer = () => {}, onSwitchRegion = () => {}, onReturnToVillage = () => {}, onBattleQuotaExhausted = () => {}, onImportSave = () => { throw new Error('Save import is unavailable.'); }, onCollectionChanged = () => {}, onProgressEvent = () => {}, onTutorialAction = () => {}, onSkipTutorial = () => {}, tutorialStep = () => null }) {
  ensureParentPin(storage);
  let parentNoticeTimer = null;
  const parentFeedbackDraft = { message: '', email: '', open: false };
  let battleActive = false;
  const active = () => getActive();
  const speech = createSpeechController();
  const wordsForLesson = lesson => active().levelPackage.content.words.filter(word => word.lesson === lesson);
  const commit = (options = {}) => { persist(options); render(); };
  const playLevelUp = (before, after) => { if (after.level > before.level) audio?.sfx('level'); };

  function progressionBonuses(game) {
    const gear = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const wordsById = Object.fromEntries(game.levelPackage.content.words.map(word => [word.id, word]));
    const partners = partnerBonuses(game.state.progress.partners, wordsById, game.state.progress.words);
    return { xpMultiplier: 1 + gear.xp, maxHpBonus: gear.maxHp + partners.maxHp };
  }

  function recordWord(word, skill, ok, assisted = false, playFeedback = true) {
    const game = active();
    const recorded = recordAnswer(game.state.progress.words[word.w], { skill, correct: ok, day: localDay(), assisted });
    game.state.progress.words[word.w] = recorded.progress;
    game.state.progress.accuracy = accuracyRecord(game.state.progress.accuracy, skill, ok);
    if (playFeedback) audio?.sfx(ok ? 'correct' : 'wrong');
    if (skill === 'w' && ok) onProgressEvent('writing-success', { word: word.w, lesson: word.lesson });
    return recorded;
  }

  function questionForBattle(battle, skill, done) {
    const game = active();
    if (skill === 'w') {
      showWritingTask(overlay, battle.word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        if (!result.ok && battle.inkRetry) {
          battle.inkRetry = false;
          game.state.progress.characters = characters;
          toast('The Ink Pot lets you retry without a penalty.');
          questionForBattle(battle, skill, done);
          return;
        }
        game.state.progress.characters = characters;
        recordWord(battle.word, 'w', result.ok, !result.earnsTick);
        done(result.ok, 'w');
      }, { runId: `battle-${game.state.progress.battles}-${battle.turn}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, headerHtml: battleQuestionBadge('attack') });
      return;
    }
    const question = makeBattleQuestion(battle.word, skill, game.levelPackage.content.words, game.levelPackage.content.questions.single);
    showQuestion(overlay, question, null, result => {
      recordWord(battle.word, skill, result.ok, false, false);
      done(result.ok, skill);
    }, { title: SKILLS[skill].action, headerHtml: battleQuestionBadge('attack'), revealWord: battle.word, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong'), readFeedback: word => speech.speak(`${word.w}。${word.ex}`, { rate: game.state.settings.speechRate }), stopFeedback: speech.stop });
  }

  function guidedBattlePrompt(lines, onDone) {
    overlay.tutorialDialogue(lines, onDone);
  }

  function showBattle(battle, message = '') {
    const game = active();
    const resolving = battle.finished || game.state.player.hp <= 0;
    const recommended = recommendedSkill(game.state.progress.words[battle.word.w]);
    const bonuses = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const hero = heroStats(game.state.player.level);
    const lead = game.levelPackage.content.words.find(word => word.id === game.state.progress.partners[0]);
    const move = partnerMove(lead, lead && game.state.progress.words[lead.w], game.levelPackage.wordTags);
    overlay.open(`<article class="battle-scene lesson-${battle.word.lesson}">
      <div class="battle-arena">
        <div class="battle-player">${heroPortrait(game.state.progress.equipment?.equipped, 'battle-hero')}<div class="battle-nameplate"><b>You · Lv ${game.state.player.level}</b><small>ATK ${hero.attack} · DEF ${hero.defense} · EVA ${Math.round(hero.evasion * 100)}%</small><div class="enemy-hp player-hp"><i style="width:${game.state.player.hp / game.state.player.maxHp * 100}%"></i></div><strong>HP ${game.state.player.hp}/${game.state.player.maxHp}</strong></div></div>
        <div class="battle-enemy ${battle.creature.variant}" style="--creature:${battle.creature.color}"><div class="battle-nameplate"><b>${battle.creature.variant === 'golden' ? 'Golden ' : battle.creature.variant === 'elite' ? 'Elite ' : ''}${escapeHtml(battle.creature.name)} · Lv ${battle.creature.level}</b><small>ATK ${battle.creature.attack} · DEF ${battle.creature.defense} · Weak to ${escapeHtml(SKILLS[battle.creature.weak].name)}</small><div class="enemy-hp"><i style="width:${battle.enemyHp / battle.creature.maxHp * 100}%"></i></div><strong>HP ${battle.enemyHp}/${battle.creature.maxHp}</strong></div><div class="creature-art">${creatureSvg(battle.creature.id, '？')}</div></div>
      </div>
      <div class="battle-console"><p class="panel-kicker">${battle.review ? 'Gold spirit review' : `${battle.creature.variant === 'elite' ? 'Elite' : battle.creature.variant === 'golden' ? 'Golden' : 'Wild'} word spirit`} · Lesson ${battle.word.lesson}</p><h2 tabindex="-1" data-battle-title>Your turn${battle.streak >= 2 ? ` · ${battle.streak} correct in a row!` : ''}</h2>${message ? `<p class="battle-message">${escapeHtml(message)}</p>` : '<p class="battle-message">The spirit’s identity stays sealed until you win. Choose an attack.</p>'}
        <div class="attack-grid">${Object.entries(SKILLS).map(([key, skill]) => `<button type="button" data-attack="${key}" ${resolving || battle.tutorialNeedsBag ? 'disabled' : ''} class="${key === battle.creature.weak ? 'weak-to' : ''} ${key === recommended ? 'recommended' : ''} ${battle.guided && !battle.tutorialNeedsBag && key === recommended ? 'tutorial-arrow' : ''}"><b>${escapeHtml(skill.action)}</b><span>${escapeHtml(skill.name)}${key === battle.creature.weak ? ' · weak spot' : ''}${key === recommended ? ' · can fill an empty skill circle' : ''}</span></button>`).join('')}</div>
        <div class="button-row"><button class="secondary ${battle.tutorialNeedsBag ? 'tutorial-bag-cue tutorial-arrow' : ''}" data-bag type="button" ${resolving ? 'disabled' : ''}>Open bag</button>${move && !battle.partnerUsed ? `<button class="secondary" data-partner-skill type="button" ${resolving || battle.tutorialNeedsBag ? 'disabled' : ''}>${escapeHtml(move.label)}</button>` : ''}<button class="secondary" data-run type="button" ${resolving || battle.guided ? 'disabled' : ''}>Try to run</button></div>
      </div>
    </article>`, { dismissible: false, focusSelector: '[data-battle-title]' });
    animateBattleHealth({ ...battle, maxHp: battle.creature.maxHp, displayedHealth: battle.displayedHealth }, game.state.player, battle.enemyHp);
    battle.displayedHealth = [game.state.player.hp / game.state.player.maxHp, battle.enemyHp / battle.creature.maxHp];
    for (const button of document.querySelectorAll('[data-attack]')) button.addEventListener('click', () => questionForBattle(battle, button.dataset.attack, (ok, skill) => {
      const playerResult = playerAttack(battle, game.state.player, skill, { correct: ok, bonusDamage: (bonuses.skillDamage[skill] || 0) + (battle.partnerBoost || 0) + (battle.attackBoost || 0), damageMultiplier: battle.doubleHit ? 2 : 1 });
      if (playerResult.damage > 0) audio?.sfx('hit');
      if (!ok && battle.review) battle.reviewFailed = true;
      battle.partnerBoost = 0;
      battle.doubleHit = false;
      battle = playerResult.battle;
      if (battle.guided && !battle.tutorialSupplyUsed) {
        battle.enemyHp = Math.max(1, battle.enemyHp);
        battle.finished = false;
        battle.tutorialNeedsBag = true;
        game.state.player.hp = Math.max(1, game.state.player.hp - 2);
        commit();
        guidedBattlePrompt(['The creature grazed you, so you lost 2 HP.', 'Open your battle Bag and use the Rice Ball to recover before you attack again.'], () => showBattle(battle));
        return;
      }
      if (battle.finished) {
        showBattle(battle, `Final blow! You dealt ${playerResult.damage} damage.`);
        return setTimeout(() => battleWin(battle, playerResult.damage), 650);
      }
      if (battle.creature.fleeAfter && battle.turn > battle.creature.fleeAfter) return creatureFled(battle);
      const blocksMiss = !ok && battle.ignoreMiss;
      if (blocksMiss) battle.ignoreMiss = false;
      if (Math.random() < 0.4) return enemySpell(battle, ok, bonuses, blocksMiss);
      const enemyResult = enemyAttack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion + (ok ? battle.streak >= 3 ? 0.3 : 0.18 : 0), damageReduction: bonuses.spellDefense + (battle.partnerShield || blocksMiss ? 999 : 0), defenseBoost: battle.defenseBoost, damageMultiplier: ok ? 1 : 1.5 });
      battle.partnerShield = false;
      game.state.player = enemyResult.player;
      if (battle.guided) game.state.player.hp = Math.max(1, game.state.player.hp);
      if (enemyResult.damage > 0) audio?.sfx('playerHit');
      if (game.state.player.hp <= 0) { showBattle({ ...battle, finished: true }, `${battle.creature.name} dealt ${enemyResult.damage} damage.`); return setTimeout(() => faint(battle), 650); }
      commit();
      const attackMessage = ok ? `You dealt ${playerResult.damage} damage. ` : 'Your attack missed. ';
      showBattle(battle, `${attackMessage}${enemyResult.evaded ? 'You dodged the counterattack!' : `${battle.creature.name} dealt ${enemyResult.damage} damage.`}`);
    }), { once: true });
    document.querySelector('[data-run]').addEventListener('click', () => {
      const chance = game.levelPackage.balance.combat.escapeChance ?? 0.65;
      if (escapeSucceeded(Math.random, chance)) {
        battleActive = false;
        commit();
        audio?.setScene('village');
        if (battle.lastDailyBattle) return onBattleQuotaExhausted();
        overlay.close();
        toast('You escaped the battle safely.');
        return;
      }
      const enemyResult = enemyAttack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion, defenseBoost: battle.defenseBoost });
      game.state.player = enemyResult.player;
      if (battle.guided) game.state.player.hp = Math.max(1, game.state.player.hp);
      if (enemyResult.damage > 0) audio?.sfx('playerHit');
      if (game.state.player.hp <= 0) { showBattle({ ...battle, finished: true }, `${battle.creature.name} dealt ${enemyResult.damage} damage.`); return setTimeout(() => faint(battle), 650); }
      commit();
      showBattle(battle, `Escape failed. ${enemyResult.evaded ? 'You dodged the counterattack!' : `${battle.creature.name} dealt ${enemyResult.damage} damage.`}`);
    }, { once: true });
    document.querySelector('[data-bag]').addEventListener('click', () => battleBag(battle), { once: true });
    document.querySelector('[data-partner-skill]')?.addEventListener('click', () => {
      battle.partnerUsed = true;
      if (move.id === 'heal-5') game.state.player.hp = Math.min(game.state.player.maxHp, game.state.player.hp + 5);
      if (move.id === 'heal-3') game.state.player.hp = Math.min(game.state.player.maxHp, game.state.player.hp + 3);
      if (move.id === 'full-heal') game.state.player.hp = game.state.player.maxHp;
      if (move.id === 'shield') battle.partnerShield = true;
      if (move.id === 'damage-1') battle.partnerBoost = 1;
      if (move.id === 'double-hit') battle.doubleHit = true;
      if (move.id === 'ignore-miss') battle.ignoreMiss = true;
      if (move.id === 'direct-damage') battle.enemyHp = Math.max(0, battle.enemyHp - 1);
      if (move.id === 'reveal') battle.revealed = true;
      commit();
      if (battle.enemyHp === 0) return battleWin(battle, 1);
      showBattle(battle, `${lead.w} ${move.message}. ${battle.revealed ? `Weakness: ${SKILLS[battle.creature.weak].name}.` : ''}`);
    }, { once: true });
  }

  function enemySpell(battle, lastCorrect, bonuses, blocksMiss) {
    const game = active();
    const pool = wordsForLesson(battle.word.lesson).filter(word => word.w !== battle.word.w);
    const collected = pool.filter(word => game.state.progress.words[word.w]?.collected);
    const source = collected.length && Math.random() < 0.7 ? collected : pool;
    const word = source[Math.floor(Math.random() * source.length)] || battle.word;
    const spell = creatureSpellName(battle.creature);
    const question = makeBattleQuestion(word, battle.creature.attackSkill, game.levelPackage.content.words, game.levelPackage.content.questions.single);
    showQuestion(overlay, question, word, result => {
      recordWord(word, battle.creature.attackSkill, result.ok, false, false);
      if (result.ok) { commit(); showBattle(battle, `You blocked ${battle.creature.name}’s ${spell}!`); return; }
      const shielded = battle.partnerShield || blocksMiss;
      battle.partnerShield = false;
      const hit = enemyAttack(battle, game.state.player, () => 1, { damageReduction: bonuses.spellDefense + (shielded ? 999 : 0), defenseBoost: battle.defenseBoost, damageMultiplier: lastCorrect ? 1 : 1.5 });
      game.state.player = hit.player;
      if (battle.guided) game.state.player.hp = Math.max(1, game.state.player.hp);
      if (hit.damage > 0) audio?.sfx('playerHit');
      if (game.state.player.hp <= 0) { showBattle({ ...battle, finished: true }, `${spell} dealt ${hit.damage} damage.`); return setTimeout(() => faint(battle), 650); }
      commit();
      showBattle(battle, shielded ? `${spell} struck your shield. No damage!` : `${spell} dealt ${hit.damage} damage.`);
    }, { title: `${battle.creature.name} casts ${spell}! Block it`, headerHtml: battleQuestionBadge('defense'), onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong'), readFeedback: revealed => speech.speak(`${revealed.w}。${revealed.ex}`, { rate: game.state.settings.speechRate }), stopFeedback: speech.stop });
  }

  function creatureFled(battle) {
    commit();
    audio?.setScene('village');
    overlay.open(`<div class="panel result-panel"><h1>The Golden ${escapeHtml(battle.creature.name)} escaped!</h1><p>Golden creatures flee after four turns. Build a streak and use their weakness to defeat them quickly.</p><button class="primary" data-fled-next>${battle.lastDailyBattle ? 'Continue' : 'Return to the village'}</button></div>`);
    document.querySelector('[data-fled-next]').addEventListener('click', () => {
      battleActive = false;
      return battle.lastDailyBattle ? onBattleQuotaExhausted() : overlay.close();
    }, { once: true });
  }

  function battleBag(battle) {
    const game = active();
    if (battle.guided && battle.tutorialNeedsBag && !battle.tutorialBagExplained) {
      battle.tutorialBagExplained = true;
      guidedBattlePrompt(['This is your battle Bag. Find the Rice Ball and tap it to use it.', 'Supplies are used up when you use them, so the Rice Ball will disappear after it restores HP.'], () => battleBag(battle));
      return;
    }
    const owned = game.levelPackage.items.filter(item => !['repellent', 'repel-mastered'].includes(item.effect) && game.state.progress.inventory[item.id] > 0);
    overlay.open(`<div class="panel"><p class="panel-kicker">Battle bag</p><h1>Choose an item</h1><div class="service-grid">${owned.map(item => `<button data-use-item="${item.id}"><b>${escapeHtml(item.name)} × ${game.state.progress.inventory[item.id]}</b><span>${escapeHtml(itemDescription(item))}</span></button>`).join('') || '<p>Your battle bag is empty.</p>'}</div><div class="button-row"><button class="secondary" data-back-battle>Back</button></div></div>`, { dismissible: false });
    document.querySelector('[data-back-battle]').addEventListener('click', () => showBattle(battle));
    for (const button of document.querySelectorAll('[data-use-item]')) button.addEventListener('click', () => {
      const item = game.levelPackage.items.find(candidate => candidate.id === button.dataset.useItem);
      const consumed = useConsumable(game.state.progress.inventory, item.id);
      if (!consumed.ok) return;
      game.state.progress.inventory = consumed.inventory;
      if (item.effect === 'heal' || item.effect === 'full-heal') game.state.player = applyHealing(game.state.player, item);
      if (battle.guided && item.id === 'rice-ball') {
        battle.tutorialSupplyUsed = true;
        battle.tutorialNeedsBag = false;
        battle.enemyHp = 1;
      }
      if (item.effect === 'writing-retry') battle.inkRetry = true;
      if (item.effect === 'attack-boost') battle.attackBoost = Math.max(battle.attackBoost || 0, item.amount || 1);
      if (item.effect === 'defense-boost') battle.defenseBoost = Math.max(battle.defenseBoost || 0, item.amount || 1);
      if (item.effect === 'escape') { battleActive = false; commit(); audio?.setScene('village'); if (battle.lastDailyBattle) return onBattleQuotaExhausted(); overlay.close(); toast('The Smoke Ball carried you safely home.'); return; }
      commit();
      if (battle.guided && item.id === 'rice-ball') guidedBattlePrompt(['Good! The Rice Ball restored your HP. It has been used up.', 'Choose another attack and answer to free the Word Spirit.'], () => showBattle(battle));
      else if (battle.guided && battle.tutorialNeedsBag) guidedBattlePrompt(['That item is useful later. For now, use your Rice Ball to recover HP.'], () => showBattle(battle));
      else showBattle(battle, `${item.name} is ready.`);
    });
  }

  function battleWin(battle, damage) {
    const game = active();
    const beforeLevel = { ...game.state.player };
    const progress = normalizeWordProgress(game.state.progress.words[battle.word.w]);
    const baitTipKey = `bait-tip-lesson-${battle.word.lesson}`;
    const missingWords = wordsForLesson(battle.word.lesson).filter(word => !game.state.progress.words[word.w]?.collected).length;
    const showBaitTip = progress.collected && missingWords > 0 && !game.state.progress.flags[baitTipKey];
    if (showBaitTip) game.state.progress.flags[baitTipKey] = true;
    game.state.progress.words[battle.word.w] = battle.review && !battle.reviewFailed ? completeReview({ ...progress, collected: true }, localDay()) : { ...progress, collected: true };
    const bonuses = progressionBonuses(game);
    const rewards = { ...bonuses, creatureLevel: battle.creature.level };
    const baseRewards = battleRewardAmounts(game.state.player.level, battle.creature.level, game.levelPackage.balance, bonuses);
    const xpAwarded = baseRewards.xp;
    game.state.player = gainBattleRewards(game.state.player, game.levelPackage.balance, rewards);
    const variantCoins = battle.creature.variant === 'elite' ? 6 : battle.creature.variant === 'golden' ? 12 : 0;
    game.state.player.coins += variantCoins;
    const materialByCreature = { fogling: 'mist-drop', 'echo-bat': 'echo-feather', 'twin-shade': 'mirror-shard', 'jumble-bug': 'jumble-silk', 'ink-imp': 'ink-bead', 'chaff-sprite': 'grain-husk', 'rumour-crow': 'rumour-feather', 'price-mimic': 'market-token', 'doubt-moth': 'moth-dust', 'forked-gecko': 'sign-splinter', 'tangle-crab': 'tangle-shell', 'drift-jelly': 'drift-gel', 'rust-gull': 'rust-feather', 'minute-mite': 'clock-spring', 'tide-hare': 'tide-fur', 'mask-moth': 'mask-dust', 'heckle-magpie': 'heckle-feather', 'straw-soldier': 'golden-straw', 'spotlight-fox': 'stage-ribbon', 'wilt-wisp': 'dew-leaf', 'ribbon-rat': 'ribbon-knot', 'drum-gremlin': 'drum-hide', 'spark-kite': 'spark-tassel', 'quarrel-macaque': 'jade-bead', 'boastful-lion': 'lion-bell', 'glyph-beetle': 'glyph-shard', 'bone-owl': 'bone-feather', 'ink-vine': 'ink-leaf', 'relic-tortoise': 'relic-scale', 'whisper-moss': 'memory-moss' };
    const material = materialByCreature[battle.creature.id];
    const pouch = game.state.progress.inventory['material-pouch'] ? 2 : 1;
    if (material) game.state.progress.materials[material] = (game.state.progress.materials[material] || 0) + pouch;
    onProgressEvent('battle-win', { creature: battle.creature.id, word: battle.word.w });
    onCollectionChanged();
    commit();
    onTutorialAction('battle-win', { collected: !progress.collected, word: battle.word.w });
    audio?.sfx(game.state.player.level > beforeLevel.level ? 'level' : 'win');
    audio?.setScene('village');
    const coinsAwarded = baseRewards.coins + variantCoins;
    const victoryTitle = battle.review ? `${escapeHtml(battle.word.w)} completed its review!` : progress.collected ? `${escapeHtml(battle.word.w)} grew stronger!` : `${escapeHtml(battle.word.w)} joined your Spirit Book!`;
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Victory</p><h1>${victoryTitle}</h1><p>You dealt ${damage} damage and earned ${xpAwarded} XP and ${coinsAwarded} coins.${battle.review && !battle.reviewFailed ? ' Its next rest interval is longer.' : ''}</p>${showBaitTip ? `<aside class="battle-bait-tip"><b>Looking for a missing Spirit?</b><p>Visit the town Shop and choose a 10-coin Lesson ${battle.word.lesson} Spirit Bait. It lets you pick the exact missing word for your next battle in this lesson area.</p></aside>` : ''}${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-battle-win-next type="button">${battle.guided ? 'Return to the village' : battle.lastDailyBattle ? 'Continue' : 'Continue exploring'}</button></div>`, { dismissible: false });
    document.querySelector('[data-battle-win-next]').addEventListener('click', () => {
      battleActive = false;
      if (battle.guided) return onReturnToVillage('leave');
      return battle.lastDailyBattle ? onBattleQuotaExhausted() : overlay.close();
    }, { once: true });
  }

  function faint(battle) {
    const game = active();
    game.state.player.hp = game.state.player.maxHp;
    if (game.levelPackage.map.route) onReturnToVillage();
    else {
      game.state.player.x = game.levelPackage.map.spawn.x;
      game.state.player.y = game.levelPackage.map.spawn.y;
    }
    commit();
    audio?.setScene('defeat');
    overlay.open(`<div class="panel result-panel"><h1>You need a rest</h1><p>${escapeHtml(battle.creature.name)} was too strong, so the villagers carried you to the Inn. You lost nothing and your HP was restored.</p><button class="primary" data-close-overlay type="button">Continue</button></div>`, { onClose: () => { battleActive = false; audio?.setScene('village'); if (battle.lastDailyBattle) onBattleQuotaExhausted(); } });
  }

  function startBattle(zoneOrLesson, { scholarsLanternActive = false } = {}) {
    if (battleActive) return false;
    const game = active();
    const zone = typeof zoneOrLesson === 'object' ? zoneOrLesson : null;
    const lesson = zone?.lesson || zoneOrLesson;
    const cap = game.state.settings.dailyBattles;
    const guided = tutorialStep() === 5;
    if (guided && !game.state.progress.inventory['rice-ball']) return toast('Buy a Rice Ball at the Shop before this practice battle.');
    const energy = guided ? { allowed: true, energy: game.state.progress.energy } : useBattle(game.state.progress.energy, localDay(), cap);
    if (!energy.allowed) return onBattleQuotaExhausted();
    const eligibleWords = eligibleBattleWords(wordsForLesson(lesson), game.state.progress.words, scholarsLanternActive);
    const baitIndex = game.state.progress.baits.findIndex(bait => bait.lesson === lesson && eligibleWords.some(candidate => candidate.w === bait.word));
    const bait = baitIndex >= 0 ? game.state.progress.baits[baitIndex] : null;
    const word = bait ? eligibleWords.find(candidate => candidate.w === bait.word) : selectWord(eligibleWords, game.state.progress.words, { day: localDay() });
    if (!word) return toast(game.levelPackage.strings.peaceful);
    battleActive = true;
    if (baitIndex >= 0) game.state.progress.baits.splice(baitIndex, 1);
    const creature = guided ? createCreature(1, game.levelPackage.balance, () => 0.5, 'fogling') : createCreature(lesson, game.levelPackage.balance, Math.random, weightedCreature(zone?.encounter?.types));
    game.state.progress.energy = energy.energy;
    game.state.progress.battles += 1;
    const battle = createBattleState(word, creature);
    battle.guided = guided;
    battle.lastDailyBattle = !guided && cap !== 0 && energy.energy.used >= cap;
    battle.review = isReviewDue(game.state.progress.words[word.w], localDay());
    battle.reviewFailed = false;
    commit();
    audio?.setScene('battle');
    const transition = document.createElement('div');
    transition.className = 'encounter-transition';
    transition.innerHTML = `<div class="encounter-rays"></div><div class="encounter-creature">${creatureSvg(creature.id, '？')}</div><div class="encounter-callout">A creature approaches!</div>`;
    document.querySelector('.stage').appendChild(transition);
    setTimeout(() => {
      transition.classList.add('closing');
      setTimeout(() => {
        transition.remove();
        overlay.open(`<div class="panel battle-intro"><div class="creature-art">${creatureSvg(creature.id, '？')}</div><p class="panel-kicker">${creature.variant === 'elite' ? 'Elite encounter' : creature.variant === 'golden' ? 'Rare golden encounter' : 'Wild encounter'}</p><h1>${escapeHtml(creature.name)} appeared!</h1><p>${battle.review ? 'It woke one of your Gold spirits for a review.' : bait ? 'Your bait worked. It carries the exact spirit you chose.' : 'It has a Word Spirit sealed inside.'}</p><button class="primary" data-fight>Fight!</button></div>`, { dismissible: false });
        document.querySelector('[data-fight]').addEventListener('click', () => {
          if (guided) guidedBattlePrompt(['This Fogling has a Word Spirit trapped inside. Choose an attack to help free it.', 'You can choose an attack even if its Spirit Book circle is empty. A correct answer will fill that skill.'], () => showBattle(battle));
          else showBattle(battle);
        }, { once: true });
      }, 220);
    }, 720);
    return true;
  }

  function tutorialBattle(onDone) {
    const game = active();
    audio?.setScene('battle');
    const tutorialWord = game.levelPackage.config.region1?.tutorialWord;
    const word = game.levelPackage.content.words.find(candidate => candidate.w === tutorialWord) || wordsForLesson(1)[0];
    const creature = createCreature(1, game.levelPackage.balance, () => 0);
    const ask = () => {
      overlay.open(`<article class="battle-scene lesson-1"><div class="battle-arena"><div class="battle-player">${heroPortrait(game.state.progress.equipment?.equipped, 'battle-hero')}<div class="battle-nameplate"><b>You · Lv ${game.state.player.level}</b><div class="enemy-hp player-hp"><i style="width:100%"></i></div><strong>HP ${game.state.player.hp}/${game.state.player.maxHp}</strong></div></div><div class="battle-enemy"><div class="battle-nameplate"><b>${escapeHtml(creature.name)} · Lv ${creature.level}</b><div class="enemy-hp"><i style="width:100%"></i></div><strong>HP 1/1</strong></div><div class="creature-art">${creatureSvg(creature.id, '？')}</div></div></div><div class="battle-console"><p class="panel-kicker">First Spirit Brush battle</p><h2>Free the Word Spirit</h2><p>The Great Forgetter sealed Word Spirits inside wild creatures. Answer to weaken this Fogling; win the battle to free its Spirit into your Book. That is why you explore and fight.</p><button class="primary" data-tutorial-attack>Try Meaning Strike</button></div></article>`, { dismissible: false });
      document.querySelector('[data-tutorial-attack]').addEventListener('click', () => {
        showQuestion(overlay, makeBattleQuestion(word, 'm', game.levelPackage.content.words), word, result => {
          recordWord(word, 'm', result.ok, false, false);
          if (!result.ok) { toast('The Spirit Brush glows. Try that meaning once more.'); ask(); return; }
          const progress = normalizeWordProgress(game.state.progress.words[word.w]);
          game.state.progress.words[word.w] = { ...progress, collected: true };
          game.state.player.coins += 5;
          audio?.sfx('win');
          audio?.setScene('village');
          onCollectionChanged();
          commit();
          overlay.open(`<div class="panel result-panel"><h1>${escapeHtml(word.w)} is free!</h1><p>The Spirit Book has appeared. Every spirit grows through Meaning, Pinyin, Hanzi, Usage and Writing.</p><button class="primary" data-tutorial-done>Continue</button></div>`, { dismissible: false });
          document.querySelector('[data-tutorial-done]').addEventListener('click', () => { overlay.close(); onDone?.(); }, { once: true });
        }, { title: 'Tutorial · Meaning Strike', headerHtml: battleQuestionBadge('attack'), onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong'), readFeedback: revealed => speech.speak(`${revealed.w}。${revealed.ex}`, { rate: game.state.settings.speechRate }), stopFeedback: speech.stop });
      }, { once: true });
    };
    ask();
  }

  function rivalDuel(onDone) {
    const game = active();
    const regionLessons = game.levelPackage.config.regionLessons[game.levelPackage.region.id] || [];
    const words = [...game.levelPackage.content.words.filter(word => regionLessons.includes(word.lesson))].sort(() => Math.random() - 0.5).slice(0, 5);
    let index = 0;
    let score = 0;
    const next = () => {
      if (index >= words.length) { onDone?.(score, words.length); return; }
      const word = words[index++];
      showQuestion(overlay, makeQuestion(word, index % 2 ? 'm' : 'p', game.levelPackage.content.words), word, result => { score += result.ok ? 1 : 0; next(); }, { title: `Ah Dong duel · ${index}/5`, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
    };
    next();
  }

  function runQuiz(title, questions, onComplete) {
    let index = 0;
    let correct = 0;
    const next = () => {
      if (index >= questions.length) return onComplete(correct, questions.length);
      const question = makeExamQuestion(questions[index++]);
      showQuestion(overlay, question, null, result => { correct += result.ok ? 1 : 0; next(); }, { title: `${title} · ${index}/${questions.length}`, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
    };
    next();
  }

  function school() {
    const game = active();
    const schoolState = normalizeSchool(game.state.progress.school, localDay());
    const currentWeek = weekKey();
    overlay.open(`<div class="panel school-panel"><div class="panel-header"><div><p class="panel-kicker">${escapeHtml(game.levelPackage.region.name)} School</p><h1>Choose a learning activity</h1></div><button class="secondary" data-close-overlay>Leave School</button></div><p>School XP always continues. Coin rewards apply to the first ${game.levelPackage.balance.school.paidRunsPerDay} sessions each day.</p><div class="service-grid"><button data-school-quiz><b>Exam quiz</b><span>Questions from this region</span></button><button data-school-writing><b>Tingxie</b><span>Choose a regional lesson and test length</span></button><button data-school-exam ${schoolState.examWeek === currentWeek ? 'disabled' : ''}><b>Exam Day</b><span>${schoolState.examWeek === currentWeek ? 'Completed this week' : 'Weekly regional challenge'}</span></button></div></div>`);
    document.querySelector('[data-school-quiz]').addEventListener('click', () => startSchoolQuiz('School Quiz'));
    document.querySelector('[data-school-writing]').addEventListener('click', () => dictationPicker(false));
    document.querySelector('[data-school-exam]:not([disabled])')?.addEventListener('click', () => startSchoolQuiz('Exam Day', true));
  }

  function startSchoolQuiz(title, examDay = false) {
    const game = active();
    const pool = schoolQuestionPool(game.levelPackage);
    const count = game.levelPackage.balance.school.questionsPerQuiz;
    const questions = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    runQuiz(title, questions, (correct, total) => {
      const run = schoolRun(game.state.progress.school, localDay(), game.levelPackage.balance.school.paidRunsPerDay);
      game.state.progress.school = { ...run.school, examWeek: examDay ? weekKey() : run.school.examWeek };
      const rewards = progressionBonuses(game);
      const xpAwarded = Math.round(correct * game.levelPackage.balance.school.xpPerCorrect * rewards.xpMultiplier);
      const beforeLevel = { ...game.state.player };
      game.state.player = addXp(game.state.player, correct * game.levelPackage.balance.school.xpPerCorrect, rewards);
      if (run.rewarded) game.state.player.coins += correct * game.levelPackage.balance.school.coinsPerCorrect;
      onProgressEvent('school-run', { kind: examDay ? 'exam' : 'quiz', correct });
      commit();
      if (!examDay) onTutorialAction('school-quiz');
      playLevelUp(beforeLevel, game.state.player);
      overlay.open(`<div class="panel result-panel"><h1>${escapeHtml(title)} complete</h1><p>You answered <b>${correct}/${total}</b> correctly and earned ${xpAwarded} XP${run.rewarded ? ` plus ${correct * game.levelPackage.balance.school.coinsPerCorrect} coins` : ''}.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
    });
  }

  function dictationPicker(allLessons = false) {
    const game = active();
    const regional = game.levelPackage.config.regionLessons[game.levelPackage.region.id] || [];
    const lessons = dictationLessons(game.levelPackage.content.words, allLessons ? null : regional);
    const guided = allLessons && tutorialStep() === 14;
    overlay.open(`<div class="panel dictation-picker"><div class="panel-header"><div><p class="panel-kicker">${allLessons ? 'All-lesson practice' : `${escapeHtml(game.levelPackage.region.name)} School`}</p><h1>Choose your dictation</h1></div><button class="secondary" data-close-overlay>Cancel</button></div><p>${allLessons ? 'Practise any lesson in your curriculum. This is a score-only practice session.' : 'Choose a lesson from this region. School rewards are capped at three correct words per run to keep progression balanced.'}</p><label class="answer-field">Lesson<select data-dictation-lesson>${lessons.map(lesson => `<option value="${lesson}">Lesson ${lesson}</option>`).join('')}</select></label><fieldset class="dictation-count"><legend>How many words?</legend>${guided ? '<label><input type="radio" name="dictation-count" value="1" checked> 1 guided word</label>' : '<label><input type="radio" name="dictation-count" value="5" checked> 5</label><label><input type="radio" name="dictation-count" value="10"> 10</label><label><input type="radio" name="dictation-count" value="all"> All</label>'}</fieldset><div class="button-row"><button class="primary" data-dictation-start>Start dictation</button></div></div>`);
    document.querySelector('[data-dictation-start]').addEventListener('click', () => {
      const lesson = Number(document.querySelector('[data-dictation-lesson]').value);
      const count = document.querySelector('[name="dictation-count"]:checked').value;
      const words = guided && count === '1'
        ? chooseGuidedDictationWord(game.levelPackage.content.words, lesson)
        : chooseDictationWords(game.levelPackage.content.words, lesson, count);
      if (words.length) runDictation(words, !allLessons);
    }, { once: true });
  }

  function runDictation(words, schoolMode) {
    const game = active();
    const guidedPractice = tutorialStep() === 14;
    let index = 0;
    let clean = 0;
    let lesson3Clean = 0;
    const next = () => {
      if (index >= words.length) {
        const result = dictationResult(clean, words.length);
        const beforeLevel = { ...game.state.player };
        if (schoolMode) {
          const run = schoolRun(game.state.progress.school, localDay(), game.levelPackage.balance.school.paidRunsPerDay);
          game.state.progress.school = run.school;
          const rewardedWords = Math.min(clean, 3);
          game.state.player = addXp(game.state.player, rewardedWords * game.levelPackage.balance.school.xpPerCorrect, progressionBonuses(game));
          if (run.rewarded) game.state.player.coins += rewardedWords * game.levelPackage.balance.school.coinsPerCorrect;
          onProgressEvent('school-run', { kind: 'tingxie', correct: clean });
          if (lesson3Clean) onProgressEvent('tingxie-lesson3', { count: lesson3Clean });
        }
        commit();
        playLevelUp(beforeLevel, game.state.player);
        const summary = guidedPractice && !clean
          ? 'You tried a word with a demonstration. Try it from memory later to fill its Writing circle.'
          : `You wrote <b>${clean}/${words.length}</b> words without help (${result.percent}%). ${result.message}`;
        return overlay.open(`<div class="panel result-panel"><h1>Dictation complete</h1><p>${summary}</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
      }
      const word = words[index++];
      showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        recordWord(word, 'w', result.ok, !result.earnsTick);
        clean += result.ok ? 1 : 0;
        lesson3Clean += result.ok && word.lesson === 3 ? 1 : 0;
        onTutorialAction('dictation-word');
        next();
      }, { runId: `dictation-${Date.now()}-${index}`, lenient: game.state.settings.lenientWriting, speechRate: game.state.settings.speechRate, forceMemory: true, completeOnHelp: guidedPractice, headerHtml: `<p class="panel-kicker">${schoolMode ? 'School dictation' : 'All-lesson dictation'} · ${index}/${words.length}</p>`, onExit: () => { commit(); overlay.close(); } });
    };
    next();
  }

  function readingHall(preferredGroup = null) {
    const game = active();
    const enabled = enabledQuestionKinds(game.levelPackage.config);
    const groups = game.levelPackage.content.questions.groups.filter(group => enabled.has(group.kind));
    let reading = normalizeReading(game.state.progress.reading);
    const savedGroup = groups.find(candidate => candidate.id === reading.active);
    reading = repairActiveReading(reading, savedGroup, game.levelPackage.regionStory.passageVillagers.length);
    game.state.progress.reading = reading;
    const allowHigherChinese = Boolean(game.state.settings.higherChinese);
    const higherGroups = allowHigherChinese ? groups.filter(candidate => candidate.subject === 'Higher Chinese' && !reading.completed.includes(candidate.id)) : [];
    const activeGroup = groups.find(candidate => candidate.id === reading.active && (allowHigherChinese || candidate.subject !== 'Higher Chinese'));
    const group = activeGroup || (allowHigherChinese || preferredGroup?.subject !== 'Higher Chinese' ? preferredGroup : null) || selectPassage(groups, reading);
    if (!group) {
      overlay.open(`<div class="panel"><h1>Reading Hall</h1><p>You have completed every available standard passage.</p><div class="button-row">${higherGroups.length ? '<button class="primary" data-higher-chinese>Try Higher Chinese</button>' : ''}<button class="secondary" data-close-overlay>Leave</button></div></div>`);
      document.querySelector('[data-higher-chinese]')?.addEventListener('click', () => readingHall(higherGroups[Math.floor(Math.random() * higherGroups.length)]), { once: true });
      return;
    }
    const activePassage = reading.active === group.id;
    const answered = Object.keys(reading.results).length;
    overlay.open(`<article class="panel reading-panel"><div class="panel-header"><div><p class="panel-kicker">Reading Hall · ${escapeHtml(group.category)}${group.subject === 'Higher Chinese' ? ' · Optional Higher Chinese' : ''}</p><h1>${escapeHtml(group.passage.title)}</h1></div><button class="secondary" data-close-overlay>Read later</button></div>${passageScroll(group.passage.text)}<p>${activePassage ? `${answered}/${reading.questionCount} villagers have received an answer. Look for ? bubbles in the village.` : `${Math.min(group.items.length, game.levelPackage.regionStory.passageVillagers.length)} villagers will each ask one short question.`}</p><div class="button-row"><button class="primary" data-reading-start>${activePassage ? 'Return to the village' : 'I’ve read it · Take Passage Scroll'}</button><button class="secondary" data-read-aloud>Read aloud</button>${!activePassage && group.subject !== 'Higher Chinese' && higherGroups.length ? '<button class="secondary" data-higher-chinese>Higher Chinese</button>' : ''}</div></article>`, { onClose: speech.stop });
    document.querySelector('[data-reading-start]').addEventListener('click', () => {
      if (!activePassage) game.state.progress.reading = { ...reading, active: group.id, questionCount: Math.min(group.items.length, game.levelPackage.regionStory.passageVillagers.length), results: {} };
      speech.stop(); commit(); overlay.close(); toast(activePassage ? 'Find the remaining villagers with ? bubbles.' : 'Passage Scroll received. Find the villagers with ? bubbles.');
    }, { once: true });
    document.querySelector('[data-close-overlay]').addEventListener('click', speech.stop, { once: true });
    document.querySelector('[data-higher-chinese]')?.addEventListener('click', () => { speech.stop(); readingHall(higherGroups[Math.floor(Math.random() * higherGroups.length)]); }, { once: true });
    document.querySelector('[data-read-aloud]').addEventListener('click', event => {
      if (speech.isSpeaking) { speech.stop(); event.currentTarget.textContent = 'Read aloud'; return; }
      event.currentTarget.textContent = 'Stop';
      speech.speak(group.passage.text, { rate: game.state.settings.speechRate, onEnd: () => { if (event.currentTarget.isConnected) event.currentTarget.textContent = 'Read aloud'; } });
    });
  }

  function passageQuestion(object, questionIndex) {
    const game = active();
    const reading = normalizeReading(game.state.progress.reading);
    const group = game.levelPackage.content.questions.groups.find(candidate => candidate.id === reading.active);
    const item = group?.items[questionIndex];
    if (!item) return false;
    overlay.open(`<div class="panel"><p class="panel-kicker">Passage question ${questionIndex + 1}/${reading.questionCount}</p><h1>${escapeHtml(object.name || object.interaction?.title || 'Villager')}</h1><p data-type-dialogue>I heard you read ${escapeHtml(group.passage.title)}. May I ask one question?</p><div class="button-row"><button class="primary" data-passage-accept>Answer</button><button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-passage-accept]').addEventListener('click', () => askPassageItem(group, item, questionIndex), { once: true });
    return true;
  }

  function askPassageItem(group, item, questionIndex) {
    const passage = `<details class="passage-scroll"><summary>Open Passage Scroll</summary>${passageScroll(group.passage.text)}</details>`;
    if (item.format === 'MCQ') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><div class="question-options">${item.o.map((option, index) => `<button data-passage-option="${index}">${escapeHtml(option)}</button>`).join('')}</div><button class="secondary" data-passage-giveup>I don’t know</button></article>`, { dismissible: false });
      for (const button of document.querySelectorAll('[data-passage-option]')) button.addEventListener('click', () => resolvePassageAuto(group, item, questionIndex, item.o[Number(button.dataset.passageOption)] === item.c), { once: true });
      document.querySelector('[data-passage-giveup]').addEventListener('click', () => showPassageHelp(group, item, questionIndex), { once: true });
      return;
    }
    if (item.format === 'Fill-in') {
      const choices = passageChoices(group, item);
      if (choices.length) {
        overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><p>Choose from the passage’s options.</p><div class="question-options">${choices.map((option, index) => `<button data-passage-choice="${index}">${escapeHtml(option)}</button>`).join('')}</div><button class="secondary" data-passage-giveup>I don’t know</button></article>`, { dismissible: false });
        for (const button of document.querySelectorAll('[data-passage-choice]')) button.addEventListener('click', () => resolvePassageAuto(group, item, questionIndex, checkPassageAnswer(item, choices[Number(button.dataset.passageChoice)])), { once: true });
        document.querySelector('[data-passage-giveup]').addEventListener('click', () => showPassageHelp(group, item, questionIndex), { once: true });
        return;
      }
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><label class="answer-field">Your answer<input data-passage-input autocomplete="off"></label><div class="button-row"><button class="primary" data-passage-check>Check</button><button class="secondary" data-passage-giveup>I don’t know</button></div></article>`, { dismissible: false });
      document.querySelector('[data-passage-check]').addEventListener('click', () => resolvePassageAuto(group, item, questionIndex, checkPassageAnswer(item, document.querySelector('[data-passage-input]').value)), { once: true });
      document.querySelector('[data-passage-giveup]').addEventListener('click', () => showPassageHelp(group, item, questionIndex), { once: true });
      return;
    }
    overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><label class="answer-field">Write your answer<textarea data-passage-written rows="4"></textarea></label><div class="button-row"><button class="primary" data-passage-model>Show model answer</button><button class="secondary" data-passage-giveup>I don’t know</button></div></article>`, { dismissible: false });
    const compare = answer => {
      if (!answer.trim()) return showPassageHelp(group, item, questionIndex);
      overlay.open(`<article class="panel"><p class="panel-kicker">Self-check</p><h2>Model answer</h2><p>${escapeHtml(item.displayAnswer || item.context || 'Discuss this answer with an adult.')}</p><p>Your answer: ${escapeHtml(answer || '(No answer)')}</p><div class="button-row"><button class="primary" data-passage-rate="right">Got it</button><button class="secondary" data-passage-rate="partly">Partly</button><button class="secondary" data-passage-rate="help">Not yet</button></div></article>`, { dismissible: false });
      for (const button of document.querySelectorAll('[data-passage-rate]')) button.addEventListener('click', () => {
        if (active().state.settings.sendWrittenAnswers) active().state.progress.reading.written.unshift({ day: localDay(), title: group.passage.title, question: item.q, answer, model: item.displayAnswer || item.context || '', rating: button.dataset.passageRate });
        if (button.dataset.passageRate === 'right') finishPassageQuestion(group, questionIndex);
        else showPassageHelp(group, item, questionIndex);
      }, { once: true });
    };
    document.querySelector('[data-passage-model]').addEventListener('click', () => compare(document.querySelector('[data-passage-written]').value), { once: true });
    document.querySelector('[data-passage-giveup]').addEventListener('click', () => showPassageHelp(group, item, questionIndex), { once: true });
  }

  function showPassageHelp(group, item, questionIndex) {
    audio?.sfx('wrong');
    const answer = item.displayAnswer || item.c || item.accepted?.[0] || item.context || '';
    overlay.open(`<div class="panel result-panel"><h2>Let’s learn from this answer</h2><p>This villager’s question stays open until you answer it correctly.</p>${passageReviewMarkup(group, item, answer)}<div class="button-row"><button class="primary" data-passage-retry>Try again</button><button class="secondary" data-close-overlay>Try later</button></div></div>`);
    document.querySelector('[data-passage-retry]').addEventListener('click', () => askPassageItem(group, item, questionIndex), { once: true });
  }

  function resolvePassageAuto(group, item, questionIndex, correct) {
    if (correct) finishPassageQuestion(group, questionIndex);
    else showPassageHelp(group, item, questionIndex);
  }

  function finishPassageQuestion(group, questionIndex) {
    const game = active();
    const reading = normalizeReading(game.state.progress.reading);
    reading.results[questionIndex] = { rating: 'right', correct: true };
    game.state.progress.reading = reading;
    game.state.progress.accuracy = accuracyRecord(game.state.progress.accuracy, 'reading', true);
    const coins = 10;
    game.state.player.coins += coins;
    const beforeLevel = { ...game.state.player };
    game.state.player = addXp(game.state.player, 5, progressionBonuses(game));
    audio?.sfx('correct');
    onProgressEvent('reading-answer', { correct: true });
    const done = Object.keys(reading.results).length >= reading.questionCount;
    if (done) {
      const standard = group.subject !== 'Higher Chinese';
      const readingKey = game.levelPackage.regionStory.readingKeyItem || game.levelPackage.balance.reading.keyItem;
      const readingKeyName = game.levelPackage.regionStory.gateKeyName || 'Cave Lantern';
      const first = standard && !(game.state.progress.inventory.keyItems || []).includes(readingKey);
      if (standard) {
        const completed = completePassage(reading, group.id, readingKey, game.state.progress.inventory);
        game.state.progress.reading = completed.reading;
        game.state.progress.inventory = completed.inventory;
      } else game.state.progress.reading = { ...reading, active: null, index: 0, questionCount: 0, results: {}, completed: [...new Set([...reading.completed, group.id])] };
      if (!first) { game.state.player.coins += 30; game.state.progress.inventory['rice-ball'] = (game.state.progress.inventory['rice-ball'] || 0) + 1; }
      const scrolls = game.state.progress.scrolls.unlocked;
      if (!scrolls.some(entry => entry.id === `reading-${group.id}`)) scrolls.unshift({ id: `reading-${group.id}`, day: localDay(), title: group.passage.title, type: group.subject === 'Higher Chinese' ? 'Higher Chinese Passage' : 'Reading Hall Passage', text: group.passage.text });
      commit();
      const completionCue = first ? 'majorReward' : game.state.player.level > beforeLevel.level ? 'level' : 'win';
      setTimeout(() => audio?.sfx(completionCue), 400);
      return overlay.open(`<div class="panel result-panel ${first ? 'major-reward-panel' : ''}">${first ? passageRewardArt(readingKey, readingKeyName) : '<h1>Passage complete!</h1>'}<p>${first ? `The people of ${escapeHtml(game.levelPackage.region.name)} entrusted this key item to you. It opens the way to ${escapeHtml(game.levelPackage.regionStory.bossPlace || 'Muddle Cave')}.` : 'You received 30 coins and a Rice Ball.'} The passage is now in the Scroll Library.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
    }
    commit();
    playLevelUp(beforeLevel, game.state.player);
    overlay.open(`<div class="panel result-panel"><h2>Correct!</h2><p>You received ${coins} coins. Find the next villager with a ? bubble.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
  }

  function runPassage(group, index, correct) {
    const game = active();
    if (index >= group.items.length) {
      const readingKey = game.levelPackage.regionStory.readingKeyItem || game.levelPackage.balance.reading.keyItem;
      const readingKeyName = game.levelPackage.regionStory.gateKeyName || 'Cave Lantern';
      const completed = completePassage(game.state.progress.reading, group.id, readingKey, game.state.progress.inventory);
      game.state.progress.reading = completed.reading;
      game.state.progress.inventory = completed.inventory;
      game.state.player.coins += game.levelPackage.balance.reading.completionCoins;
      commit();
      audio?.sfx('majorReward');
      return overlay.open(`<div class="panel result-panel major-reward-panel"><p class="panel-kicker">Passage complete · ${correct}/${group.items.length} auto-marked correct</p>${passageRewardArt(readingKey, readingKeyName)}<p>${escapeHtml(game.levelPackage.strings.readingComplete)}</p><button class="primary" data-close-overlay>Continue</button></div>`);
    }
    const item = group.items[index];
    if (item.format === 'MCQ') {
      const question = { prompt: item.q, instruction: 'Answer using the passage.', options: item.o, correct: item.c };
      return showQuestion(overlay, question, null, result => { onProgressEvent('reading-answer', { correct: result.ok }); runPassage(group, index + 1, correct + (result.ok ? 1 : 0)); }, { title: `${group.passage.title} · ${index + 1}/${group.items.length}`, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
    }
    if (item.format === 'Fill-in') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)} · ${index + 1}/${group.items.length}</p><h2>${escapeHtml(item.q)}</h2><label class="answer-field">Your answer<input data-reading-answer autocomplete="off"></label><div class="button-row"><button class="primary" data-reading-check>Check answer</button><button class="secondary" data-reading-giveup>I don't know</button></div></article>`, { dismissible: false });
      const finish = answer => {
        const ok = checkPassageAnswer(item, answer);
        audio?.sfx(ok ? 'correct' : 'wrong');
        onProgressEvent('reading-answer', { correct: ok });
        overlay.open(`<div class="panel result-panel"><h2>${ok ? 'Correct!' : `Answer: ${escapeHtml(item.displayAnswer || item.accepted?.[0] || '')}`}</h2><button class="primary" data-reading-next>Continue</button></div>`, { dismissible: false });
        document.querySelector('[data-reading-next]').addEventListener('click', () => runPassage(group, index + 1, correct + (ok ? 1 : 0)), { once: true });
      };
      document.querySelector('[data-reading-check]').addEventListener('click', () => finish(document.querySelector('[data-reading-answer]').value), { once: true });
      document.querySelector('[data-reading-giveup]').addEventListener('click', () => finish(''), { once: true });
      return;
    }
    overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)} · ${index + 1}/${group.items.length}</p><h2>${escapeHtml(item.q)}</h2><label class="answer-field">Write your answer<textarea data-written-answer rows="4"></textarea></label><div class="button-row"><button class="primary" data-show-model>Compare with model answer</button><button class="secondary" data-no-answer>I don't know</button></div></article>`, { dismissible: false });
    const compare = answer => {
      overlay.open(`<article class="panel"><p class="panel-kicker">Self-check</p><h2>Model answer</h2><p>${escapeHtml(item.displayAnswer || item.context || 'Discuss your answer with an adult.')}</p><p>Your answer: ${escapeHtml(answer || '(No answer)')}</p><p>How close was your answer?</p><div class="button-row"><button class="primary" data-rate="close">Close</button><button class="secondary" data-rate="some">Some ideas matched</button><button class="secondary" data-rate="help">I need help</button></div></article>`, { dismissible: false });
      for (const button of document.querySelectorAll('[data-rate]')) button.addEventListener('click', () => {
        if (game.state.settings.sendWrittenAnswers) game.state.progress.reading.written.unshift({ day: localDay(), title: group.passage.title, question: item.q, answer, model: item.displayAnswer || item.context || '', rating: button.dataset.rate });
        onProgressEvent('reading-answer', { correct: button.dataset.rate === 'close' });
        runPassage(group, index + 1, correct);
      }, { once: true });
    };
    document.querySelector('[data-show-model]').addEventListener('click', () => compare(document.querySelector('[data-written-answer]').value), { once: true });
    document.querySelector('[data-no-answer]').addEventListener('click', () => compare(''), { once: true });
  }

  function inn() {
    const game = active();
    const { regionalWords, review: ranked } = innReviewPool(game.levelPackage, game.state.progress);
    const innName = game.levelPackage.map.objects.find(object => object.id === 'inn-door')?.interaction?.title || 'Inn';
    const rest = () => {
      game.state.player.hp = game.state.player.maxHp;
      commit();
      overlay.open('<div class="panel result-panel"><h1>Fully rested</h1><p>Your HP is full. The word spirits are ready for another adventure.</p><button class="primary" data-close-overlay>Continue</button></div>');
    };
    const review = ranked.length ? Array.from({ length: 3 }, (_, index) => ranked[index % ranked.length]) : [];
    let index = 0;
    const next = () => {
      if (index >= review.length) return rest();
      const word = review[index++];
      showQuestion(overlay, makeQuestion(word, 'm', regionalWords), word, result => { recordWord(word, 'm', result.ok, false, false); next(); }, { title: `Bedtime review · ${index}/${review.length}`, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
    };
    overlay.open(`<div class="panel inn-welcome"><div class="panel-header"><div><p class="panel-kicker">${escapeHtml(innName)}</p><h1>Welcome to the Inn</h1></div><button class="secondary" data-close-overlay>Not now</button></div><p data-type-dialogue>Would you like to rest and restore your HP?</p>${review.length ? '<p>The innkeeper asks three quick Meaning questions from this region before preparing your room.</p>' : '<p>You have no Word Spirits from this region to review yet, so your first rest here is free.</p>'}<div class="button-row"><button class="primary" data-inn-rest>${review.length ? 'Rest · Answer 3 questions' : 'Rest now'}</button></div></div>`);
    document.querySelector('[data-inn-rest]').addEventListener('click', () => review.length ? next() : rest(), { once: true });
  }

  function shop() {
    const game = active();
    const shopItems = game.levelPackage.items;
    const travelSupplies = shopItems.filter(item => item.effect !== 'repel-mastered');
    const lanterns = shopItems.filter(item => item.effect === 'repel-mastered');
    const redCap = game.levelPackage.gear.find(gear => gear.id === 'red-cap');
    const shopName = game.levelPackage.map.objects.find(object => object.id === 'shop-door')?.interaction?.title || 'Shop';
    const itemCard = item => `<article class="shop-item"><img class="item-icon" src="${itemIcon(item.id)}" alt=""><div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(itemDescription(item))}</span><small>${item.price} coins · ${game.state.progress.inventory[item.id] || 0} in bag</small></div><button data-buy="${item.id}" ${game.state.player.coins < item.price ? 'disabled' : ''}>Buy</button></article>`;
    const baitCards = game.levelPackage.map.zones.map(zone => `<article class="shop-item"><img class="item-icon" src="${itemIcon('spirit-bait')}" alt=""><div><b>${escapeHtml(zone.name)} Bait</b><span>Choose the exact Lesson ${zone.lesson} spirit for your next encounter</span><small>${BAIT_PRICE} coins</small></div><button data-bait-lesson="${zone.lesson}" ${game.state.player.coins < BAIT_PRICE ? 'disabled' : ''}>Choose</button></article>`).join('');
    const gearCard = `<article class="shop-item"><img class="item-icon" src="${itemIcon('red-cap')}" alt=""><div><b>${escapeHtml(redCap.name)}</b><span>Add 3 maximum HP when equipped</span><small>${redCap.price} coins</small></div><button data-buy-gear="red-cap" ${game.state.progress.equipment.owned.includes('red-cap') || game.state.player.coins < redCap.price ? 'disabled' : ''}>${game.state.progress.equipment.owned.includes('red-cap') ? 'Owned' : 'Buy'}</button></article>`;
    overlay.open(`<div class="panel shop-panel"><header class="shop-banner"><div><p>${escapeHtml(shopName)}</p><h1 tabindex="-1" data-shop-title>Supplies for the road</h1><span>Choose healing, battle boosts, or a quieter walk through the forest.</span></div><strong>${game.state.player.coins} coins</strong></header><section class="shop-shelf"><h2>Travel supplies</h2><div class="shop-grid">${travelSupplies.map(itemCard).join('')}</div></section><section class="shop-shelf"><h2>Spirit bait and gear</h2><div class="shop-grid">${baitCards}${lanterns.map(itemCard).join('')}${gearCard}</div></section><div class="button-row"><button class="secondary" data-close-overlay>Leave shop</button></div></div>`, { focusSelector: '[data-shop-title]' });
    for (const button of document.querySelectorAll('[data-buy]')) button.addEventListener('click', () => {
      const item = shopItems.find(candidate => candidate.id === button.dataset.buy);
      const completesFirstShopVisit = tutorialStep() === 2 && item.id === 'rice-ball';
      const completesSupplyTutorial = tutorialStep() === 15 && item.id === 'forest-repellent' && game.state.progress.tutorial.baitBought;
      const bought = buyItem(game.state.player, game.state.progress.inventory, item.id, item);
      if (!bought.ok) return toast(bought.reason);
      game.state.player = bought.player;
      game.state.progress.inventory = bought.inventory;
      commit();
      toast(`${item.name} added to your bag.`);
      audio?.sfx('purchase');
      onTutorialAction('buy-item', { id: item.id });
      if (completesFirstShopVisit || completesSupplyTutorial) overlay.close();
      else shop();
    });
    for (const button of document.querySelectorAll('[data-bait-lesson]')) button.addEventListener('click', () => baitPicker(Number(button.dataset.baitLesson)));
    document.querySelector('[data-buy-gear]:not([disabled])')?.addEventListener('click', () => {
      if (game.state.player.coins < redCap.price) return toast('Not enough coins.');
      game.state.player.coins -= redCap.price;
      game.state.progress.equipment.owned.push(redCap.id);
      audio?.sfx('purchase');
      commit(); shop();
    });
  }

  function baitPicker(lesson) {
    const game = active();
    const words = wordsForLesson(lesson).sort((a, b) => Number(Boolean(game.state.progress.words[a.w]?.collected)) - Number(Boolean(game.state.progress.words[b.w]?.collected)));
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Lesson ${lesson} bait</p><h1>Choose a Word Spirit</h1></div><button class="secondary" data-back-shop>Back</button></div><p>The chosen spirit will appear in your next encounter in this lesson's zone. Each bait costs ${BAIT_PRICE} coins.</p><p class="bait-legend"><span class="bait-key missing">Missing spirit</span><span class="bait-key collected">Already collected</span></p><div class="spirit-grid">${words.map(word => { const collected = Boolean(game.state.progress.words[word.w]?.collected); return `<button class="spirit-card bait-word ${collected ? 'collected' : 'missing'}" data-bait-word="${escapeHtml(word.w)}"><b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span><small>${collected ? 'Already collected' : 'Missing spirit'}</small></button>`; }).join('')}</div></div>`);
    document.querySelector('[data-back-shop]').addEventListener('click', shop);
    for (const button of document.querySelectorAll('[data-bait-word]')) button.addEventListener('click', () => {
      if (game.state.player.coins < BAIT_PRICE) return toast('Not enough coins.');
      const completesSupplyTutorial = tutorialStep() === 15 && game.state.progress.tutorial.repellentBought;
      game.state.player.coins -= BAIT_PRICE;
      game.state.progress.baits.push({ lesson, word: button.dataset.baitWord });
      audio?.sfx('purchase');
      commit();
      toast(`Bait prepared for ${button.dataset.baitWord}.`);
      onTutorialAction('buy-bait');
      if (completesSupplyTutorial) overlay.close();
      else shop();
    }, { once: true });
  }

  function spiritBook(selectedLesson = null) {
    const game = active();
    const lessons = game.levelPackage.config.regionLessons[game.levelPackage.region.id] || [];
    const words = game.levelPackage.content.words.filter(word => lessons.includes(word.lesson));
    const lessonNumbers = [...new Set(words.map(word => word.lesson))].sort((a, b) => a - b);
    const firstWord = tutorialStep() === 6 ? words.find(word => word.w === game.state.progress.tutorial.firstWord) || words.find(word => game.state.progress.words[word.w]?.collected) : null;
    const preferredLesson = selectedLesson ?? firstWord?.lesson;
    const lesson = lessonNumbers.includes(Number(preferredLesson)) ? Number(preferredLesson) : lessonNumbers[0];
    const lessonWords = words.filter(word => word.lesson === lesson);
    const counts = { bronze: 0, silver: 0, gold: 0 };
    words.forEach(word => { const tier = tierOf(game.state.progress.words[word.w]); if (tier) counts[tier] += 1; });
    if (tutorialStep() === 7 && !game.state.progress.tutorial.tierExplained) {
      game.state.progress.tutorial.tierExplained = true;
      commit();
      overlay.tutorialDialogue([`Your Spirit Book has ${counts.bronze} Bronze, ${counts.silver} Silver, and ${counts.gold} Gold Spirits in this region.`, 'A Spirit is Bronze when you free it. Fill three different skill circles to make it Silver. Fill all five to make it Gold.'], () => spiritBook(selectedLesson));
      return;
    }
    const guidedTierNote = tutorialStep() === 7 ? `<div class="button-row">${counts.silver + counts.gold ? '<button class="primary" data-tutorial-tier-done>I understand tiers</button>' : '<button class="primary" data-guided-spirit-practice>Practice an empty skill circle</button>'}</div>` : '';
    const guidedCardNote = firstWord ? `<aside class="battle-skill-tip">Tap the glowing ${escapeHtml(firstWord.w)} card to see its skill circles.</aside>` : '';
    const spiritCards = lessonWords.map(word => {
      const progress = normalizeWordProgress(game.state.progress.words[word.w]);
      const tier = tierOf(progress);
      const spotlight = firstWord?.w === word.w;
      const tag = spotlight ? 'button' : 'article';
      return `<${tag} class="spirit-card ${tier || 'unknown'} ${spotlight ? 'tutorial-spirit-card' : ''}" ${spotlight ? `type="button" data-tutorial-word="${escapeHtml(word.w)}"` : ''}><b>${tier ? escapeHtml(word.w) : '？'}</b><span>${tier ? `${escapeHtml(word.p)} · ${escapeHtml(word.m)}` : 'Not collected'}</span><small aria-label="${starsOf(progress)} of 5 skills filled">${Object.keys(SKILLS).map(skill => progress.ticks[skill] >= SKILL_TICKS_REQUIRED ? '●' : '○').join(' ')}</small></${tag}>`;
    }).join('');
    overlay.open(`<div class="panel book-panel"><div class="collection-banner book-banner"><div><p class="panel-kicker">字灵图鉴 · The collection</p><h1>Spirit Book</h1><p>Each skill circle fills after one correct answer without help. Three filled skills make Silver; all five make Gold.</p></div><img src="assets/images/ui/spirit-book.webp" alt="" width="210" height="140"><button class="secondary" data-close-overlay>Close</button></div><div class="book-summary"><b>${counts.bronze} Bronze</b><b>${counts.silver} Silver</b><b>${counts.gold} Gold</b><b>${words.length} regional spirits</b></div>${guidedTierNote}${guidedCardNote}<nav class="lesson-tabs" role="tablist" aria-label="Spirit Book lessons">${lessonNumbers.map(number => `<button type="button" role="tab" aria-selected="${number === lesson}" data-book-lesson="${number}">Lesson ${number}<small>${words.filter(word => word.lesson === number && tierOf(game.state.progress.words[word.w])).length}/${words.filter(word => word.lesson === number).length} collected</small></button>`).join('')}</nav><section class="lesson-spirit-list" role="tabpanel" aria-label="Lesson ${lesson} Spirit cards"><h2>Lesson ${lesson}</h2><div class="spirit-grid">${spiritCards}</div></section></div>`);
    document.querySelector('[data-tutorial-word]')?.addEventListener('click', () => {
      const progress = normalizeWordProgress(game.state.progress.words[firstWord.w]);
      const skills = Object.entries(SKILLS).map(([key, skill]) => `<li><b>${escapeHtml(skill.name)}</b> ${progress.ticks[key] >= SKILL_TICKS_REQUIRED ? '● Filled' : '○ Not filled yet'}</li>`).join('');
      onTutorialAction('open-word-card', { word: firstWord.w });
      overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Spirit Book · skill circles</p><h1>${escapeHtml(firstWord.w)}</h1><p>${escapeHtml(firstWord.p)} · ${escapeHtml(firstWord.m)}</p><ul class="tutorial-skill-list">${skills}</ul><button type="button" class="primary" data-close-overlay>Continue</button></div>`);
    }, { once: true });
    document.querySelector('[data-guided-spirit-practice]')?.addEventListener('click', guidedSpiritPractice);
    document.querySelector('[data-tutorial-tier-done]')?.addEventListener('click', () => { onTutorialAction('tier-acknowledged'); overlay.close(); }, { once: true });
    for (const button of document.querySelectorAll('[data-book-lesson]')) button.addEventListener('click', () => spiritBook(Number(button.dataset.bookLesson)));
  }

  function guidedSpiritPractice() {
    const game = active();
    const word = game.levelPackage.content.words
      .filter(candidate => tierOf(game.state.progress.words[candidate.w]) === 'bronze')
      .sort((a, b) => starsOf(game.state.progress.words[b.w]) - starsOf(game.state.progress.words[a.w]))[0];
    if (!word) return toast('Free a Bronze Spirit on the road first.');
    const progress = normalizeWordProgress(game.state.progress.words[word.w]);
    const skill = ['m', 'p', 'h', 'u'].find(key => !progress.ticks[key]);
    if (!skill) return toast('This Spirit has no short practice left.');
    showQuestion(overlay, makeBattleQuestion(word, skill, game.levelPackage.content.words), word, result => {
      recordWord(word, skill, result.ok, false, false);
      commit();
      onTutorialAction('practice-complete');
      spiritBook(word.lesson);
      if (!result.ok) toast('Try another answer when you are ready.');
    }, { title: `Jun’s ${SKILLS[skill].name} practice`, onAnswer: result => audio?.sfx(result.ok ? 'correct' : 'wrong') });
  }

  function parentPanel() {
    overlay.open(`<div class="panel parent-access-panel"><div class="panel-header"><div><p class="panel-kicker">Parent access</p><h1>Enter parent PIN</h1></div><button class="secondary" data-close-overlay>Cancel</button></div><label class="answer-field">PIN<input data-parent-pin type="password" inputmode="numeric" maxlength="8"></label><p data-pin-error></p><div class="button-row"><button class="primary" data-parent-unlock>Unlock</button></div></div>`);
    document.querySelector('[data-parent-unlock]').addEventListener('click', () => {
      if (!parentPinMatches(storage, document.querySelector('[data-parent-pin]').value)) {
        document.querySelector('[data-pin-error]').textContent = 'That PIN is not correct.';
        return;
      }
      showParentDashboard();
    });
  }

  function showParentChange(message, kind = 'success') {
    const notice = document.querySelector('[data-parent-change]');
    if (!notice) return;
    clearTimeout(parentNoticeTimer);
    notice.textContent = message;
    notice.dataset.kind = kind;
    notice.hidden = false;
    parentNoticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
  }

  function showParentDashboard(selectedTab = 'settings', selectedGiftLesson = null, { keepPosition = false, message = null } = {}) {
    const previousPosition = keepPosition ? document.querySelector('.parent-tab-content')?.scrollTop || 0 : 0;
    const game = active();
    const tab = selectedTab === 'summary' ? 'summary' : 'settings';
    const progressWords = Object.values(game.state.progress.words);
    const written = game.state.progress.reading.written || [];
    const energy = game.state.progress.energy;
    const gold = progressWords.filter(value => tierOf(value) === 'gold').length;
    const silver = progressWords.filter(value => tierOf(value) === 'silver').length;
    const bronze = progressWords.filter(value => tierOf(value) === 'bronze').length;
    const goal = goalProgress(game.state.progress.parent.goal, game.state, gold);
    const accuracy = Object.entries(game.state.progress.accuracy || {});
    const missed = Object.entries(game.state.progress.words).map(([word, value]) => [word, normalizeWordProgress(value).misses]).filter(([, count]) => count).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const helped = Object.entries(game.state.progress.characters).map(([character, value]) => [character, Number(value.helped ?? value.help) || 0]).filter(([, count]) => count).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const due = game.levelPackage.content.words.filter(word => isReviewDue(game.state.progress.words[word.w], localDay())).slice(0, 12);
    const regionId = game.levelPackage.map.region;
    const regionLessons = game.levelPackage.config.regionLessons[regionId] || [];
    const regionWords = game.levelPackage.content.words.filter(word => regionLessons.includes(word.lesson));
    const missingRegionWords = regionWords.filter(word => !normalizeWordProgress(game.state.progress.words[word.w]).collected);
    const giftLessons = [...new Set(missingRegionWords.map(word => word.lesson))].sort((a, b) => a - b);
    const requestedGiftLesson = Number(selectedGiftLesson);
    const giftLesson = giftLessons.includes(requestedGiftLesson) ? requestedGiftLesson : giftLessons[0];
    const giftLessonWords = missingRegionWords.filter(word => word.lesson === giftLesson);
    const gateDictation = gateDictationRules(game.state.settings);
    const giftOpen = document.querySelector('.parent-gift')?.open || false;
    const settingsHtml = `<p class="parent-tab-intro">Manage this player's progress and learning options.</p>
      <section class="parent-section parent-shortcuts-section"><div class="parent-section-heading"><div><h2>Shortcuts</h2><p>Quick changes for this player.</p></div></div>
        <div class="parent-shortcuts">
          <div class="parent-shortcut-card"><label class="answer-field">Jump to region<select data-parent-jump-region>${Object.values(game.levelPackage.campaigns).map(campaign => `<option value="${campaign.region.id}" ${campaign.region.id === game.levelPackage.region.id ? 'selected' : ''}>${escapeHtml(campaign.region.name)}</option>`).join('')}</select></label><button class="secondary" type="button" data-parent-jump>Jump now</button></div>
          <div class="parent-shortcut-card"><label class="answer-field">Hero level<input data-parent-level type="number" inputmode="numeric" min="1" max="99" value="${game.state.player.level}"></label><button class="secondary" type="button" data-parent-level-save>Apply level</button></div>
          <div class="parent-shortcut-card"><label class="answer-field">Give coins<input data-parent-coins type="number" inputmode="numeric" min="1" max="10000" value="100"></label><button class="secondary" type="button" data-parent-coins-give>Give coins</button><small>${game.state.player.coins} coins now</small></div>
        </div><p class="parent-shortcut-note">Applying a level resets XP and restores HP. Jumping keeps the player's collected cards and progress.</p>
        <details class="parent-gift" ${giftOpen ? 'open' : ''}><summary><span><b>Give Spirit Card(s)</b><small>Add missing regional cards at Bronze.</small></span><span class="parent-gift-toggle" aria-hidden="true">▾</span></summary><div class="parent-gift-body">${missingRegionWords.length ? `<div class="parent-gift-toolbar"><label>Lesson<select data-gift-lesson aria-label="Lesson to gift from">${giftLessons.map(lesson => `<option value="${lesson}" ${lesson === giftLesson ? 'selected' : ''}>Lesson ${lesson}</option>`).join('')}</select></label><button class="secondary" type="button" data-gift-select-all>Select all</button></div><div class="parent-gift-grid" role="group" aria-label="Lesson ${giftLesson} Spirit cards">${giftLessonWords.map(word => `<label class="gift-word-option"><input type="checkbox" data-gift-word value="${escapeHtml(word.w)}"><span><b>${escapeHtml(word.w)}</b><small>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</small></span></label>`).join('')}</div><div class="parent-gift-actions"><span data-gift-count>0 selected</span><button class="primary" data-gift-spirit-save disabled>Give selected cards</button></div>` : '<p><b>Every Spirit card in this region has been collected.</b></p>'}</div></details>
      </section>
      <section class="parent-section parent-actions"><div class="parent-section-heading"><div><h2>Parent Tools</h2><p>Family goals, save management, and ways to move between players.</p></div></div><div class="parent-tool-grid"><button class="secondary" data-energy-add>Add 5 battles today</button>${game.state.progress.tutorial?.step < 16 ? '<button class="secondary" data-tutorial-parent-skip>Skip child tutorial</button>' : ''}<button class="secondary" data-switch-player>Switch player</button><button class="secondary" data-switch-level>Switch curriculum</button><a class="secondary parent-walkthrough-link" href="./walkthrough/index.html?level=${encodeURIComponent(game.levelPackage.id)}" target="_blank" rel="noopener">Open walkthrough</a><button class="secondary" data-export-save>Export save</button><label class="secondary save-import-picker">Import save<input data-import-save type="file" accept=".json,application/json" aria-label="Choose a ${escapeHtml(game.levelPackage.label)} save file to import"></label></div><div class="parent-tool-goal"><h3>Real-world goal</h3><p>Connect game progress to a family reward or milestone.</p><div class="goal-editor"><label>Goal name<input data-goal-label value="${escapeHtml(goal?.label || '')}" placeholder="Ice-cream trip"></label><label>Measure<select data-goal-type><option value="gold" ${goal?.type === 'gold' ? 'selected' : ''}>Gold words</option><option value="streak" ${goal?.type === 'streak' ? 'selected' : ''}>Streak days</option><option value="region" ${goal?.type === 'region' ? 'selected' : ''}>Region cleared</option></select></label><label>Target<input data-goal-target type="number" min="1" value="${goal?.target || 20}"></label><button data-goal-save>Save goal</button></div>${goal ? `<div class="parent-goal"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></div>` : ''}</div></section>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Play and Learning</h2><p>Choose how regular play and practice work.</p></div></div><div class="parent-settings">
        <label class="answer-field">Daily creature battles<select data-daily-cap>${[10,15,20,30,0].map(value => `<option value="${value}" ${game.state.settings.dailyBattles === value ? 'selected' : ''}>${value || 'No limit'}</option>`).join('')}</select></label>
        <label class="answer-field">Writing check<select data-writing-check><option value="gentle" ${game.state.settings.lenientWriting ? 'selected' : ''}>Gentle</option><option value="strict" ${!game.state.settings.lenientWriting ? 'selected' : ''}>Strict</option></select></label>
        <label class="answer-field">Speech speed<select data-speech-rate>${[[.7,'Slow'],[.85,'Normal'],[1,'Fast']].map(([value,label]) => `<option value="${value}" ${Number(game.state.settings.speechRate) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="check-setting"><input type="checkbox" data-higher-chinese ${game.state.settings.higherChinese ? 'checked' : ''}> Allow Higher Chinese in the Reading Hall</label>
      </div><div class="parent-gate-settings"><h3>Gate dictation</h3><div><label class="answer-field">Words to test<input data-gate-dictation-count type="number" inputmode="numeric" min="1" max="30" value="${gateDictation.count}"></label><label class="answer-field">Correct words to pass<input data-gate-dictation-pass type="number" inputmode="numeric" min="1" max="${gateDictation.count}" value="${gateDictation.pass}"></label><button class="secondary" type="button" data-gate-dictation-save>Save gate test</button></div></div></section>
      <details class="pin-settings"><summary>Change Parent PIN</summary><div class="pin-editor"><label class="answer-field">New 4–8 digit PIN<input data-new-pin type="password" inputmode="numeric" maxlength="8"></label><button class="primary" data-change-pin>Change PIN</button></div></details>
      <details class="parent-feedback" ${parentFeedbackDraft.open ? 'open' : ''}><summary>Share feedback</summary><div class="parent-feedback-body"><p>Dear parent, hope your child found the app useful!</p><p>I am a parent myself and I created this app primarily as a personal project. It's gone through rounds of testing but may still be buggy. If you found any bugs, or if you have any suggestions, please feel free to submit your feedback using the form below. Thank you!</p><form data-parent-feedback-form action="https://formspree.io/f/mjykzzjo" method="POST"><label class="answer-field">Your feedback<textarea name="message" data-parent-feedback-message rows="4" maxlength="4000" required>${escapeHtml(parentFeedbackDraft.message)}</textarea></label><label class="answer-field">Email for a reply (optional)<input name="email" data-parent-feedback-email type="email" autocomplete="email" value="${escapeHtml(parentFeedbackDraft.email)}"></label><div class="parent-feedback-actions"><button class="primary" type="submit">Send feedback</button><span data-parent-feedback-status role="status" aria-live="polite"></span></div></form></div></details>`;
    const summaryHtml = `<div class="summary-toolbar"><p class="parent-tab-intro">Review learning progress, patterns, and work that may need attention.</p><button class="secondary" data-weekly>View weekly summary</button></div>
      <div class="status-grid parent-status-grid"><div>Curriculum<b>${escapeHtml(game.levelPackage.label)}</b></div><div>Player level<b>${game.state.player.level}</b></div><div>Collected spirits<b>${progressWords.filter(value => value.collected || value.c).length}</b></div><div>Bronze / Silver / Gold<b>${bronze} / ${silver} / ${gold}</b></div><div>Battles today<b>${energy.day === localDay() ? energy.used : 0}/${game.state.settings.dailyBattles || '∞'}</b></div><div>Lantern streak<b>${game.state.progress.streak?.count || 0} days</b></div><div>Time played<b>${Math.round(game.state.session.playMs / 60000)} min</b></div><div>Unlocked regions<b>${game.state.settings.unlockedRegions}</b></div></div>
      ${goal ? `<section class="parent-goal"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></section>` : '<p class="summary-empty">No real-world goal has been set in Settings.</p>'}
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Accuracy by skill</h2><p>Correct answers divided by total attempts.</p></div></div><div class="accuracy-grid">${accuracy.map(([skill, value]) => `<div><b>${escapeHtml(accuracyLabel(skill))}</b><span>${value.correct}/${value.total}</span><i><em style="width:${Math.round(value.correct / Math.max(1, value.total) * 100)}%"></em></i></div>`).join('') || '<p>Answer data will appear after the first activity.</p>'}</div></section>
      <div class="parent-tables"><section><h2>Most-missed words</h2>${missed.map(([word,count]) => `<p><b>${escapeHtml(word)}</b><span>${count}</span></p>`).join('') || '<p>None yet.</p>'}</section><section><h2>Writing help</h2>${helped.map(([character,count]) => `<p><b>${escapeHtml(character)}</b><span>${count}</span></p>`).join('') || '<p>None yet.</p>'}</section><section><h2>Due for review</h2>${due.map(word => `<p><b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.p)}</span></p>`).join('') || '<p>None today.</p>'}</section></div>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Written Reading Hall answers</h2><p>The ten most recent written responses and model answers.</p></div></div>${written.length ? written.slice(0, 10).map(entry => `<article class="written-review"><b>${escapeHtml(entry.day)} · ${escapeHtml(entry.title)} · ${escapeHtml(entry.rating)}</b><p>${escapeHtml(entry.question)}</p><small>Child: ${escapeHtml(entry.answer || '(No answer)')}</small><small>Model: ${escapeHtml(entry.model)}</small></article>`).join('') : '<p>No written answers yet.</p>'}</section>`;
    overlay.open(`<div class="panel parent-panel"><div class="panel-header"><div><p class="panel-kicker">Parent Mode</p><h1>Parent controls</h1></div><button class="secondary" data-close-overlay>Lock</button></div>${game.state.tampered ? '<p class="save-warning">This save failed its integrity check and was recovered. Review the progress before continuing.</p>' : ''}<nav class="parent-tabs" role="tablist" aria-label="Parent Mode sections"><button type="button" role="tab" aria-selected="${tab === 'settings'}" data-parent-tab="settings">Settings<small>Controls and rewards</small></button><button type="button" role="tab" aria-selected="${tab === 'summary'}" data-parent-tab="summary">Learning Summary<small>Progress and review</small></button></nav><section class="parent-tab-content" role="tabpanel" aria-label="${tab === 'settings' ? 'Settings' : 'Learning Summary'}">${tab === 'settings' ? settingsHtml : summaryHtml}</section><div class="parent-change-notice" data-parent-change role="status" aria-live="polite" hidden></div></div>`);
    document.querySelector('.parent-tab-content').scrollTop = previousPosition;
    if (message) showParentChange(message);
    for (const button of document.querySelectorAll('[data-parent-tab]')) button.addEventListener('click', () => showParentDashboard(button.dataset.parentTab));
    if (tab === 'summary') {
      document.querySelector('[data-weekly]').addEventListener('click', showWeeklySummary);
      return;
    }
    document.querySelector('[data-tutorial-parent-skip]')?.addEventListener('click', event => {
      const button = event.currentTarget;
      if (button.dataset.confirm !== 'true') {
        button.dataset.confirm = 'true';
        button.textContent = 'Confirm skip tutorial';
        showParentChange('This permanently ends the child tutorial on this save. No tutorial rewards are granted.', 'error');
        return;
      }
      onSkipTutorial();
      showParentDashboard('settings', null, { keepPosition: true, message: 'Child tutorial skipped for this save.' });
    });
    document.querySelector('[data-daily-cap]').addEventListener('change', event => { game.state.settings.dailyBattles = Number(event.target.value); commit(); showParentChange(`Daily battle limit: ${game.state.settings.dailyBattles || 'no limit'}.`); });
    document.querySelector('[data-gate-dictation-count]').addEventListener('input', event => {
      const passInput = document.querySelector('[data-gate-dictation-pass]');
      const count = Number(event.target.value);
      if (!Number.isInteger(count) || count < 1 || count > 30) return;
      passInput.max = String(count);
      if (Number(passInput.value) > count) passInput.value = String(count);
    });
    document.querySelector('[data-gate-dictation-save]').addEventListener('click', () => {
      const count = Number(document.querySelector('[data-gate-dictation-count]').value);
      const pass = Number(document.querySelector('[data-gate-dictation-pass]').value);
      if (!Number.isInteger(count) || count < 1 || count > 30 || !Number.isInteger(pass) || pass < 1 || pass > count) return showParentChange('Choose 1–30 words and a pass score between 1 and that number.', 'error');
      game.state.settings.gateDictationCount = count;
      game.state.settings.gateDictationPass = pass;
      commit();
      showParentChange(`Gate dictation: ${pass} correct out of ${count} words.`);
    });
    document.querySelector('[data-writing-check]').addEventListener('change', event => { game.state.settings.lenientWriting = event.target.value === 'gentle'; commit(); showParentChange(`Writing check: ${event.target.value}.`); });
    document.querySelector('[data-speech-rate]').addEventListener('change', event => { game.state.settings.speechRate = Number(event.target.value); commit(); showParentChange(`Speech speed: ${event.target.selectedOptions[0].textContent}.`); });
    document.querySelector('[data-higher-chinese]').addEventListener('change', event => { game.state.settings.higherChinese = event.target.checked; if (!event.target.checked) { const reading = normalizeReading(game.state.progress.reading); const activeGroup = game.levelPackage.content.questions.groups.find(group => group.id === reading.active); if (activeGroup?.subject === 'Higher Chinese') game.state.progress.reading = { ...reading, active: null, index: 0, questionCount: 0, results: {} }; } commit(); showParentChange(`Higher Chinese ${event.target.checked ? 'enabled' : 'disabled'} in the Reading Hall.`); });
    document.querySelector('[data-parent-jump]').addEventListener('click', () => {
      const regionId = document.querySelector('[data-parent-jump-region]').value;
      const regionNumber = Number(regionId.slice(1));
      game.state.settings.unlockedRegions = Math.max(Number(game.state.settings.unlockedRegions) || 1, regionNumber);
      commit();
      onSwitchRegion(regionId);
    });
    document.querySelector('[data-parent-level-save]').addEventListener('click', () => {
      const bonuses = progressionBonuses(game);
      game.state.player = setTestingPlayerLevel(game.state.player, document.querySelector('[data-parent-level]').value, bonuses.maxHpBonus);
      commit({ rewardSound: false });
      showParentDashboard('settings', null, { keepPosition: true, message: `Hero set to Level ${game.state.player.level}; XP reset and HP restored.` });
    });
    document.querySelector('[data-parent-coins-give]').addEventListener('click', () => {
      const amount = Number(document.querySelector('[data-parent-coins]').value);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000) return showParentChange('Choose 1–10,000 coins.', 'error');
      game.state.player.coins += amount;
      commit();
      showParentDashboard('settings', null, { keepPosition: true, message: `${amount} coins given. Balance: ${game.state.player.coins}.` });
    });
    document.querySelector('[data-goal-save]').addEventListener('click', () => { const type = document.querySelector('[data-goal-type]').value; game.state.progress.parent.goal = { label: document.querySelector('[data-goal-label]').value.trim() || 'Learning goal', type, target: type === 'region' ? 1 : Math.max(1, Number(document.querySelector('[data-goal-target]').value) || 1), celebrated: false }; commit(); showParentDashboard('settings', null, { keepPosition: true, message: `Goal saved: ${game.state.progress.parent.goal.label}.` }); });
    document.querySelector('[data-gift-lesson]')?.addEventListener('change', event => showParentDashboard('settings', Number(event.target.value), { keepPosition: true }));
    const giftCheckboxes = [...document.querySelectorAll('[data-gift-word]')];
    const updateGiftSelection = () => {
      const count = giftCheckboxes.filter(input => input.checked).length;
      const saveButton = document.querySelector('[data-gift-spirit-save]');
      const selectAllButton = document.querySelector('[data-gift-select-all]');
      document.querySelector('[data-gift-count]').textContent = `${count} selected`;
      saveButton.disabled = count === 0;
      saveButton.textContent = count ? `Give ${count} card${count === 1 ? '' : 's'}` : 'Give selected cards';
      selectAllButton.textContent = count === giftCheckboxes.length ? 'Clear all' : 'Select all';
    };
    for (const input of giftCheckboxes) input.addEventListener('change', updateGiftSelection);
    document.querySelector('[data-gift-select-all]')?.addEventListener('click', () => {
      const shouldSelect = !giftCheckboxes.every(input => input.checked);
      for (const input of giftCheckboxes) input.checked = shouldSelect;
      updateGiftSelection();
    });
    document.querySelector('[data-gift-spirit-save]')?.addEventListener('click', () => {
      const words = giftCheckboxes.filter(input => input.checked).map(input => input.value);
      const gifted = giftSpiritCards(game.state.progress.words, words, regionWords);
      if (!gifted.ok) return showParentChange('Select at least one available Spirit card.', 'error');
      game.state.progress.words = gifted.words;
      onCollectionChanged();
      commit();
      showParentDashboard('settings', giftLesson, { keepPosition: true, message: `${gifted.gifted.length} Spirit card${gifted.gifted.length === 1 ? '' : 's'} added at Bronze.` });
    });
    document.querySelector('[data-energy-add]').addEventListener('click', () => { if (game.state.progress.energy.day !== localDay()) game.state.progress.energy = { day: localDay(), used: 0 }; game.state.progress.energy.used = Math.max(0, game.state.progress.energy.used - 5); commit(); showParentChange('Up to five more battles are available today.'); });
    document.querySelector('[data-switch-level]').addEventListener('click', onSwitchLevel);
    document.querySelector('[data-switch-player]').addEventListener('click', onSwitchPlayer);
    document.querySelector('[data-export-save]').addEventListener('click', () => { downloadSaveFile(game.state, localDay(), exportSaveEnvelope, document, URL, game.playerName); showParentChange(`${game.playerName}’s ${game.levelPackage.label} save exported.`); });
    const fileInput = document.querySelector('[data-import-save]');
    const showImportError = message => {
      overlay.open(`<div class="panel result-panel"><h1>Could not import save</h1><p>${escapeHtml(message)}</p><p>Your current progress has not been changed.</p><button class="primary" data-import-back>Back to Parent Mode</button></div>`);
      document.querySelector('[data-import-back]').addEventListener('click', () => showParentDashboard('settings'), { once: true });
    };
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files?.length) return;
      try {
        const file = fileInput.files[0];
        const envelope = JSON.parse(await readSaveFile(file));
        const imported = importSaveEnvelope(envelope, game.levelPackage);
        const exportedDate = typeof envelope.exportedAt === 'string' ? envelope.exportedAt.slice(0, 10) : '';
        overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Save import</p><h1>Restore this save?</h1><p><b>${escapeHtml(file.name)}</b></p><p>${escapeHtml(game.levelPackage.label)} · Hero Level ${imported.player.level} · ${escapeHtml(imported.player.map)}${exportedDate ? ` · Exported ${escapeHtml(exportedDate)}` : ''}</p><p>This will replace ${escapeHtml(game.playerName)}’s ${escapeHtml(game.levelPackage.label)} progress. The current save will be kept as a backup.</p><div class="button-row"><button class="primary" data-import-confirm>Import and reopen game</button><button class="secondary" data-import-cancel>Cancel</button></div></div>`);
        document.querySelector('[data-import-confirm]').addEventListener('click', () => { try { onImportSave(imported); } catch (error) { showImportError(error.message); } }, { once: true });
        document.querySelector('[data-import-cancel]').addEventListener('click', () => showParentDashboard('settings'), { once: true });
      } catch (error) { showImportError(error instanceof SyntaxError ? 'This file is not valid JSON. Choose a Word Spirit Quest export.' : error.message); }
    });
    document.querySelector('[data-change-pin]').addEventListener('click', () => { if (!setParentPin(storage, document.querySelector('[data-new-pin]').value)) return showParentChange('Use 4–8 digits for the new PIN.', 'error'); document.querySelector('[data-new-pin]').value = ''; showParentChange('Parent PIN changed.'); });
    const feedbackSection = document.querySelector('.parent-feedback');
    const feedbackForm = document.querySelector('[data-parent-feedback-form]');
    const feedbackMessage = feedbackForm.querySelector('[data-parent-feedback-message]');
    const feedbackEmail = feedbackForm.querySelector('[data-parent-feedback-email]');
    const feedbackStatus = feedbackForm.querySelector('[data-parent-feedback-status]');
    const feedbackButton = feedbackForm.querySelector('button[type="submit"]');
    feedbackSection.addEventListener('toggle', () => { parentFeedbackDraft.open = feedbackSection.open; });
    feedbackMessage.addEventListener('input', () => { parentFeedbackDraft.message = feedbackMessage.value; });
    feedbackEmail.addEventListener('input', () => { parentFeedbackDraft.email = feedbackEmail.value; });
    feedbackForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!feedbackForm.reportValidity() || feedbackButton.disabled) return;
      const payload = new feedbackForm.ownerDocument.defaultView.FormData(feedbackForm);
      if (!feedbackEmail.value.trim()) payload.delete('email');
      feedbackButton.disabled = true;
      feedbackButton.textContent = 'Sending…';
      feedbackStatus.textContent = 'Sending your feedback…';
      feedbackStatus.dataset.kind = '';
      try {
        const response = await fetch(feedbackForm.action, { method: 'POST', body: payload, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Feedback request failed: ${response.status}`);
        feedbackForm.reset();
        parentFeedbackDraft.message = '';
        parentFeedbackDraft.email = '';
        feedbackStatus.textContent = 'Thank you. Your feedback was sent.';
        feedbackStatus.dataset.kind = 'success';
      } catch {
        feedbackStatus.textContent = 'Could not send your feedback. Please check your connection and try again.';
        feedbackStatus.dataset.kind = 'error';
      } finally {
        feedbackButton.disabled = false;
        feedbackButton.textContent = 'Send feedback';
      }
    });
  }

  function showWeeklySummary() {
    const rows = weeklySummary(active().state.progress.activity, localDay());
    const totals = rows.reduce((sum, row) => ({ battles: sum.battles + row.battles, school: sum.school + row.school, reading: sum.reading + row.reading, writing: sum.writing + row.writing, minutes: sum.minutes + row.minutes }), { battles: 0, school: 0, reading: 0, writing: 0, minutes: 0 });
    overlay.open(`<div class="panel weekly-panel"><div class="panel-header"><div><p class="panel-kicker">Last seven days</p><h1>Weekly Learning Summary</h1></div><button class="secondary" data-parent-back>Back</button></div><div class="status-grid"><div>Battles won<b>${totals.battles}</b></div><div>School sessions<b>${totals.school}</b></div><div>Reading answers<b>${totals.reading}</b></div><div>Words written<b>${totals.writing}</b></div><div>Play time<b>${totals.minutes} min</b></div></div><div class="weekly-table">${rows.map(row => `<div><b>${escapeHtml(row.day)}</b><span>⚔ ${row.battles}</span><span>🏫 ${row.school}</span><span>📖 ${row.reading}</span><span>✍ ${row.writing}</span><span>⏱ ${row.minutes}m</span></div>`).join('')}</div></div>`);
    document.querySelector('[data-parent-back]').addEventListener('click', () => showParentDashboard('summary'));
  }

  function handleInteraction(object) {
    const reading = normalizeReading(active().state.progress.reading);
    const passageIndex = active().levelPackage.regionStory.passageVillagers.indexOf(object.id);
    if (reading.active && passageIndex >= 0 && passageIndex < reading.questionCount && reading.results[passageIndex]?.correct !== true) return passageQuestion(object, passageIndex);
    const handlers = {
      'school-door': school,
      'inn-door': inn,
      'hall-door': readingHall,
      'shop-door': () => { audio?.sfx('enterShop'); shop(); }
    };
    if (handlers[object.id]) { handlers[object.id](); return true; }
    return false;
  }

  return { handleInteraction, startBattle, tutorialBattle, rivalDuel, school, dictationPractice: () => dictationPicker(true), guidedSpiritPractice, readingHall, inn, shop, spiritBook, parentPanel, battlesLeft: () => battlesLeft(active().state.progress.energy, localDay(), active().state.settings.dailyBattles), battleInProgress: () => battleActive };
}
