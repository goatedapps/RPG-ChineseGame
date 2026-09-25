import { battleRewardAmounts, createBattleState, enemyAttack, escapeSucceeded, gainBattleRewards, playerAttack } from './battle/battle.js?p10f';
import { createCreature } from './battle/creatures.js';
import { heroStats } from './battle/damage.js';
import { creatureSvg } from './battle/creatureArt.js?p10m';
import { buyItem } from './systems/economy.js';
import { applyHealing, useConsumable } from './systems/inventory.js';
import { gearBonuses } from './systems/gear.js';
import { partnerBonuses, partnerMove } from './systems/partners.js?p10f';
import { battlesLeft, useBattle } from './systems/energy.js';
import { ensureParentPin, giftSpiritCards, goalProgress, parentPinMatches, setParentPin, setTestingPlayerLevel, weeklySummary } from './systems/parent.js?p15';
import { weightedCreature } from './world/encounters.js?p10d';
import { exportSaveEnvelope, importSaveEnvelope } from './core/save.js?p10d';
import { checkPassageAnswer, completePassage, normalizeReading, repairActiveReading, selectPassage } from './systems/reading.js?p10f';
import { normalizeSchool, schoolRun, weekKey } from './systems/school.js';
import { filterSupportedQuestions, enabledQuestionKinds } from './learning/examAdapters.js';
import { makeExamQuestion, makeQuestion } from './learning/questions.js';
import { completeReview, isReviewDue, normalizeWordProgress, recordAnswer, SKILLS, SKILL_TICKS_REQUIRED, starsOf, tierOf } from './learning/mastery.js?p10f';
import { recommendedSkill, selectWord } from './learning/selection.js?p10f';
import { localDay } from './core/time.js';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js?p10m';
import { showWritingTask } from './ui/writingView.js?p12b';
import { createSpeechController } from './learning/audio.js';
import { heroPortrait } from './ui/heroPortrait.js?p10n';

const SHOP_ITEM_COPY = Object.freeze({
  heal: item => `Restore ${item.amount} HP during battle`,
  'full-heal': () => 'Restore all HP during battle',
  'remove-option': () => 'Remove one wrong answer choice',
  'writing-retry': () => 'Retry one writing challenge safely',
  escape: () => 'Guarantee a safe escape from battle',
  'double-coins': () => 'Double the coins from one battle',
  'attack-boost': item => `Add ${item.amount} attack damage for one battle`,
  'defense-boost': item => `Reduce incoming damage by ${item.amount} for one battle`,
  repellent: item => `Prevent forest encounters for ${item.amount} forest steps`
});

const itemDescription = item => (SHOP_ITEM_COPY[item.effect]?.(item) || item.effect);
const itemIcon = id => `../assets/images/shop/${id}.png`;
const rewardArt = (id, name) => `<div class="major-reward"><img src="../assets/images/rewards/${id}.png" alt="${escapeHtml(name)}"><div><p class="panel-kicker">Major reward</p><h1>${escapeHtml(name)} received!</h1></div></div>`;
const passageRewardArt = (id, name) => id === 'cave-lantern' ? rewardArt('cave-lantern', 'Cave Lantern') : rewardArt(id, name);

