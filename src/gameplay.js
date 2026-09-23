import { createBattleState, enemyAttack, gainBattleRewards, playerAttack } from './battle/battle.js';
import { createCreature } from './battle/creatures.js';
import { buyItem, useHealingItem } from './systems/economy.js';
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

function addXp(player, amount) {
  let level = player.level;
  let xp = player.xp + amount;
  let maxHp = player.maxHp;
  while (xp >= level * 30) {
    xp -= level * 30;
    level += 1;
    maxHp = 18 + level * 2;
  }
  return { ...player, level, xp, maxHp, hp: level > player.level ? maxHp : player.hp };
}

function accuracyRecord(accuracy, skill, ok) {
  const current = accuracy[skill] || { correct: 0, total: 0 };
  return { ...accuracy, [skill]: { correct: current.correct + (ok ? 1 : 0), total: current.total + 1 } };
}

export function createGameplay({ overlay, storage, getActive, persist, render, toast }) {
  ensureParentPin(storage);
  const active = () => getActive();
  const wordsForLesson = lesson => active().levelPackage.content.words.filter(word => word.lesson === lesson);
  const commit = () => { persist(); render(); };

  function recordWord(word, skill, ok, assisted = false) {
    const game = active();
    const recorded = recordAnswer(game.state.progress.words[word.w], { skill, correct: ok, day: localDay(), assisted });
    game.state.progress.words[word.w] = recorded.progress;
    game.state.progress.accuracy = accuracyRecord(game.state.progress.accuracy, skill, ok);
    return recorded;
  }

  function questionForBattle(battle, skill, done) {
    const game = active();
    if (skill === 'w') {
      showWritingTask(overlay, battle.word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        recordWord(battle.word, 'w', result.ok, !result.earnsTick);
        done(result.ok, 'w');
      }, { runId: `battle-${game.state.progress.battles}-${battle.turn}`, lenient: game.state.settings.lenientWriting });
      return;
    }
    const question = makeQuestion(battle.word, skill, game.levelPackage.content.words);
    showQuestion(overlay, question, battle.word, result => {
      recordWord(battle.word, skill, result.ok);
      done(result.ok, skill);
    }, { title: SKILLS[skill].action });
  }

  function showBattle(battle, message = '') {
    const game = active();
    const item = game.levelPackage.balance.items['rice-ball'];
    overlay.open(`<article class="panel battle-panel">
      <p class="panel-kicker">Wild word spirit · Lesson ${battle.word.lesson}</p>
      <div class="battle-grid">
        <div class="creature-card" style="--creature:${battle.creature.color}"><div class="creature-face">${escapeHtml(battle.word.w)}</div><h2>${escapeHtml(battle.creature.name)} · Lv ${battle.creature.level}</h2><p>${escapeHtml(battle.word.p)} · ${escapeHtml(battle.word.m)}</p><b>HP ${battle.enemyHp}/${battle.creature.maxHp}</b></div>
        <div><h2>Your turn</h2><p>HP <b>${game.state.player.hp}/${game.state.player.maxHp}</b> · ATK ${3 + game.state.player.level * 3} · DEF ${game.state.player.level * 2}</p>${message ? `<p class="battle-message">${escapeHtml(message)}</p>` : ''}
          <div class="attack-grid">${Object.entries(SKILLS).map(([key, skill]) => `<button type="button" data-attack="${key}" class="${key === battle.creature.weak ? 'recommended' : ''}"><b>${escapeHtml(skill.action)}</b><span>${escapeHtml(skill.name)}</span></button>`).join('')}</div>
          <div class="button-row"><button class="secondary" data-rice type="button">Rice Ball × ${game.state.progress.inventory['rice-ball'] || 0}</button><button class="secondary" data-run type="button">Run safely</button></div>
        </div>
      </div>
    </article>`, { dismissible: false });
    for (const button of document.querySelectorAll('[data-attack]')) button.addEventListener('click', () => questionForBattle(battle, button.dataset.attack, (ok, skill) => {
      const playerResult = playerAttack(battle, game.state.player, skill, { correct: ok });
      battle = playerResult.battle;
      if (battle.finished) return battleWin(battle, playerResult.damage);
      const enemyResult = enemyAttack(battle, game.state.player);
      game.state.player = enemyResult.player;
      if (game.state.player.hp <= 0) return faint(battle);
      commit();
      const attackMessage = ok ? `You dealt ${playerResult.damage} damage. ` : 'Your attack missed. ';
      showBattle(battle, `${attackMessage}${enemyResult.evaded ? 'You dodged the counterattack!' : `${battle.creature.name} dealt ${enemyResult.damage} damage.`}`);
    }), { once: true });
    document.querySelector('[data-run]').addEventListener('click', () => { overlay.close(); commit(); toast('You returned safely to the village.'); }, { once: true });
    document.querySelector('[data-rice]').addEventListener('click', () => {
      const used = useHealingItem(game.state.player, game.state.progress.inventory, 'rice-ball', item);
      if (!used.ok) return toast('You have no Rice Balls.');
      game.state.player = used.player;
      game.state.progress.inventory = used.inventory;
      commit();
      showBattle(battle, `Recovered ${item.heal} HP.`);
    }, { once: true });
  }

  function battleWin(battle, damage) {
    const game = active();
    const progress = normalizeWordProgress(game.state.progress.words[battle.word.w]);
    game.state.progress.words[battle.word.w] = { ...progress, collected: true };
    game.state.player = gainBattleRewards(game.state.player, game.levelPackage.balance);
    commit();
    overlay.open(`<div class="panel result-panel"><p class="panel-kicker">Victory</p><h1>${escapeHtml(battle.word.w)} joined your Spirit Book!</h1><p>You dealt ${damage} damage and earned ${game.levelPackage.balance.combat.battleXp} XP and ${game.levelPackage.balance.combat.battleCoins} coins.</p><button class="primary" data-close-overlay type="button">Return to village</button></div>`);
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
      game.state.player = addXp(game.state.player, correct * game.levelPackage.balance.school.xpPerCorrect);
      if (run.rewarded) game.state.player.coins += correct * game.levelPackage.balance.school.coinsPerCorrect;
      commit();
      overlay.open(`<div class="panel result-panel"><h1>${escapeHtml(title)} complete</h1><p>You answered <b>${correct}/${total}</b> correctly and earned ${correct * game.levelPackage.balance.school.xpPerCorrect} XP${run.rewarded ? ` plus ${correct * game.levelPackage.balance.school.coinsPerCorrect} coins` : ''}.</p><button class="primary" data-close-overlay>Continue</button></div>`);
    });
  }

  function schoolDictation() {
    const game = active();
    const words = [...game.levelPackage.content.words].sort(() => Math.random() - 0.5).slice(0, 3);
    let index = 0;
    let clean = 0;
    const next = () => {
      if (index >= words.length) {
        const run = schoolRun(game.state.progress.school, localDay(), game.levelPackage.balance.school.paidRunsPerDay);
        game.state.progress.school = run.school;
        game.state.player = addXp(game.state.player, clean * game.levelPackage.balance.school.xpPerCorrect);
        if (run.rewarded) game.state.player.coins += clean * game.levelPackage.balance.school.coinsPerCorrect;
        commit();
        return overlay.open(`<div class="panel result-panel"><h1>Tingxie complete</h1><p>You wrote ${clean}/${words.length} words without help.</p><button class="primary" data-close-overlay>Continue</button></div>`);
      }
      const word = words[index++];
      showWritingTask(overlay, word, game.levelPackage.characters.characters, game.state.progress.characters, (result, characters) => {
        game.state.progress.characters = characters;
        recordWord(word, 'w', result.ok, !result.earnsTick);
        clean += result.ok ? 1 : 0;
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
      return showQuestion(overlay, question, null, result => runPassage(group, index + 1, correct + (result.ok ? 1 : 0)), { title: `${group.passage.title} · ${index + 1}/${group.items.length}` });
    }
    if (item.format === 'Fill-in') {
      overlay.open(`<article class="panel question-panel"><p class="panel-kicker">${escapeHtml(group.passage.title)} · ${index + 1}/${group.items.length}</p><h2>${escapeHtml(item.q)}</h2><label class="answer-field">Your answer<input data-reading-answer autocomplete="off"></label><div class="button-row"><button class="primary" data-reading-check>Check answer</button><button class="secondary" data-reading-giveup>I don't know</button></div></article>`, { dismissible: false });
      const finish = answer => {
        const ok = checkPassageAnswer(item, answer);
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
    const item = game.levelPackage.balance.items['rice-ball'];
    overlay.open(`<div class="panel"><p class="panel-kicker">Scholar Village Shop</p><h1>Supplies</h1><div class="shop-item"><div class="item-icon">🍙</div><div><h2>${escapeHtml(item.name)}</h2><p>Restores ${item.heal} HP during battle.</p><b>${item.price} coins · You own ${game.state.progress.inventory['rice-ball'] || 0}</b></div><button class="primary" data-buy-rice>Buy</button></div><div class="button-row"><button class="secondary" data-close-overlay>Leave Shop</button></div></div>`);
    document.querySelector('[data-buy-rice]').addEventListener('click', () => {
      const bought = buyItem(game.state.player, game.state.progress.inventory, 'rice-ball', item);
      if (!bought.ok) return toast(bought.reason);
      game.state.player = bought.player;
      game.state.progress.inventory = bought.inventory;
      commit();
      toast(`${item.name} added to your bag.`);
      shop();
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
    overlay.open(`<div class="panel parent-panel"><div class="panel-header"><div><p class="panel-kicker">Parent Panel</p><h1>Learning summary</h1></div><button class="secondary" data-close-overlay>Lock</button></div><div class="status-grid"><div>Collected spirits<b>${progressWords.filter(value => value.collected || value.c).length}</b></div><div>Gold spirits<b>${progressWords.filter(value => tierOf(value) === 'gold').length}</b></div><div>Battles today<b>${energy.day === localDay() ? energy.used : 0}/${game.state.settings.dailyBattles || '∞'}</b></div><div>Time played<b>${Math.round(game.state.session.playMs / 60000)} min</b></div></div><label class="answer-field">Daily creature battles<select data-daily-cap>${[10,15,20,30,0].map(value => `<option value="${value}" ${game.state.settings.dailyBattles === value ? 'selected' : ''}>${value || 'No limit'}</option>`).join('')}</select></label><h2>Written Reading Hall answers</h2>${written.length ? written.slice(0, 10).map(entry => `<article class="written-review"><b>${escapeHtml(entry.day)} · ${escapeHtml(entry.title)} · ${escapeHtml(entry.rating)}</b><p>${escapeHtml(entry.question)}</p><small>Child: ${escapeHtml(entry.answer || '(No answer)')}</small><small>Model: ${escapeHtml(entry.model)}</small></article>`).join('') : '<p>No written answers yet.</p>'}</div>`);
    document.querySelector('[data-daily-cap]').addEventListener('change', event => { game.state.settings.dailyBattles = Number(event.target.value); commit(); });
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

  return { handleInteraction, startBattle, school, readingHall, inn, shop, spiritBook, parentPanel, battlesLeft: () => battlesLeft(active().state.progress.energy, localDay(), active().state.settings.dailyBattles) };
}

