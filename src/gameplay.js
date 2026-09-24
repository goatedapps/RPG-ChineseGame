import { createBattleState, enemyAttack, gainBattleRewards, playerAttack } from './battle/battle.js';
import { createCreature } from './battle/creatures.js';
import { buyItem } from './systems/economy.js';
import { applyHealing, useConsumable } from './systems/inventory.js';
import { gearBonuses } from './systems/gear.js';
import { partnerBonuses, partnerMove } from './systems/partners.js';
import { battlesLeft, useBattle } from './systems/energy.js';
import { ensureParentPin, parentPinMatches } from './systems/parent.js';
import { checkPassageAnswer, completePassage, normalizeReading, selectPassage } from './systems/reading.js';
import { normalizeSchool, schoolRun, weekKey } from './systems/school.js';
import { filterSupportedQuestions, enabledQuestionKinds } from './learning/examAdapters.js';
import { makeExamQuestion, makeQuestion } from './learning/questions.js';
import { normalizeWordProgress, recordAnswer, SKILLS, starsOf, tierOf } from './learning/mastery.js';
import { selectWord } from './learning/selection.js';
import { localDay } from './core/time.js';
import { escapeHtml } from './ui/dom.js';
import { showQuestion } from './ui/questionView.js';
import { showWritingTask } from './ui/writingView.js';

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