function addXp(player, amount, { xpMultiplier = 1, maxHpBonus = 0 } = {}) {
  let level = player.level;
  let xp = player.xp + Math.round(amount * xpMultiplier);
  let maxHp = player.maxHp;
  while (xp >= level * 30) {
    xp -= level * 30;
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

export function innReviewPool(levelPackage, progress) {
  const lessons = new Set(levelPackage.config.regionLessons[levelPackage.region.id] || []);
  const regionalWords = levelPackage.content.words.filter(word => lessons.has(word.lesson));
  const review = regionalWords
    .filter(word => progress.words[word.w]?.collected || progress.words[word.w]?.c)
    .sort((a, b) => starsOf(progress.words[a.w]) - starsOf(progress.words[b.w]));
  return { regionalWords, review };
}

export function createGameplay({ overlay, storage, getActive, persist, render, toast, audio, onSwitchLevel = () => {}, onSwitchRegion = () => {}, onCollectionChanged = () => {}, onProgressEvent = () => {} }) {
  ensureParentPin(storage);
  const active = () => getActive();
  const speech = createSpeechController();
  const wordsForLesson = lesson => active().levelPackage.content.words.filter(word => word.lesson === lesson);
  const commit = () => { persist(); render(); };
  const playLevelUp = (before, after) => { if (after.level > before.level) audio?.sfx('level'); };

  function progressionBonuses(game) {
    const gear = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const wordsById = Object.fromEntries(game.levelPackage.content.words.map(word => [word.id, word]));
    const partners = partnerBonuses(game.state.progress.partners, wordsById, game.state.progress.words);
    return { xpMultiplier: 1 + gear.xp, maxHpBonus: gear.maxHp + partners.maxHp };
  }

  function recordWord(word, skill, ok, assisted = false) {
    const game = active();
    const recorded = recordAnswer(game.state.progress.words[word.w], { skill, correct: ok, day: localDay(), assisted });
    game.state.progress.words[word.w] = recorded.progress;
    game.state.progress.accuracy = accuracyRecord(game.state.progress.accuracy, skill, ok);
    audio?.sfx(ok ? 'correct' : 'wrong');
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
      }, { runId: `battle-${game.state.progress.battles}-${battle.turn}`, lenient: game.state.settings.lenientWriting });
      return;
    }
    const question = makeQuestion(battle.word, skill, game.levelPackage.content.words);
    if (skill === 'h') question.prompt = battle.word.m;
    const assisted = Boolean(battle.lantern);
    if (battle.lantern && question.options.length > 2) {
      const wrong = question.options.find(option => option !== question.correct);
      question.options = question.options.filter(option => option !== wrong);
      battle.lantern = false;
    }
    showQuestion(overlay, question, null, result => {
      recordWord(battle.word, skill, result.ok, assisted);
      done(result.ok, skill);
    }, { title: SKILLS[skill].action, revealWord: battle.word });
  }

  function showBattle(battle, message = '') {
    const game = active();
    const bonuses = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const hero = heroStats(game.state.player.level);
    const lead = game.levelPackage.content.words.find(word => word.id === game.state.progress.partners[0]);
    const move = partnerMove(lead, lead && game.state.progress.words[lead.w], game.levelPackage.wordTags);
    overlay.open(`<article class="battle-scene lesson-${battle.word.lesson}">
      <div class="battle-arena">
        <div class="battle-player">${heroPortrait(game.state.progress.equipment?.equipped, 'battle-hero')}<div class="battle-nameplate"><b>You · Lv ${game.state.player.level}</b><small>ATK ${hero.attack} · DEF ${hero.defense} · EVA ${Math.round(hero.evasion * 100)}%</small><div class="enemy-hp player-hp"><i style="width:${game.state.player.hp / game.state.player.maxHp * 100}%"></i></div><strong>HP ${game.state.player.hp}/${game.state.player.maxHp}</strong></div></div>
        <div class="battle-enemy ${battle.creature.variant}" style="--creature:${battle.creature.color}"><div class="battle-nameplate"><b>${battle.creature.variant === 'golden' ? 'Golden ' : battle.creature.variant === 'elite' ? 'Elite ' : ''}${escapeHtml(battle.creature.name)} · Lv ${battle.creature.level}</b><small>ATK ${battle.creature.attack} · DEF ${battle.creature.defense} · Weak to ${escapeHtml(SKILLS[battle.creature.weak].name)}</small><div class="enemy-hp"><i style="width:${battle.enemyHp / battle.creature.maxHp * 100}%"></i></div><strong>HP ${battle.enemyHp}/${battle.creature.maxHp}</strong></div><div class="creature-art">${creatureSvg(battle.creature.id, '？')}</div></div>
      </div>
      <div class="battle-console"><p class="panel-kicker">${battle.review ? 'Gold spirit review' : `${battle.creature.variant === 'elite' ? 'Elite' : battle.creature.variant === 'golden' ? 'Golden' : 'Wild'} word spirit`} · Lesson ${battle.word.lesson}</p><h2>Your turn${battle.streak >= 2 ? ` · ${battle.streak} correct in a row!` : ''}</h2>${message ? `<p class="battle-message">${escapeHtml(message)}</p>` : '<p class="battle-message">The spirit’s identity stays sealed until you win. Choose an attack.</p>'}
        <div class="attack-grid">${Object.entries(SKILLS).map(([key, skill]) => `<button type="button" data-attack="${key}" class="${key === battle.creature.weak ? 'weak-to' : ''} ${key === battle.recommended ? 'recommended' : ''}"><b>${escapeHtml(skill.action)}</b><span>${escapeHtml(skill.name)}${key === battle.creature.weak ? ' · weak spot' : ''}${key === battle.recommended ? ' · useful now' : ''}</span></button>`).join('')}</div>
        <div class="button-row"><button class="secondary" data-bag type="button">Open bag</button>${move && !battle.partnerUsed ? `<button class="secondary" data-partner-skill type="button">${escapeHtml(move.label)}</button>` : ''}<button class="secondary" data-run type="button">Try to run</button></div>
      </div>
    </article>`, { dismissible: false });
    for (const button of document.querySelectorAll('[data-attack]')) button.addEventListener('click', () => questionForBattle(battle, button.dataset.attack, (ok, skill) => {
      const playerResult = playerAttack(battle, game.state.player, skill, { correct: ok, bonusDamage: (bonuses.skillDamage[skill] || 0) + (battle.partnerBoost || 0) + (battle.attackBoost || 0), damageMultiplier: battle.doubleHit ? 2 : 1 });
      if (playerResult.damage > 0) audio?.sfx('hit');
      if (!ok && battle.review) battle.reviewFailed = true;
      battle.partnerBoost = 0;
      battle.doubleHit = false;
      battle = playerResult.battle;
      if (battle.finished) return battleWin(battle, playerResult.damage);
      if (battle.creature.fleeAfter && battle.turn > battle.creature.fleeAfter) return creatureFled(battle);
      const blocksMiss = !ok && battle.ignoreMiss;
      if (blocksMiss) battle.ignoreMiss = false;
      if (Math.random() < 0.4) return enemySpell(battle, ok, bonuses, blocksMiss);
      const enemyResult = enemyAttack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion + (ok ? battle.streak >= 3 ? 0.3 : 0.18 : 0), damageReduction: bonuses.spellDefense + (battle.defenseBoost || 0) + (battle.partnerShield || blocksMiss ? 999 : 0), damageMultiplier: ok ? 1 : 1.5 });
      battle.partnerShield = false;
      game.state.player = enemyResult.player;
      if (game.state.player.hp <= 0) return faint(battle);
      commit();
      const attackMessage = ok ? `You dealt ${playerResult.damage} damage. ` : 'Your attack missed. ';
      showBattle(battle, `${attackMessage}${enemyResult.evaded ? 'You dodged the counterattack!' : `${battle.creature.name} dealt ${enemyResult.damage} damage.`}`);
    }), { once: true });
    document.querySelector('[data-run]').addEventListener('click', () => {
      const chance = game.levelPackage.balance.combat.escapeChance ?? 0.65;
      if (escapeSucceeded(Math.random, chance)) {
        overlay.close();
        commit();
        audio?.setScene('village');
        toast('You escaped and returned to the village.');
        return;
      }
      const enemyResult = enemyAttack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion, damageReduction: battle.defenseBoost || 0 });
      game.state.player = enemyResult.player;
      if (game.state.player.hp <= 0) return faint(battle);
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
    const spellNames = { fogling: 'Fog Cloud', 'echo-bat': 'Screech', 'twin-shade': 'Mirror Trick', 'jumble-bug': 'Word Scramble', 'ink-imp': 'Ink Splash' };
    const spell = spellNames[battle.creature.id];
    const question = makeQuestion(word, battle.creature.attackSkill, game.levelPackage.content.words);
    showQuestion(overlay, question, word, result => {
      recordWord(word, battle.creature.attackSkill, result.ok);
      if (result.ok) { commit(); showBattle(battle, `You blocked ${battle.creature.name}’s ${spell}!`); return; }
      const shielded = battle.partnerShield || blocksMiss;
      battle.partnerShield = false;
      const hit = enemyAttack(battle, game.state.player, () => 1, { damageReduction: bonuses.spellDefense + (battle.defenseBoost || 0) + (shielded ? 999 : 0), damageMultiplier: lastCorrect ? 1 : 1.5 });
      game.state.player = hit.player;
      if (game.state.player.hp <= 0) return faint(battle);
      commit();
      showBattle(battle, shielded ? `${spell} struck your shield. No damage!` : `${spell} dealt ${hit.damage} damage.`);
    }, { title: `${battle.creature.name} casts ${spell}! Block it` });
  }

  function creatureFled(battle) {
    commit();
    audio?.setScene('village');
    overlay.open(`<div class="panel result-panel"><h1>The Golden ${escapeHtml(battle.creature.name)} escaped!</h1><p>Golden creatures flee after four turns. Build a streak and use their weakness to defeat them quickly.</p><button class="primary" data-close-overlay>Return to the village</button></div>`);
  }

  function battleBag(battle) {
    const game = active();
    const owned = game.levelPackage.items.filter(item => item.effect !== 'repellent' && game.state.progress.inventory[item.id] > 0);
    overlay.open(`<div class="panel"><p class="panel-kicker">Battle bag</p><h1>Choose an item</h1><div class="service-grid">${owned.map(item => `<button data-use-item="${item.id}"><b>${escapeHtml(item.name)} × ${game.state.progress.inventory[item.id]}</b><span>${escapeHtml(itemDescription(item))}</span></button>`).join('') || '<p>Your battle bag is empty.</p>'}</div><div class="button-row"><button class="secondary" data-back-battle>Back</button></div></div>`, { dismissible: false });
    document.querySelector('[data-back-battle]').addEventListener('click', () => showBattle(battle));
    for (const button of document.querySelectorAll('[data-use-item]')) button.addEventListener('click', () => {
      const item = game.levelPackage.items.find(candidate => candidate.id === button.dataset.useItem);
      const consumed = useConsumable(game.state.progress.inventory, item.id);
      if (!consumed.ok) return;
      game.state.progress.inventory = consumed.inventory;
      if (item.effect === 'heal' || item.effect === 'full-heal') game.state.player = applyHealing(game.state.player, item);
      if (item.effect === 'remove-option') battle.lantern = true;
      if (item.effect === 'writing-retry') battle.inkRetry = true;
      if (item.effect === 'double-coins') battle.doubleCoins = true;
      if (item.effect === 'attack-boost') battle.attackBoost = Math.max(battle.attackBoost || 0, item.amount || 1);
      if (item.effect === 'defense-boost') battle.defenseBoost = Math.max(battle.defenseBoost || 0, item.amount || 1);
      if (item.effect === 'escape') { commit(); overlay.close(); audio?.setScene('village'); toast('The Smoke Ball carried you safely home.'); return; }
      commit();
      showBattle(battle, `${item.name} is ready.`);
    });
  }

  function battleWin(battle, damage) {
    const game = active();
    const beforeLevel = { ...game.state.player };
    const progress = normalizeWordProgress(game.state.progress.words[battle.word.w]);
    game.state.progress.words[battle.word.w] = battle.review && !battle.reviewFailed ? completeReview({ ...progress, collected: true }, localDay()) : { ...progress, collected: true };
    const bonuses = progressionBonuses(game);
    const rewards = { ...bonuses, creatureLevel: battle.creature.level };
    const baseRewards = battleRewardAmounts(game.state.player.level, battle.creature.level, game.levelPackage.balance, bonuses);
    const xpAwarded = baseRewards.xp;
    game.state.player = gainBattleRewards(game.state.player, game.levelPackage.balance, rewards);
    const variantCoins = battle.creature.variant === 'elite' ? 6 : battle.creature.variant === 'golden' ? 12 : 0;
    game.state.player.coins += variantCoins;
    if (battle.doubleCoins) game.state.player.coins += baseRewards.coins;
    const materialByCreature = { fogling: 'mist-drop', 'echo-bat': 'echo-feather', 'twin-shade': 'mirror-shard', 'jumble-bug': 'jumble-silk', 'ink-imp': 'ink-bead', 'chaff-sprite': 'grain-husk', 'rumour-crow': 'rumour-feather', 'price-mimic': 'market-token', 'doubt-moth': 'moth-dust', 'forked-gecko': 'sign-splinter', 'tangle-crab': 'tangle-shell', 'drift-jelly': 'drift-gel', 'rust-gull': 'rust-feather', 'minute-mite': 'clock-spring', 'tide-hare': 'tide-fur', 'mask-moth': 'mask-dust', 'heckle-magpie': 'heckle-feather', 'straw-soldier': 'golden-straw', 'spotlight-fox': 'stage-ribbon', 'wilt-wisp': 'dew-leaf', 'ribbon-rat': 'ribbon-knot', 'drum-gremlin': 'drum-hide', 'spark-kite': 'spark-tassel', 'quarrel-macaque': 'jade-bead', 'boastful-lion': 'lion-bell', 'glyph-beetle': 'glyph-shard', 'bone-owl': 'bone-feather', 'ink-vine': 'ink-leaf', 'relic-tortoise': 'relic-scale', 'whisper-moss': 'memory-moss' };
    const material = materialByCreature[battle.creature.id];
    const pouch = game.state.progress.inventory['material-pouch'] ? 2 : 1;
    game.state.progress.materials[material] = (game.state.progress.materials[material] || 0) + pouch;
    onProgressEvent('battle-win', { creature: battle.creature.id, word: battle.word.w });
    onCollectionChanged();
    commit();
    audio?.sfx(game.state.player.level > beforeLevel.level ? 'level' : 'win');
    audio?.setScene('village');
    const coinsAwarded = baseRewards.coins * (battle.doubleCoins ? 2 : 1) + variantCoins;
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Victory</p><h1>${battle.review ? `${escapeHtml(battle.word.w)} completed its review!` : `${escapeHtml(battle.word.w)} joined your Spirit Book!`}</h1><p>You dealt ${damage} damage and earned ${xpAwarded} XP and ${coinsAwarded} coins.${battle.review && !battle.reviewFailed ? ' Its next rest interval is longer.' : ''}</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay type="button">Return to village</button></div>`);
  }

  function faint(battle) {
    const game = active();
    game.state.player.hp = game.state.player.maxHp;
    game.state.player.x = game.levelPackage.map.spawn.x;
    game.state.player.y = game.levelPackage.map.spawn.y;
    commit();
    audio?.setScene('village');
    overlay.open(`<div class="panel result-panel"><h1>You need a rest</h1><p>${escapeHtml(battle.creature.name)} was too strong, so the villagers carried you home. You lost nothing and your HP was restored.</p><button class="primary" data-close-overlay type="button">Continue</button></div>`);
  }

  function startBattle(zoneOrLesson) {
    const game = active();
    const zone = typeof zoneOrLesson === 'object' ? zoneOrLesson : null;
    const lesson = zone?.lesson || zoneOrLesson;
    const cap = game.state.settings.dailyBattles;
    const energy = useBattle(game.state.progress.energy, localDay(), cap);
    if (!energy.allowed) return toast(game.levelPackage.strings.battleCap);
    const baitIndex = game.state.progress.baits.findIndex(bait => bait.lesson === lesson);
    const bait = baitIndex >= 0 ? game.state.progress.baits.splice(baitIndex, 1)[0] : null;
    const word = bait ? wordsForLesson(lesson).find(candidate => candidate.w === bait.word) : selectWord(wordsForLesson(lesson), game.state.progress.words, { day: localDay() });
    if (!word) return toast(game.levelPackage.strings.peaceful);
    const creature = createCreature(lesson, game.levelPackage.balance, Math.random, weightedCreature(zone?.encounter?.types));
    game.state.progress.energy = energy.energy;
    game.state.progress.battles += 1;
    const battle = createBattleState(word, creature);
    battle.review = isReviewDue(game.state.progress.words[word.w], localDay());
    battle.reviewFailed = false;
    battle.recommended = recommendedSkill(game.state.progress.words[word.w], localDay());
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
        document.querySelector('[data-fight]').addEventListener('click', () => showBattle(battle), { once: true });
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
      overlay.open(`<article class="battle-scene lesson-1"><div class="battle-arena"><div class="battle-player">${heroPortrait(game.state.progress.equipment?.equipped, 'battle-hero')}<div class="battle-nameplate"><b>You · Lv ${game.state.player.level}</b><div class="enemy-hp player-hp"><i style="width:100%"></i></div><strong>HP ${game.state.player.hp}/${game.state.player.maxHp}</strong></div></div><div class="battle-enemy"><div class="battle-nameplate"><b>${escapeHtml(creature.name)} · Lv ${creature.level}</b><div class="enemy-hp"><i style="width:100%"></i></div><strong>HP 1/1</strong></div><div class="creature-art">${creatureSvg(creature.id, '？')}</div></div></div><div class="battle-console"><p class="panel-kicker">First Spirit Brush battle</p><h2>Use Meaning Strike</h2><p>The Word Spirit stays sealed until you defeat the creature.</p><button class="primary" data-tutorial-attack>Meaning Strike</button></div></article>`, { dismissible: false });
      document.querySelector('[data-tutorial-attack]').addEventListener('click', () => {
        showQuestion(overlay, makeQuestion(word, 'm', game.levelPackage.content.words), word, result => {
          recordWord(word, 'm', result.ok);
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
        }, { title: 'Tutorial · Meaning Strike' });
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
      showQuestion(overlay, makeQuestion(word, index % 2 ? 'm' : 'p', game.levelPackage.content.words), word, result => { score += result.ok ? 1 : 0; next(); }, { title: `Ah Dong duel · ${index}/5` });
    };
    next();
  }

  function runQuiz(title, questions, onComplete) {
    let index = 0;
    let correct = 0;
    const next = () => {
      if (index >= questions.length) return onComplete(correct, questions.length);
      const question = makeExamQuestion(questions[index++]);
      showQuestion(overlay, question, null, result => { correct += result.ok ? 1 : 0; next(); }, { title: `${title} · ${index}/${questions.length}` });
    };
    next();
  }

  function school() {
    const game = active();
    const schoolState = normalizeSchool(game.state.progress.school, localDay());
    const currentWeek = weekKey();
    overlay.open(`<div class="panel"><p class="panel-kicker">Scholar Village School</p><h1>Choose a learning activity</h1><p>School XP always continues. Coin rewards apply to the first ${game.levelPackage.balance.school.paidRunsPerDay} sessions each day.</p><div class="service-grid"><button data-school-quiz><b>Exam quiz</b><span>Five real curriculum questions</span></button><button data-school-writing><b>Tingxie</b><span>Write three words from memory</span></button><button data-school-exam ${schoolState.examWeek === currentWeek ? 'disabled' : ''}><b>Exam Day</b><span>${schoolState.examWeek === currentWeek ? 'Completed this week' : 'Weekly mixed challenge'}</span></button></div><div class="button-row"><button class="secondary" data-close-overlay>Leave School</button></div></div>`);
    document.querySelector('[data-school-quiz]').addEventListener('click', () => startSchoolQuiz('School Quiz'));
    document.querySelector('[data-school-writing]').addEventListener('click', schoolDictation);
    document.querySelector('[data-school-exam]:not([disabled])')?.addEventListener('click', () => startSchoolQuiz('Exam Day', true));
  }

  function startSchoolQuiz(title, examDay = false) {
    const game = active();
    const pool = filterSupportedQuestions(game.levelPackage.content, game.levelPackage.config);
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
      playLevelUp(beforeLevel, game.state.player);
      overlay.open(`<div class="panel result-panel"><h1>${escapeHtml(title)} complete</h1><p>You answered <b>${correct}/${total}</b> correctly and earned ${xpAwarded} XP${run.rewarded ? ` plus ${correct * game.levelPackage.balance.school.coinsPerCorrect} coins` : ''}.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
    });
  }

  function schoolDictation() {
    const game = active();
    const chefNeedsLesson3 = game.state.progress.story?.requests?.['chef-mei'] === 2;
    const pool = chefNeedsLesson3 ? game.levelPackage.content.words.filter(word => word.lesson === 3) : game.levelPackage.content.words;
    const words = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    let index = 0;
    let clean = 0;
    let lesson3Clean = 0;
    const next = () => {
      if (index >= words.length) {
        const run = schoolRun(game.state.progress.school, localDay(), game.levelPackage.balance.school.paidRunsPerDay);
        game.state.progress.school = run.school;
        const beforeLevel = { ...game.state.player };
        game.state.player = addXp(game.state.player, clean * game.levelPackage.balance.school.xpPerCorrect, progressionBonuses(game));
        if (run.rewarded) game.state.player.coins += clean * game.levelPackage.balance.school.coinsPerCorrect;
        onProgressEvent('school-run', { kind: 'tingxie', correct: clean });
        if (lesson3Clean) onProgressEvent('tingxie-lesson3', { count: lesson3Clean });
        commit();
        playLevelUp(beforeLevel, game.state.player);
        return overlay.open(`<div class="panel result-panel"><h1>Tingxie complete</h1><p>You wrote ${clean}/${words.length} words without help.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
      }
      const word = words[index++];
      showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        recordWord(word, 'w', result.ok, !result.earnsTick);
        clean += result.ok ? 1 : 0;
        lesson3Clean += result.ok && word.lesson === 3 ? 1 : 0;
        next();
      }, { runId: `school-${Date.now()}-${index}`, lenient: game.state.settings.lenientWriting, forceMemory: true });
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
    overlay.open(`<article class="panel reading-panel"><p class="panel-kicker">Reading Hall · ${escapeHtml(group.category)}${group.subject === 'Higher Chinese' ? ' · Optional Higher Chinese' : ''}</p><h1>${escapeHtml(group.passage.title)}</h1><div class="passage-text">${escapeHtml(group.passage.text).replaceAll('\n', '<br>')}</div><p>${activePassage ? `${answered}/${reading.questionCount} villagers have received an answer. Look for ? bubbles in the village.` : `${Math.min(group.items.length, game.levelPackage.regionStory.passageVillagers.length)} villagers will each ask one short question.`}</p><div class="button-row"><button class="primary" data-reading-start>${activePassage ? 'Return to the village' : 'I’ve read it · Take Passage Scroll'}</button><button class="secondary" data-read-aloud>Read aloud</button>${!activePassage && group.subject !== 'Higher Chinese' && higherGroups.length ? '<button class="secondary" data-higher-chinese>Higher Chinese</button>' : ''}<button class="secondary" data-close-overlay>Read later</button></div></article>`, { onClose: speech.stop });
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
    overlay.open(`<div class="panel"><p class="panel-kicker">Passage question ${questionIndex + 1}/${reading.questionCount}</p><h1>${escapeHtml(object.name || object.interaction?.title || 'Villager')}</h1><p>I heard you read <b>${escapeHtml(group.passage.title)}</b>. May I ask one question?</p><div class="button-row"><button class="primary" data-passage-accept>Answer</button><button class="secondary" data-close-overlay>Later</button></div></div>`);
    document.querySelector('[data-passage-accept]').addEventListener('click', () => askPassageItem(group, item, questionIndex, 0), { once: true });
    return true;
  }

  function askPassageItem(group, item, questionIndex, attempt) {
    const passage = `<details class="passage-scroll"><summary>Open Passage Scroll</summary><div class="passage-text">${escapeHtml(group.passage.text).replaceAll('\n', '<br>')}</div></details>`;
    if (item.format === 'MCQ') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><div class="question-options">${item.o.map((option, index) => `<button data-passage-option="${index}">${escapeHtml(option)}</button>`).join('')}</div><button class="secondary" data-passage-giveup>I don’t know</button></article>`, { dismissible: false });
      for (const button of document.querySelectorAll('[data-passage-option]')) button.addEventListener('click', () => resolvePassageAuto(group, item, questionIndex, item.o[Number(button.dataset.passageOption)] === item.c, attempt), { once: true });
      document.querySelector('[data-passage-giveup]').addEventListener('click', () => finishPassageQuestion(group, questionIndex, 'help', false, item.displayAnswer || item.c), { once: true });
      return;
    }
    if (item.format === 'Fill-in') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><label class="answer-field">Your answer<input data-passage-input autocomplete="off"></label><div class="button-row"><button class="primary" data-passage-check>Check</button><button class="secondary" data-passage-giveup>I don’t know</button></div></article>`, { dismissible: false });
      document.querySelector('[data-passage-check]').addEventListener('click', () => resolvePassageAuto(group, item, questionIndex, checkPassageAnswer(item, document.querySelector('[data-passage-input]').value), attempt), { once: true });
      document.querySelector('[data-passage-giveup]').addEventListener('click', () => finishPassageQuestion(group, questionIndex, 'help', false, item.displayAnswer || item.accepted?.[0]), { once: true });
      return;
    }
    overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)}</p>${passage}<h2>${escapeHtml(item.q)}</h2><label class="answer-field">Write your answer<textarea data-passage-written rows="4"></textarea></label><div class="button-row"><button class="primary" data-passage-model>Show model answer</button><button class="secondary" data-passage-giveup>I don’t know</button></div></article>`, { dismissible: false });
    const compare = answer => {
      overlay.open(`<article class="panel"><p class="panel-kicker">Self-check</p><h2>Model answer</h2><p>${escapeHtml(item.displayAnswer || item.context || 'Discuss this answer with an adult.')}</p><p>Your answer: ${escapeHtml(answer || '(No answer)')}</p><div class="button-row"><button class="primary" data-passage-rate="right">Got it</button><button class="secondary" data-passage-rate="partly">Partly</button><button class="secondary" data-passage-rate="help">Not yet</button></div></article>`, { dismissible: false });
      for (const button of document.querySelectorAll('[data-passage-rate]')) button.addEventListener('click', () => {
        if (active().state.settings.sendWrittenAnswers) active().state.progress.reading.written.unshift({ day: localDay(), title: group.passage.title, question: item.q, answer, model: item.displayAnswer || item.context || '', rating: button.dataset.passageRate });
        finishPassageQuestion(group, questionIndex, button.dataset.passageRate, button.dataset.passageRate === 'right', item.displayAnswer || item.context);
      }, { once: true });
    };
    document.querySelector('[data-passage-model]').addEventListener('click', () => compare(document.querySelector('[data-passage-written]').value), { once: true });
    document.querySelector('[data-passage-giveup]').addEventListener('click', () => compare(''), { once: true });
  }

  function resolvePassageAuto(group, item, questionIndex, correct, attempt) {
    if (!correct && attempt === 0) {
      overlay.open(`<div class="panel result-panel"><h2>Look at the passage again</h2><p>Your first answer was not quite right. Read the relevant part and try once more.</p><button class="primary" data-passage-retry>Try again</button></div>`, { dismissible: false });
      document.querySelector('[data-passage-retry]').addEventListener('click', () => askPassageItem(group, item, questionIndex, 1), { once: true });
      return;
    }
    finishPassageQuestion(group, questionIndex, correct ? 'right' : 'help', correct, item.displayAnswer || item.c || item.accepted?.[0]);
  }

  function finishPassageQuestion(group, questionIndex, rating, correct, answer) {
    const game = active();
    const reading = normalizeReading(game.state.progress.reading);
    reading.results[questionIndex] = { rating, correct };
    game.state.progress.reading = reading;
    game.state.progress.accuracy = accuracyRecord(game.state.progress.accuracy, 'reading', correct);
    const coins = rating === 'right' ? 10 : rating === 'partly' ? 6 : 3;
    game.state.player.coins += coins;
    const beforeLevel = { ...game.state.player };
    if (rating === 'right') game.state.player = addXp(game.state.player, 5, progressionBonuses(game));
    onProgressEvent('reading-answer', { correct });
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
      audio?.sfx(first ? 'majorReward' : game.state.player.level > beforeLevel.level ? 'level' : 'win');
      return overlay.open(`<div class="panel result-panel ${first ? 'major-reward-panel' : ''}">${first ? passageRewardArt(readingKey, readingKeyName) : '<h1>Passage complete!</h1>'}<p>${first ? `The people of ${escapeHtml(game.levelPackage.region.name)} entrusted this key item to you. It opens the way to ${escapeHtml(game.levelPackage.regionStory.bossPlace || 'Muddle Cave')}.` : 'You received 30 coins and a Rice Ball.'} The passage is now in the Scroll Library.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
    }
    commit();
    playLevelUp(beforeLevel, game.state.player);
    overlay.open(`<div class="panel result-panel"><h2>${correct ? 'Correct!' : `Answer: ${escapeHtml(answer || '')}`}</h2><p>You received ${coins} coins. Find the next villager with a ? bubble.</p>${levelUpMarkup(beforeLevel, game.state.player)}<button class="primary" data-close-overlay>Continue</button></div>`);
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
      return showQuestion(overlay, question, null, result => { onProgressEvent('reading-answer', { correct: result.ok }); runPassage(group, index + 1, correct + (result.ok ? 1 : 0)); }, { title: `${group.passage.title} · ${index + 1}/${group.items.length}` });
    }
    if (item.format === 'Fill-in') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)} · ${index + 1}/${group.items.length}</p><h2>${escapeHtml(item.q)}</h2><label class="answer-field">Your answer<input data-reading-answer autocomplete="off"></label><div class="button-row"><button class="primary" data-reading-check>Check answer</button><button class="secondary" data-reading-giveup>I don't know</button></div></article>`, { dismissible: false });
      const finish = answer => {
        const ok = checkPassageAnswer(item, answer);
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
      showQuestion(overlay, makeQuestion(word, 'm', regionalWords), word, result => { recordWord(word, 'm', result.ok); next(); }, { title: `Bedtime review · ${index}/${review.length}` });
    };
    overlay.open(`<div class="panel inn-welcome"><p class="panel-kicker">${escapeHtml(innName)}</p><h1>Welcome to the Inn</h1><p>Would you like to rest and restore your HP?</p>${review.length ? '<p>The innkeeper asks three quick Meaning questions from this region before preparing your room.</p>' : '<p>You have no Word Spirits from this region to review yet, so your first rest here is free.</p>'}<div class="button-row"><button class="primary" data-inn-rest>${review.length ? 'Rest · Answer 3 questions' : 'Rest now'}</button><button class="secondary" data-close-overlay>Not now</button></div></div>`);
    document.querySelector('[data-inn-rest]').addEventListener('click', () => review.length ? next() : rest(), { once: true });
  }

  function shop() {
    const game = active();
    const shopItems = game.levelPackage.items;
    const redCap = game.levelPackage.gear.find(gear => gear.id === 'red-cap');
    const shopName = game.levelPackage.map.objects.find(object => object.id === 'shop-door')?.interaction?.title || 'Shop';
    overlay.open(`<div class="panel shop-panel"><header class="shop-banner"><div><p>${escapeHtml(shopName)}</p><h1>Supplies for the road</h1><span>Choose healing, battle boosts, or a quieter walk through the forest.</span></div><strong>${game.state.player.coins} coins</strong></header><section class="shop-shelf"><h2>Travel supplies</h2><div class="shop-grid">${shopItems.map(item => `<article class="shop-item"><img class="item-icon" src="${itemIcon(item.id)}" alt=""><div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(itemDescription(item))}</span><small>${item.price} coins · ${game.state.progress.inventory[item.id] || 0} in bag</small></div><button data-buy="${item.id}" ${game.state.player.coins < item.price ? 'disabled' : ''}>Buy</button></article>`).join('')}</div></section><section class="shop-shelf"><h2>Spirit bait and gear</h2><div class="shop-grid">${game.levelPackage.map.zones.map(zone => `<article class="shop-item"><img class="item-icon" src="${itemIcon('spirit-bait')}" alt=""><div><b>${escapeHtml(zone.name)} Bait</b><span>Choose the exact Lesson ${zone.lesson} spirit for your next encounter</span><small>35 coins</small></div><button data-bait-lesson="${zone.lesson}" ${game.state.player.coins < 35 ? 'disabled' : ''}>Choose</button></article>`).join('')}<article class="shop-item"><img class="item-icon" src="${itemIcon('red-cap')}" alt=""><div><b>${escapeHtml(redCap.name)}</b><span>Add 3 maximum HP when equipped</span><small>${redCap.price} coins</small></div><button data-buy-gear="red-cap" ${game.state.progress.equipment.owned.includes('red-cap') || game.state.player.coins < redCap.price ? 'disabled' : ''}>${game.state.progress.equipment.owned.includes('red-cap') ? 'Owned' : 'Buy'}</button></article></div></section><div class="button-row"><button class="secondary" data-close-overlay>Leave shop</button></div></div>`);
    for (const button of document.querySelectorAll('[data-buy]')) button.addEventListener('click', () => {
      const item = shopItems.find(candidate => candidate.id === button.dataset.buy);
      const bought = buyItem(game.state.player, game.state.progress.inventory, item.id, item);
      if (!bought.ok) return toast(bought.reason);
      game.state.player = bought.player;
      game.state.progress.inventory = bought.inventory;
      commit();
      toast(`${item.name} added to your bag.`);
      audio?.sfx('purchase');
      shop();
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
    overlay.open(`<div class="panel"><div class="panel-header"><div><p class="panel-kicker">Lesson ${lesson} bait</p><h1>Choose a Word Spirit</h1></div><button class="secondary" data-back-shop>Back</button></div><p>The chosen spirit will appear in your next encounter in this lesson's zone.</p><div class="spirit-grid">${words.map(word => `<button class="spirit-card" data-bait-word="${escapeHtml(word.w)}"><b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span><small>${game.state.progress.words[word.w]?.collected ? 'Collected' : 'Missing spirit'}</small></button>`).join('')}</div></div>`);
    document.querySelector('[data-back-shop]').addEventListener('click', shop);
    for (const button of document.querySelectorAll('[data-bait-word]')) button.addEventListener('click', () => {
      if (game.state.player.coins < 35) return toast('Not enough coins.');
      game.state.player.coins -= 35;
      game.state.progress.baits.push({ lesson, word: button.dataset.baitWord });
      audio?.sfx('purchase');
      commit();
      toast(`Bait prepared for ${button.dataset.baitWord}.`);
      shop();
    }, { once: true });
  }

  function spiritBook(selectedLesson = null) {
    const game = active();
    const lessons = game.levelPackage.config.regionLessons[game.levelPackage.region.id] || [];
    const words = game.levelPackage.content.words.filter(word => lessons.includes(word.lesson));
    const lessonNumbers = [...new Set(words.map(word => word.lesson))].sort((a, b) => a - b);
    const lesson = lessonNumbers.includes(Number(selectedLesson)) ? Number(selectedLesson) : lessonNumbers[0];
    const lessonWords = words.filter(word => word.lesson === lesson);
    const counts = { bronze: 0, silver: 0, gold: 0 };
    words.forEach(word => { const tier = tierOf(game.state.progress.words[word.w]); if (tier) counts[tier] += 1; });
    overlay.open(`<div class="panel book-panel"><div class="panel-header"><div><p class="panel-kicker">字灵图鉴</p><h1>Spirit Book</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Each skill circle fills after one correct answer without help. Three filled skills make Silver; all five make Gold.</p><div class="book-summary"><b>${counts.bronze} Bronze</b><b>${counts.silver} Silver</b><b>${counts.gold} Gold</b><b>${words.length} regional spirits</b></div><nav class="lesson-tabs" role="tablist" aria-label="Spirit Book lessons">${lessonNumbers.map(number => `<button type="button" role="tab" aria-selected="${number === lesson}" data-book-lesson="${number}">Lesson ${number}<small>${words.filter(word => word.lesson === number && tierOf(game.state.progress.words[word.w])).length}/${words.filter(word => word.lesson === number).length} collected</small></button>`).join('')}</nav><section class="lesson-spirit-list" role="tabpanel" aria-label="Lesson ${lesson} Spirit cards"><h2>Lesson ${lesson}</h2><div class="spirit-grid">${lessonWords.map(word => { const progress = normalizeWordProgress(game.state.progress.words[word.w]); const tier = tierOf(progress); return `<article class="spirit-card ${tier || 'unknown'}"><b>${tier ? escapeHtml(word.w) : '？'}</b><span>${tier ? `${escapeHtml(word.p)} · ${escapeHtml(word.m)}` : 'Not collected'}</span><small aria-label="${starsOf(progress)} of 5 skills filled">${Object.keys(SKILLS).map(skill => progress.ticks[skill] >= SKILL_TICKS_REQUIRED ? '●' : '○').join(' ')}</small></article>`; }).join('')}</div></section></div>`);
    for (const button of document.querySelectorAll('[data-book-lesson]')) button.addEventListener('click', () => spiritBook(Number(button.dataset.bookLesson)));
  }

  function parentPanel() {
    overlay.open(`<div class="panel"><p class="panel-kicker">Parent access</p><h1>Enter parent PIN</h1><label class="answer-field">PIN<input data-parent-pin type="password" inputmode="numeric" maxlength="8"></label><p data-pin-error></p><div class="button-row"><button class="primary" data-parent-unlock>Unlock</button><button class="secondary" data-close-overlay>Cancel</button></div></div>`);
    document.querySelector('[data-parent-unlock]').addEventListener('click', () => {
      if (!parentPinMatches(storage, document.querySelector('[data-parent-pin]').value)) {
        document.querySelector('[data-pin-error]').textContent = 'That PIN is not correct.';
        return;
      }
      showParentDashboard();
    });
  }

  function showParentDashboard(selectedTab = 'settings', selectedGiftLesson = null) {
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
    const settingsHtml = `<p class="parent-tab-intro">Set learning options, manage access, and give rewards without changing the child-facing game controls.</p>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Play and learning</h2><p>Choose how the game behaves during regular play.</p></div></div><div class="parent-settings">
        <label class="answer-field">Daily creature battles<select data-daily-cap>${[10,15,20,30,0].map(value => `<option value="${value}" ${game.state.settings.dailyBattles === value ? 'selected' : ''}>${value || 'No limit'}</option>`).join('')}</select></label>
        <label class="answer-field">Writing check<select data-writing-check><option value="gentle" ${game.state.settings.lenientWriting ? 'selected' : ''}>Gentle</option><option value="strict" ${!game.state.settings.lenientWriting ? 'selected' : ''}>Strict</option></select></label>
        <label class="answer-field">Speech speed<select data-speech-rate>${[[.7,'Slow'],[.85,'Normal'],[1,'Fast']].map(([value,label]) => `<option value="${value}" ${Number(game.state.settings.speechRate) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label class="answer-field">Sound<select data-sound><option value="on" ${game.state.settings.sound ? 'selected' : ''}>On</option><option value="off" ${!game.state.settings.sound ? 'selected' : ''}>Off</option></select></label>
        <label class="check-setting"><input type="checkbox" data-higher-chinese ${game.state.settings.higherChinese ? 'checked' : ''}> Allow Higher Chinese in the Reading Hall</label>
        <label class="answer-field">Unlock through region<select data-region-unlock>${[1,2,3,4,5,6,7].map(value => `<option value="${value}" ${game.state.settings.unlockedRegions === value ? 'selected' : ''}>Region ${value}</option>`).join('')}</select></label>
        <label class="check-setting"><input type="checkbox" data-test-mode ${game.state.settings.testMode ? 'checked' : ''}> Test mode: open all gates</label>
      </div></section>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Testing shortcuts</h2><p>Jump directly to a built region without defeating earlier bosses, or set the hero level for battle testing.</p></div></div><div class="parent-settings"><label class="answer-field">Jump to region<select data-parent-jump-region>${Object.values(game.levelPackage.campaigns).map(campaign => `<option value="${campaign.region.id}" ${campaign.region.id === game.levelPackage.region.id ? 'selected' : ''}>${escapeHtml(campaign.region.name)}</option>`).join('')}</select></label><button class="secondary" type="button" data-parent-jump>Jump now</button><label class="answer-field">Main-character level<input data-parent-level type="number" inputmode="numeric" min="1" max="99" value="${game.state.player.level}"></label><button class="secondary" type="button" data-parent-level-save>Apply level</button></div><p class="parent-tab-intro">Changing level resets current XP to 0 and fully restores HP. Learning progress is unchanged.</p></section>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Real-world goal</h2><p>Connect in-game progress to a family reward or milestone.</p></div></div><div class="goal-editor"><input data-goal-label value="${escapeHtml(goal?.label || '')}" placeholder="20 Gold words → ice-cream trip"><select data-goal-type><option value="gold" ${goal?.type === 'gold' ? 'selected' : ''}>Gold words</option><option value="streak" ${goal?.type === 'streak' ? 'selected' : ''}>Streak days</option><option value="region" ${goal?.type === 'region' ? 'selected' : ''}>Region cleared</option></select><input data-goal-target type="number" min="1" value="${goal?.target || 20}"><button data-goal-save>Save goal</button></div>${goal ? `<div class="parent-goal"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></div>` : ''}</section>
      <section class="parent-gift"><div class="parent-section-heading"><div><h2>Give a Spirit card—or several</h2><p>Select a lesson, then choose one or more cards to add at Bronze. Their five learning circles remain empty.</p></div></div>${missingRegionWords.length ? `<div class="parent-gift-toolbar"><label>Lesson<select data-gift-lesson aria-label="Lesson to gift from">${giftLessons.map(lesson => `<option value="${lesson}" ${lesson === giftLesson ? 'selected' : ''}>Lesson ${lesson}</option>`).join('')}</select></label><button class="secondary" type="button" data-gift-select-all>Select all</button></div><div class="parent-gift-grid" role="group" aria-label="Lesson ${giftLesson} Spirit cards">${giftLessonWords.map(word => `<label class="gift-word-option"><input type="checkbox" data-gift-word value="${escapeHtml(word.w)}"><span><b>${escapeHtml(word.w)}</b><small>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</small></span></label>`).join('')}</div><div class="parent-gift-actions"><span data-gift-count>0 selected</span><button class="primary" data-gift-spirit-save disabled>Give selected cards</button></div>` : '<p><b>Every Spirit card in this region has been collected.</b></p>'}</section>
      <section class="parent-section parent-actions"><div class="parent-section-heading"><div><h2>Parent tools</h2><p>Temporary allowances, curriculum selection, and save management.</p></div></div><div class="button-row"><button class="secondary" data-energy-add>Add 5 battles today</button><button class="secondary" data-switch-level>Switch curriculum</button><button class="secondary" data-export-save>Export save</button><button class="secondary" data-import-trigger>Import save</button><input data-import-save type="file" accept="application/json,.json" hidden></div></section>
      <details class="pin-settings"><summary>Change parent PIN</summary><div class="pin-editor"><label class="answer-field">New 4–8 digit PIN<input data-new-pin type="password" inputmode="numeric" maxlength="8"></label><button class="primary" data-change-pin>Change PIN</button></div></details>`;
    const summaryHtml = `<div class="summary-toolbar"><p class="parent-tab-intro">Review learning progress, patterns, and work that may need attention.</p><button class="secondary" data-weekly>View weekly summary</button></div>
      <div class="status-grid parent-status-grid"><div>Curriculum<b>${escapeHtml(game.levelPackage.label)}</b></div><div>Player level<b>${game.state.player.level}</b></div><div>Collected spirits<b>${progressWords.filter(value => value.collected || value.c).length}</b></div><div>Bronze / Silver / Gold<b>${bronze} / ${silver} / ${gold}</b></div><div>Battles today<b>${energy.day === localDay() ? energy.used : 0}/${game.state.settings.dailyBattles || '∞'}</b></div><div>Lantern streak<b>${game.state.progress.streak?.count || 0} days</b></div><div>Time played<b>${Math.round(game.state.session.playMs / 60000)} min</b></div><div>Unlocked regions<b>${game.state.settings.unlockedRegions}</b></div></div>
      ${goal ? `<section class="parent-goal"><b>${escapeHtml(goal.label)}</b><span>${goal.value}/${goal.target}</span><div><i style="width:${goal.percent}%"></i></div></section>` : '<p class="summary-empty">No real-world goal has been set in Settings.</p>'}
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Accuracy by skill</h2><p>Correct answers divided by total attempts.</p></div></div><div class="accuracy-grid">${accuracy.map(([skill, value]) => `<div><b>${escapeHtml(accuracyLabel(skill))}</b><span>${value.correct}/${value.total}</span><i><em style="width:${Math.round(value.correct / Math.max(1, value.total) * 100)}%"></em></i></div>`).join('') || '<p>Answer data will appear after the first activity.</p>'}</div></section>
      <div class="parent-tables"><section><h2>Most-missed words</h2>${missed.map(([word,count]) => `<p><b>${escapeHtml(word)}</b><span>${count}</span></p>`).join('') || '<p>None yet.</p>'}</section><section><h2>Writing help</h2>${helped.map(([character,count]) => `<p><b>${escapeHtml(character)}</b><span>${count}</span></p>`).join('') || '<p>None yet.</p>'}</section><section><h2>Due for review</h2>${due.map(word => `<p><b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.p)}</span></p>`).join('') || '<p>None today.</p>'}</section></div>
      <section class="parent-section"><div class="parent-section-heading"><div><h2>Written Reading Hall answers</h2><p>The ten most recent written responses and model answers.</p></div></div>${written.length ? written.slice(0, 10).map(entry => `<article class="written-review"><b>${escapeHtml(entry.day)} · ${escapeHtml(entry.title)} · ${escapeHtml(entry.rating)}</b><p>${escapeHtml(entry.question)}</p><small>Child: ${escapeHtml(entry.answer || '(No answer)')}</small><small>Model: ${escapeHtml(entry.model)}</small></article>`).join('') : '<p>No written answers yet.</p>'}</section>`;
    overlay.open(`<div class="panel parent-panel"><div class="panel-header"><div><p class="panel-kicker">Parent Mode</p><h1>Parent controls</h1></div><button class="secondary" data-close-overlay>Lock</button></div>${game.state.tampered ? '<p class="save-warning">This save failed its integrity check and was recovered. Review the progress before continuing.</p>' : ''}<nav class="parent-tabs" role="tablist" aria-label="Parent Mode sections"><button type="button" role="tab" aria-selected="${tab === 'settings'}" data-parent-tab="settings">Settings<small>Controls and rewards</small></button><button type="button" role="tab" aria-selected="${tab === 'summary'}" data-parent-tab="summary">Learning Summary<small>Progress and review</small></button></nav><section class="parent-tab-content" role="tabpanel" aria-label="${tab === 'settings' ? 'Settings' : 'Learning Summary'}">${tab === 'settings' ? settingsHtml : summaryHtml}</section></div>`);
    for (const button of document.querySelectorAll('[data-parent-tab]')) button.addEventListener('click', () => showParentDashboard(button.dataset.parentTab));
    if (tab === 'summary') {
      document.querySelector('[data-weekly]').addEventListener('click', showWeeklySummary);
      return;
    }
    document.querySelector('[data-daily-cap]').addEventListener('change', event => { game.state.settings.dailyBattles = Number(event.target.value); commit(); });
    document.querySelector('[data-writing-check]').addEventListener('change', event => { game.state.settings.lenientWriting = event.target.value === 'gentle'; commit(); });
    document.querySelector('[data-speech-rate]').addEventListener('change', event => { game.state.settings.speechRate = Number(event.target.value); commit(); });
    document.querySelector('[data-sound]').addEventListener('change', event => { game.state.settings.sound = event.target.value === 'on'; audio?.setEnabled(game.state.settings.sound); commit(); });
    document.querySelector('[data-higher-chinese]').addEventListener('change', event => { game.state.settings.higherChinese = event.target.checked; if (!event.target.checked) { const reading = normalizeReading(game.state.progress.reading); const activeGroup = game.levelPackage.content.questions.groups.find(group => group.id === reading.active); if (activeGroup?.subject === 'Higher Chinese') game.state.progress.reading = { ...reading, active: null, index: 0, questionCount: 0, results: {} }; } commit(); });
    document.querySelector('[data-region-unlock]').addEventListener('change', event => { game.state.settings.unlockedRegions = Number(event.target.value); commit(); });
    document.querySelector('[data-test-mode]').addEventListener('change', event => { game.state.settings.testMode = event.target.checked; commit(); });
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
      commit();
      toast(`Main character set to Level ${game.state.player.level}.`);
      showParentDashboard('settings');
    });
    document.querySelector('[data-goal-save]').addEventListener('click', () => { const type = document.querySelector('[data-goal-type]').value; game.state.progress.parent.goal = { label: document.querySelector('[data-goal-label]').value.trim() || 'Learning goal', type, target: type === 'region' ? 1 : Math.max(1, Number(document.querySelector('[data-goal-target]').value) || 1), celebrated: false }; commit(); toast('Goal saved. It is now visible in the player room.'); showParentDashboard('settings'); });
    document.querySelector('[data-gift-lesson]')?.addEventListener('change', event => showParentDashboard('settings', Number(event.target.value)));
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
      if (!gifted.ok) return toast('Select at least one available Spirit card.');
      game.state.progress.words = gifted.words;
      onCollectionChanged();
      commit();
      toast(`${gifted.gifted.length} Spirit card${gifted.gifted.length === 1 ? '' : 's'} added to the Spirit Book at Bronze.`);
      showParentDashboard('settings', giftLesson);
    });
    document.querySelector('[data-energy-add]').addEventListener('click', () => { if (game.state.progress.energy.day !== localDay()) game.state.progress.energy = { day: localDay(), used: 0 }; game.state.progress.energy.used = Math.max(0, game.state.progress.energy.used - 5); commit(); toast('Five battles were added for today.'); showParentDashboard('settings'); });
    document.querySelector('[data-switch-level]').addEventListener('click', onSwitchLevel);
    document.querySelector('[data-export-save]').addEventListener('click', () => { const blob = new Blob([JSON.stringify(exportSaveEnvelope(game.state), null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `word-spirit-quest-${game.state.level}-${localDay()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); });
    const fileInput = document.querySelector('[data-import-save]');
    document.querySelector('[data-import-trigger]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => { try { const envelope = JSON.parse(await fileInput.files[0].text()); game.state = importSaveEnvelope(envelope, game.levelPackage); commit(); toast('Save imported successfully.'); showParentDashboard('settings'); } catch (error) { toast(error.message); } });
    document.querySelector('[data-change-pin]').addEventListener('click', () => { if (!setParentPin(storage, document.querySelector('[data-new-pin]').value)) return toast('Use 4–8 digits for the new PIN.'); toast('Parent PIN changed.'); });
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
    if (reading.active && passageIndex >= 0 && passageIndex < reading.questionCount && reading.results[passageIndex] == null) return passageQuestion(object, passageIndex);
    const handlers = {
      'school-door': school,
      'inn-door': inn,
      'hall-door': readingHall,
      'shop-door': () => { audio?.sfx('enterShop'); shop(); }
    };
    if (handlers[object.id]) { handlers[object.id](); return true; }
    return false;
  }

  return { handleInteraction, startBattle, tutorialBattle, rivalDuel, school, readingHall, inn, shop, spiritBook, parentPanel, battlesLeft: () => battlesLeft(active().state.progress.energy, localDay(), active().state.settings.dailyBattles) };
}