export function createGameplay({ overlay, storage, getActive, persist, render, toast, onCollectionChanged = () => {}, onProgressEvent = () => {} }) {
  ensureParentPin(storage);
  const active = () => getActive();
  const wordsForLesson = lesson => active().levelPackage.content.words.filter(word => word.lesson === lesson);
  const commit = () => { persist(); render(); };

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
    const assisted = Boolean(battle.lantern);
    if (battle.lantern && question.options.length > 2) {
      const wrong = question.options.find(option => option !== question.correct);
      question.options = question.options.filter(option => option !== wrong);
      battle.lantern = false;
    }
    showQuestion(overlay, question, battle.word, result => {
      recordWord(battle.word, skill, result.ok, assisted);
      done(result.ok, skill);
    }, { title: SKILLS[skill].action });
  }

  function showBattle(battle, message = '') {
    const game = active();
    const bonuses = gearBonuses(game.state.progress.equipment, game.levelPackage.gear);
    const lead = game.levelPackage.content.words.find(word => word.id === game.state.progress.partners[0]);
    const move = partnerMove(lead, lead && game.state.progress.words[lead.w], game.levelPackage.wordTags);
    overlay.open(`<article class="panel battle-panel">
      <p class="panel-kicker">Wild word spirit · Lesson ${battle.word.lesson}</p>
      <div class="battle-grid">
        <div class="creature-card" style="--creature:${battle.creature.color}"><div class="creature-face">${escapeHtml(battle.word.w)}</div><h2>${escapeHtml(battle.creature.name)} · Lv ${battle.creature.level}</h2><p>${escapeHtml(battle.word.p)} · ${escapeHtml(battle.word.m)}</p><b>HP ${battle.enemyHp}/${battle.creature.maxHp}</b></div>
        <div><h2>Your turn</h2><p>HP <b>${game.state.player.hp}/${game.state.player.maxHp}</b> · ATK ${3 + game.state.player.level * 3} · DEF ${game.state.player.level * 2}</p>${message ? `<p class="battle-message">${escapeHtml(message)}</p>` : ''}
          <div class="attack-grid">${Object.entries(SKILLS).map(([key, skill]) => `<button type="button" data-attack="${key}" class="${key === battle.creature.weak ? 'recommended' : ''}"><b>${escapeHtml(skill.action)}</b><span>${escapeHtml(skill.name)}</span></button>`).join('')}</div>
          <div class="button-row"><button class="secondary" data-bag type="button">Open bag</button>${move && !battle.partnerUsed ? `<button class="secondary" data-partner-skill type="button">${escapeHtml(move.label)}</button>` : ''}<button class="secondary" data-run type="button">Run safely</button></div>
        </div>
      </div>
    </article>`, { dismissible: false });
    for (const button of document.querySelectorAll('[data-attack]')) button.addEventListener('click', () => questionForBattle(battle, button.dataset.attack, (ok, skill) => {
      const playerResult = playerAttack(battle, game.state.player, skill, { correct: ok, bonusDamage: (bonuses.skillDamage[skill] || 0) + (battle.partnerBoost || 0), damageMultiplier: battle.doubleHit ? 2 : 1 });
      battle.partnerBoost = 0;
      battle.doubleHit = false;
      battle = playerResult.battle;
      if (battle.finished) return battleWin(battle, playerResult.damage);
      const blocksMiss = !ok && battle.ignoreMiss;
      if (blocksMiss) battle.ignoreMiss = false;
      const enemyResult = enemyAttack(battle, game.state.player, Math.random, { evasionBonus: bonuses.evasion, damageReduction: bonuses.spellDefense + (battle.partnerShield || blocksMiss ? 999 : 0) });
      battle.partnerShield = false;
      game.state.player = enemyResult.player;
      if (game.state.player.hp <= 0) return faint(battle);
      commit();
      const attackMessage = ok ? `You dealt ${playerResult.damage} damage. ` : 'Your attack missed. ';
      showBattle(battle, `${attackMessage}${enemyResult.evaded ? 'You dodged the counterattack!' : `${battle.creature.name} dealt ${enemyResult.damage} damage.`}`);
    }), { once: true });
    document.querySelector('[data-run]').addEventListener('click', () => { overlay.close(); commit(); toast('You returned safely to the village.'); }, { once: true });
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

  function battleBag(battle) {
    const game = active();
    const owned = game.levelPackage.items.filter(item => game.state.progress.inventory[item.id] > 0);
    overlay.open(`<div class="panel"><p class="panel-kicker">Battle bag</p><h1>Choose an item</h1><div class="service-grid">${owned.map(item => `<button data-use-item="${item.id}"><b>${escapeHtml(item.name)} × ${game.state.progress.inventory[item.id]}</b><span>${escapeHtml(item.effect)}</span></button>`).join('') || '<p>Your bag is empty.</p>'}</div><div class="button-row"><button class="secondary" data-back-battle>Back</button></div></div>`, { dismissible: false });
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
      if (item.effect === 'escape') { commit(); overlay.close(); toast('The Smoke Ball carried you safely home.'); return; }
      commit();
      showBattle(battle, `${item.name} is ready.`);
    });
  }

  function battleWin(battle, damage) {
    const game = active();
    const progress = normalizeWordProgress(game.state.progress.words[battle.word.w]);
    game.state.progress.words[battle.word.w] = { ...progress, collected: true };
    const rewards = progressionBonuses(game);
    const xpMultiplier = rewards.xpMultiplier;
    const xpAwarded = Math.round(game.levelPackage.balance.combat.battleXp * xpMultiplier);
    game.state.player = gainBattleRewards(game.state.player, game.levelPackage.balance, rewards);
    if (battle.doubleCoins) game.state.player.coins += game.levelPackage.balance.combat.battleCoins;
    const materialByCreature = { fogling: 'mist-drop', 'echo-bat': 'echo-feather', 'twin-shade': 'mirror-shard', 'jumble-bug': 'jumble-silk', 'ink-imp': 'ink-bead' };
    const material = materialByCreature[battle.creature.id];
    const pouch = game.state.progress.inventory['material-pouch'] ? 2 : 1;
    game.state.progress.materials[material] = (game.state.progress.materials[material] || 0) + pouch;
    onProgressEvent('battle-win', { creature: battle.creature.id, word: battle.word.w });
    onCollectionChanged();
    commit();
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Victory</p><h1>${escapeHtml(battle.word.w)} joined your Spirit Book!</h1><p>You dealt ${damage} damage and earned ${xpAwarded} XP and ${game.levelPackage.balance.combat.battleCoins * (battle.doubleCoins ? 2 : 1)} coins.</p><button class="primary" data-close-overlay type="button">Return to village</button></div>`);
  }

  function faint(battle) {
    const game = active();
    game.state.player.hp = game.state.player.maxHp;
    game.state.player.x = game.levelPackage.map.spawn.x;
    game.state.player.y = game.levelPackage.map.spawn.y;
    commit();
    overlay.open(`<div class="panel result-panel"><h1>You need a rest</h1><p>${escapeHtml(battle.creature.name)} was too strong, so the villagers carried you home. You lost nothing and your HP was restored.</p><button class="primary" data-close-overlay type="button">Continue</button></div>`);
  }

  function startBattle(lesson) {
    const game = active();
    const cap = game.state.settings.dailyBattles;
    const energy = useBattle(game.state.progress.energy, localDay(), cap);
    if (!energy.allowed) return toast(game.levelPackage.strings.battleCap);
    const word = selectWord(wordsForLesson(lesson), game.state.progress.words, { day: localDay() });
    if (!word) return toast(game.levelPackage.strings.peaceful);
    const creature = createCreature(lesson, game.levelPackage.balance);
    game.state.progress.energy = energy.energy;
    game.state.progress.battles += 1;
    const battle = createBattleState(word, creature);
    commit();
    showBattle(battle, `A level ${battle.creature.level} ${battle.creature.name} appeared!`);
  }

  function tutorialBattle(onDone) {
    const game = active();
    const word = game.levelPackage.content.words.find(candidate => candidate.w === '露营') || wordsForLesson(1)[0];
    const creature = createCreature(1, game.levelPackage.balance, () => 0);
    const ask = () => {
      overlay.open(`<article class="panel battle-panel"><p class="panel-kicker">First Spirit Brush battle</p><div class="battle-grid"><div class="creature-card" style="--creature:${creature.color}"><div class="creature-face">${escapeHtml(word.w)}</div><h2>${escapeHtml(creature.name)}</h2><b>HP 1/1</b></div><div><h2>Use Meaning Strike</h2><p>Answer the question to free your first Word Spirit.</p><button class="primary" data-tutorial-attack>Meaning Strike</button></div></div></article>`, { dismissible: false });
      document.querySelector('[data-tutorial-attack]').addEventListener('click', () => {
        showQuestion(overlay, makeQuestion(word, 'm', game.levelPackage.content.words), word, result => {
          recordWord(word, 'm', result.ok);
          if (!result.ok) { toast('The Spirit Brush glows. Try that meaning once more.'); ask(); return; }
          const progress = normalizeWordProgress(game.state.progress.words[word.w]);
          game.state.progress.words[word.w] = { ...progress, collected: true };
          game.state.player.coins += 5;
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
    const words = [...game.levelPackage.content.words.filter(word => game.levelPackage.config.regionLessons.r1.includes(word.lesson))].sort(() => Math.random() - 0.5).slice(0, 5);
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
      game.state.player = addXp(game.state.player, correct * game.levelPackage.balance.school.xpPerCorrect, rewards);
      if (run.rewarded) game.state.player.coins += correct * game.levelPackage.balance.school.coinsPerCorrect;
      onProgressEvent('school-run', { kind: examDay ? 'exam' : 'quiz', correct });
      commit();
      overlay.open(`<div class="panel result-panel"><h1>${escapeHtml(title)} complete</h1><p>You answered <b>${correct}/${total}</b> correctly and earned ${xpAwarded} XP${run.rewarded ? ` plus ${correct * game.levelPackage.balance.school.coinsPerCorrect} coins` : ''}.</p><button class="primary" data-close-overlay>Continue</button></div>`);
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
        game.state.player = addXp(game.state.player, clean * game.levelPackage.balance.school.xpPerCorrect, progressionBonuses(game));
        if (run.rewarded) game.state.player.coins += clean * game.levelPackage.balance.school.coinsPerCorrect;
        onProgressEvent('school-run', { kind: 'tingxie', correct: clean });
        if (lesson3Clean) onProgressEvent('tingxie-lesson3', { count: lesson3Clean });
        commit();
        return overlay.open(`<div class="panel result-panel"><h1>Tingxie complete</h1><p>You wrote ${clean}/${words.length} words without help.</p><button class="primary" data-close-overlay>Continue</button></div>`);
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

  function readingHall() {
    const game = active();
    const enabled = enabledQuestionKinds(game.levelPackage.config);
    const groups = game.levelPackage.content.questions.groups.filter(group => enabled.has(group.kind));
    const reading = normalizeReading(game.state.progress.reading);
    const group = selectPassage(groups, reading);
    if (!group) return overlay.open('<div class="panel"><h1>Reading Hall</h1><p>You have completed every available standard passage.</p><button class="secondary" data-close-overlay>Leave</button></div>');
    overlay.open(`<article class="panel reading-panel"><p class="panel-kicker">Reading Hall · ${escapeHtml(group.category)}</p><h1>${escapeHtml(group.passage.title)}</h1><div class="passage-text">${escapeHtml(group.passage.text).replaceAll('\n', '<br>')}</div><p>${group.items.length} questions follow. Open answers are completed by comparing with a model answer, without automatic marking.</p><div class="button-row"><button class="primary" data-reading-start>Begin passage chain</button><button class="secondary" data-close-overlay>Read later</button></div></article>`);
    document.querySelector('[data-reading-start]').addEventListener('click', () => runPassage(group, 0, 0), { once: true });
  }

  function runPassage(group, index, correct) {
    const game = active();
    if (index >= group.items.length) {
      const completed = completePassage(game.state.progress.reading, group.id, game.levelPackage.balance.reading.keyItem, game.state.progress.inventory);
      game.state.progress.reading = completed.reading;
      game.state.progress.inventory = completed.inventory;
      game.state.player.coins += game.levelPackage.balance.reading.completionCoins;
      commit();
      return overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Passage complete · ${correct}/${group.items.length} auto-marked correct</p><h1>Cave Lantern received</h1><p>${escapeHtml(game.levelPackage.strings.readingComplete)}</p><button class="primary" data-close-overlay>Continue</button></div>`);
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
    const collected = game.levelPackage.content.words.filter(word => game.state.progress.words[word.w]?.collected || game.state.progress.words[word.w]?.c);
    const rest = () => {
      game.state.player.hp = game.state.player.maxHp;
      commit();
      overlay.open('<div class="panel result-panel"><h1>Fully rested</h1><p>Your HP is full. The word spirits are ready for another adventure.</p><button class="primary" data-close-overlay>Continue</button></div>');
    };
    if (!collected.length) return rest();
    const review = [...collected].sort((a, b) => starsOf(game.state.progress.words[a.w]) - starsOf(game.state.progress.words[b.w])).slice(0, 3);
    let index = 0;
    const next = () => {
      if (index >= review.length) return rest();
      const word = review[index++];
      showQuestion(overlay, makeQuestion(word, 'm', game.levelPackage.content.words), word, result => { recordWord(word, 'm', result.ok); next(); }, { title: `Bedtime review · ${index}/${review.length}` });
    };
    next();
  }

  function shop() {
    const game = active();
    const shopItems = game.levelPackage.items;
    const redCap = game.levelPackage.gear.find(gear => gear.id === 'red-cap');
    overlay.open(`<div class="panel"><p class="panel-kicker">Scholar Village Shop</p><h1>Supplies and gear</h1><div class="shop-grid">${shopItems.map(item => `<article><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.effect)} · ${item.price} coins · Own ${game.state.progress.inventory[item.id] || 0}</span><button data-buy="${item.id}">Buy</button></article>`).join('')}<article><b>${escapeHtml(redCap.name)}</b><span>+3 max HP · ${redCap.price} coins</span><button data-buy-gear="red-cap" ${game.state.progress.equipment.owned.includes('red-cap') ? 'disabled' : ''}>${game.state.progress.equipment.owned.includes('red-cap') ? 'Owned' : 'Buy'}</button></article></div><div class="button-row"><button class="secondary" data-close-overlay>Leave Shop</button></div></div>`);
    for (const button of document.querySelectorAll('[data-buy]')) button.addEventListener('click', () => {
      const item = shopItems.find(candidate => candidate.id === button.dataset.buy);
      const bought = buyItem(game.state.player, game.state.progress.inventory, item.id, item);
      if (!bought.ok) return toast(bought.reason);
      game.state.player = bought.player;
      game.state.progress.inventory = bought.inventory;
      commit();
      toast(`${item.name} added to your bag.`);
      shop();
    });
    document.querySelector('[data-buy-gear]:not([disabled])')?.addEventListener('click', () => {
      if (game.state.player.coins < redCap.price) return toast('Not enough coins.');
      game.state.player.coins -= redCap.price;
      game.state.progress.equipment.owned.push(redCap.id);
      commit(); shop();
    });
  }

  function spiritBook() {
    const game = active();
    const lessons = game.levelPackage.config.regionLessons.r1;
    const words = game.levelPackage.content.words.filter(word => lessons.includes(word.lesson));
    const counts = { bronze: 0, silver: 0, gold: 0 };
    words.forEach(word => { const tier = tierOf(game.state.progress.words[word.w]); if (tier) counts[tier] += 1; });
    overlay.open(`<div class="panel book-panel"><div class="panel-header"><div><p class="panel-kicker">字灵图鉴</p><h1>Spirit Book</h1></div><button class="secondary" data-close-overlay>Close</button></div><p>Stars fill after correct work on two different days. Three complete skills make Silver; all five make Gold.</p><div class="book-summary"><b>${counts.bronze} Bronze</b><b>${counts.silver} Silver</b><b>${counts.gold} Gold</b><b>${words.length} regional spirits</b></div><div class="spirit-grid">${words.map(word => { const progress = normalizeWordProgress(game.state.progress.words[word.w]); const tier = tierOf(progress); return `<article class="spirit-card ${tier || 'unknown'}"><b>${tier ? escapeHtml(word.w) : '？'}</b><span>${tier ? `${escapeHtml(word.p)} · ${escapeHtml(word.m)}` : `Lesson ${word.lesson} · Not collected`}</span><small>${Object.keys(SKILLS).map(skill => progress.ticks[skill] >= 2 ? '★' : progress.ticks[skill] ? '◐' : '○').join(' ')}</small></article>`; }).join('')}</div></div>`);
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

  function showParentDashboard() {
    const game = active();
    const progressWords = Object.values(game.state.progress.words);
    const written = game.state.progress.reading.written || [];
    const energy = game.state.progress.energy;
    overlay.open(`<div class="panel parent-panel"><div class="panel-header"><div><p class="panel-kicker">Parent Panel</p><h1>Learning summary</h1></div><button class="secondary" data-close-overlay>Lock</button></div><div class="status-grid"><div>Collected spirits<b>${progressWords.filter(value => value.collected || value.c).length}</b></div><div>Gold spirits<b>${progressWords.filter(value => tierOf(value) === 'gold').length}</b></div><div>Battles today<b>${energy.day === localDay() ? energy.used : 0}/${game.state.settings.dailyBattles || '∞'}</b></div><div>Lantern streak<b>${game.state.progress.streak?.count || 0} days</b></div><div>Time played<b>${Math.round(game.state.session.playMs / 60000)} min</b></div></div><label class="answer-field">Daily creature battles<select data-daily-cap>${[10,15,20,30,0].map(value => `<option value="${value}" ${game.state.settings.dailyBattles === value ? 'selected' : ''}>${value || 'No limit'}</option>`).join('')}</select></label><div class="button-row"><button class="secondary" data-energy-add>Add 5 battles today</button></div><h2>Written Reading Hall answers</h2>${written.length ? written.slice(0, 10).map(entry => `<article class="written-review"><b>${escapeHtml(entry.day)} · ${escapeHtml(entry.title)} · ${escapeHtml(entry.rating)}</b><p>${escapeHtml(entry.question)}</p><small>Child: ${escapeHtml(entry.answer || '(No answer)')}</small><small>Model: ${escapeHtml(entry.model)}</small></article>`).join('') : '<p>No written answers yet.</p>'}</div>`);
    document.querySelector('[data-daily-cap]').addEventListener('change', event => { game.state.settings.dailyBattles = Number(event.target.value); commit(); });
    document.querySelector('[data-energy-add]').addEventListener('click', () => {
      if (game.state.progress.energy.day !== localDay()) game.state.progress.energy = { day: localDay(), used: 0 };
      game.state.progress.energy.used = Math.max(0, game.state.progress.energy.used - 5);
      commit();
      toast('Five battles were added for today.');
      showParentDashboard();
    });
  }

  function handleInteraction(object) {
    const handlers = {
      'school-door': school,
      'inn-door': inn,
      'hall-door': readingHall,
      'shop-door': shop,
      'forest-sign': () => startBattle(1),
      'mist-sign': () => startBattle(2),
      'garden-sign': () => startBattle(3)
    };
    if (handlers[object.id]) { handlers[object.id](); return true; }
    return false;
  }

  return { handleInteraction, startBattle, tutorialBattle, rivalDuel, school, readingHall, inn, shop, spiritBook, parentPanel, battlesLeft: () => battlesLeft(active().state.progress.energy, localDay(), active().state.settings.dailyBattles) };
}

