import { tierOf } from './learning/mastery.js?p10f';

const lessons = {
  1: ['Explore the village', 'Take a few steps through Scholar Village. Apprentice Jun will come to meet you.', 'Walk five steps through the village.'],
  2: ['Find the Shop', 'Look at Next step whenever you feel lost. The little map shows where you are and where to go. Follow its pin to the Shop. Grandma left you 10 coins for a Rice Ball.', 'Use Next step and the map; buy a Rice Ball.'],
  3: ['Meet your neighbours', 'People in town know what the fog has changed. Walk around and talk to two villagers.', 'Talk to two different villagers.'],
  4: ['Visit School', 'School practice earns XP. XP raises your level and makes you stronger. Coins buy supplies. Let’s try an Exam quiz.', 'Complete an Exam quiz at School.'],
  5: ['Free a Word Spirit', 'Explore Mistwood Road and fight a creature. You can choose an attack even when its Spirit Book circle is empty; a correct answer fills that skill. When you lose HP, open your battle Bag and use the Rice Ball.', 'Win a battle and free a Word Spirit.'],
  6: ['Open the Spirit Book', 'Tap the arrow on the left to expand the Atlas menu. Open Spirit Book and tap the glowing card for the word you just freed. Its filled circle came from your battle attack.', 'Expand the menu and tap your new Spirit’s card.'],
  7: ['See how Spirits grow', 'You reached level 3! Welcome back. Open your Spirit Book and look at how many Bronze, Silver, and Gold Spirits you have. Then I’ll explain how they grow.', 'Open Spirit Book to see your Bronze, Silver, and Gold counts.'],
  8: ['Choose a creature companion', 'Creatures you defeat join your collection. Open Creatures in the left menu, read an ability and choose one partner. Defeating a stronger one upgrades its ability.', 'Open Creatures and choose one travelling partner.'],
  9: ['See a Restoration Set', 'Open the Restoration Board in My Room. I’ll show you what the first set needs and the decoration it can earn.', 'Open the Restoration Board.'],
  10: ['Find your Adventure', 'Adventure remembers the story and the villagers’ requests. Open it to see who needs help.', 'Open Adventure from the left menu.'],
  11: ['Check today’s goals', 'The Daily Board shows three small goals. Finish all three to open a Daily Chest with rewards. There is no timer.', 'Open the Daily Board.'],
  12: ['Look in your Bag', 'Your Bag holds supplies, bait, and important items. Open it and find the Supplies section.', 'Open your Bag.'],
  13: ['Check your Hero', 'Hero Status shows your level, HP, and equipment. Open it, then I’ll point out the Craft Table where materials and coins become new gear.', 'Open Hero Status, then the Craft Table.'],
  14: ['Try Dictation', 'Dictation Practice helps you write from memory. Later, a dictation test helps open the next region. Try one word; Show me how is there if you need help.', 'Open Dictation Practice and try a word.'],
  15: ['Prepare for the road', 'Return to the Shop for Forest Repellent and exact-word Spirit Bait. On a foggy route, open Bag and tap Use on Repellent to stop encounters for a while. Bait works automatically on the next encounter in its lesson area.', 'Buy Forest Repellent and Spirit Bait.']
};

function itemTarget(map, id) {
  const object = map.objects.find(candidate => candidate.id === id);
  return object ? { x: object.door?.x ?? object.x, y: object.door?.y ?? object.y } : null;
}

const transitions = {
  2: ['Good, you bought a Rice Ball. It can restore your HP during battle.', 'Now talk to two different villagers. They can tell you what the fog has changed.'],
  3: ['You heard two neighbours. Their stories help you understand who needs help.', 'Let’s go to School. An Exam quiz earns XP, and XP makes you stronger.'],
  4: ['Well done on your quiz! You earned XP toward your next level.', 'Now take the north gate to Mistwood Road and free a Word Spirit. I’ll guide your first battle.'],
  5: ['Good work defeating your first battle! The Word Spirit is free.', 'You are back in the village. Tap the arrow on the left to open the Atlas menu.', 'Now open Spirit Book and tap the glowing card for the Spirit you just freed.'],
  6: ['There it is! The filled circle came from the attack you chose in battle.', 'You’re ready to explore. Follow Next step, talk to people, and collect more Word Spirits. I’ll tell you more when you reach level 3.'],
  7: ['Now you know how Bronze, Silver, and Gold Spirits grow. You also have a separate collection of the creatures you meet.', 'Open Creatures in the left menu to choose a companion and read its battle ability.'],
  8: ['Your creature companion can now travel beside you. Use its ability once per battle, including boss battles.', 'Look at the Restoration Board in your room. Sets of Silver Spirits earn room decorations.'],
  9: ['You know what that set needs. You can finish collecting it later.', 'Open Adventure from the left menu to see the story and villagers’ requests.'],
  10: ['Adventure helps you remember who needs help.', 'Now open Daily Board. Finishing all three goals gives you a Daily Chest with rewards.'],
  11: ['Those daily goals are optional, with no timer.', 'Open Bag to see the supplies and items you carry.'],
  12: ['Your supplies are safe in Bag. You can use some of them on the road.', 'Open Hero Status to see your level and HP, then look at the Craft Table.'],
  13: ['The Craft Table turns materials and coins into gear. You do not need to make anything yet.', 'Open Dictation Practice and try one word from memory.'],
  14: ['Good practice! Dictation will help you open the road to the next region later.', 'Return to the Shop. Buy Forest Repellent and one exact-word Spirit Bait.'],
  15: ['You’re prepared for the road! On a foggy route, open Bag and tap Use on Forest Repellent.', 'Spirit Bait works automatically at the next encounter in its lesson area.', 'You should know most of the features now. Follow Next step whenever you need a reminder.', 'I’m glad we explored together. Goodbye, and I wish you all the best on your adventure!']
};

export function createTutorial({ getActive, persist, render, overlay }) {
  let lastActionAt = Date.now();
  let reminder = false;
  let dialogueBusy = false;
  let introTimer = null;
  let arrowTarget = null;
  let positionedTarget = null;
  let originalPosition = '';
  let destroyed = false;
  const pointer = document.createElement('span');
  pointer.className = 'tutorial-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.hidden = true;
  document.body.appendChild(pointer);

  function clearPointer() {
    arrowTarget?.classList.remove('tutorial-pointer-host');
    if (positionedTarget) positionedTarget.style.position = originalPosition;
    positionedTarget = null;
    arrowTarget = null;
    pointer.remove();
    pointer.hidden = true;
    pointer.classList.remove('attached', 'points-left');
    pointer.style.left = '';
    pointer.style.top = '';
  }

  function positionPointer() {
    if (pointer.classList.contains('attached')) return;
    if (!arrowTarget?.isConnected) { pointer.hidden = true; return; }
    const bounds = arrowTarget.getBoundingClientRect();
    const viewport = document.defaultView;
    if (bounds.bottom < 0 || bounds.top > viewport.innerHeight || bounds.right < 0 || bounds.left > viewport.innerWidth) { pointer.hidden = true; return; }
    const menu = arrowTarget.closest('#game-menus');
    if (menu) {
      const menuBounds = menu.getBoundingClientRect();
      if (bounds.bottom < menuBounds.top || bounds.top > menuBounds.bottom) { pointer.hidden = true; return; }
    }
    const rightSide = Boolean(menu) || bounds.left < 54;
    pointer.classList.toggle('points-left', rightSide);
    pointer.style.left = `${viewport.scrollX + Math.max(6, Math.min(viewport.innerWidth - 48, rightSide ? bounds.right + 10 : bounds.left - 52))}px`;
    pointer.style.top = `${viewport.scrollY + Math.max(6, Math.min(viewport.innerHeight - 42, bounds.top + bounds.height / 2 - 18))}px`;
    pointer.hidden = false;
  }

  document.defaultView.addEventListener('resize', positionPointer);
  document.addEventListener('scroll', positionPointer, true);

  const state = () => getActive()?.state.progress.tutorial;
  const current = () => {
    const game = getActive();
    const step = state()?.step || 16;
    return step === 7 && game?.state.player.level < 3 ? null : step < 16 ? step : null;
  };

  function objective() {
    const step = current();
    const game = getActive();
    if (!step || !game) return null;
    const map = game.levelPackage.map;
    const tutorial = state();
    if (tutorial.awaitingPanelClose === step) {
      const names = { 10: 'Adventure Journal', 11: 'Daily Board', 12: 'Bag', 13: 'Craft Table' };
      return { text: `Close ${names[step]} to continue with Jun.`, target: null };
    }
    if (step === 1) return { text: (tutorial.walkSteps || 0) < 5 ? `Walk around the village: ${tutorial.walkSteps || 0}/5 steps.` : 'Listen to Apprentice Jun.', target: null };
    if (step === 3 && tutorial.villagers.length) return { text: `${tutorial.villagers.length}/2 villagers heard. Talk to one more villager.`, target: null };
    if (step === 5 && !game.state.progress.inventory['rice-ball']) return { text: 'Buy another Rice Ball at the Shop before your practice battle.', target: map.route ? itemTarget(map, 'return-village') : itemTarget(map, 'shop-door') };
    if (step === 5 && !map.route) return { text: 'Go around the sign on the north path and enter Mistwood Road for a battle.', target: itemTarget(map, 'route-entrance') };
    if (step === 6 && tutorial.bookSeen) return { text: 'Tap the glowing card for the Word Spirit you just freed.', target: null };
    if (step === 7 && tutorial.bookSeen) return { text: silverCount(game) ? 'Read Jun’s tier explanation in Spirit Book, then tap I understand tiers.' : 'In Spirit Book, tap Practice an empty skill circle until a Spirit turns Silver.', target: null };
    if (step === 8 && !Object.keys(game.state.progress.creatures?.collection || {}).length) return { text: 'Defeat a creature on the fog route, then open Creatures to choose a companion.', target: map.route ? null : itemTarget(map, 'route-entrance') };
    if (step === 9 && tutorial.boardSeen) return { text: 'Read Jun’s note on the first Restoration Set, then tap I see what this set needs.', target: null };
    if (step === 13 && tutorial.heroSeen) return { text: 'In Hero Status, tap Craft Table to see how materials become gear.', target: null };
    if (step === 15) {
      const remaining = (tutorial.repellentBought ? 0 : 30) + (tutorial.baitBought ? 0 : 10);
      if (game.state.player.coins < remaining) {
        return { text: `Earn ${remaining - game.state.player.coins} more coins in School or battle, then return to the Shop for Repellent and Spirit Bait.`, target: map.route ? null : itemTarget(map, 'school-door') };
      }
      if (tutorial.repellentBought) return { text: 'At the Shop, choose a missing Word Spirit and buy its exact-word bait.', target: map.route ? itemTarget(map, 'return-village') : itemTarget(map, 'shop-door') };
      if (tutorial.baitBought) return { text: 'At the Shop, buy Forest Repellent for 30 coins.', target: map.route ? itemTarget(map, 'return-village') : itemTarget(map, 'shop-door') };
    }
    const targets = { 2: 'shop-door', 4: 'school-door', 5: 'route-entrance', 15: 'shop-door' };
    let target = itemTarget(map, targets[step]);
    if (map.route && step === 5) {
      const zone = map.zones.find(candidate => candidate.lesson === game.levelPackage.config.regionLessons.r1?.[0]) || map.zones[0];
      if (zone) target = { x: zone.rect.x + Math.floor(zone.rect.width / 2), y: zone.rect.y + Math.floor(zone.rect.height / 2) };
    }
    if (map.route && step === 15) target = itemTarget(map, 'return-village');
    return { text: lessons[step][2], target };
  }

  function saveAndShow() {
    lastActionAt = Date.now();
    reminder = false;
    persist();
    render();
  }

  function advance() {
    const tutorial = state();
    const completed = tutorial.step;
    tutorial.step += 1;
    if (tutorial.step === 7) tutorial.bookSeen = false;
    tutorial.pending = completed;
    saveAndShow();
  }

  function action(type, detail = {}) {
    const tutorial = state();
    const step = current();
    if (!step || !tutorial) return;
    lastActionAt = Date.now();
    if (step === 1 && type === 'moved' && (tutorial.walkSteps || 0) < 5) {
      tutorial.walkSteps = (tutorial.walkSteps || 0) + 1;
      if (tutorial.walkSteps === 5) tutorial.introStage = 'welcome';
      return saveAndShow();
    }
    if (step === 2 && type === 'buy-item' && detail.id === 'rice-ball') return advance();
    if (step === 3 && type === 'interact' && detail.id && detail.kind === 'npc' && detail.id !== 'apprentice-jun') {
      if (!tutorial.villagers.includes(detail.id)) tutorial.villagers.push(detail.id);
      return tutorial.villagers.length >= 2 ? advance() : saveAndShow();
    }
    if (step === 4 && type === 'school-quiz') return advance();
    if (step === 5 && type === 'battle-win' && detail.collected) { tutorial.firstWord = detail.word; return advance(); }
    if (step === 6 && type === 'open-book') {
      tutorial.firstWord ||= getActive().levelPackage.content.words.find(word => getActive().state.progress.words[word.w]?.collected)?.w || null;
      tutorial.bookSeen = true;
      return saveAndShow();
    }
    if (step === 6 && type === 'open-word-card' && tutorial.bookSeen && detail.word === tutorial.firstWord) return advance();
    if (step === 7 && type === 'open-book') {
      tutorial.bookSeen = true;
      return saveAndShow();
    }
    if (step === 7 && type === 'tier-acknowledged' && tutorial.bookSeen && silverCount(getActive()) > 0) return advance();
    if (step === 7 && type === 'practice-complete' && silverCount(getActive()) > 0) return advance();
    if (step === 8 && type === 'companion-chosen' && getActive().state.progress.creatures?.partner) return advance();
    if (step === 9 && type === 'open-board') { tutorial.boardSeen = true; return saveAndShow(); }
    if (step === 9 && type === 'board-acknowledged' && tutorial.boardSeen) return advance();
    if (step === 10 && type === 'open-journal') { tutorial.awaitingPanelClose = step; return saveAndShow(); }
    if (step === 11 && type === 'open-daily') { tutorial.awaitingPanelClose = step; return saveAndShow(); }
    if (step === 12 && type === 'open-bag') { tutorial.awaitingPanelClose = step; return saveAndShow(); }
    if (step === 13 && type === 'open-hero') { tutorial.heroSeen = true; return saveAndShow(); }
    if (step === 13 && type === 'open-craft' && tutorial.heroSeen) { tutorial.awaitingPanelClose = step; return saveAndShow(); }
    if (step === 14 && type === 'dictation-word') return advance();
    if (step === 15 && type === 'buy-item' && detail.id === 'forest-repellent') tutorial.repellentBought = true;
    if (step === 15 && type === 'buy-bait') tutorial.baitBought = true;
    if (step === 15 && tutorial.repellentBought && tutorial.baitBought) return advance();
    if (step === 15 && (type === 'buy-item' || type === 'buy-bait')) saveAndShow();
  }

  function silverCount(game) {
    return Object.values(game.state.progress.words).filter(progress => ['silver', 'gold'].includes(tierOf(progress))).length;
  }

  function skipByParent() {
    const tutorial = state();
    if (!tutorial || tutorial.step >= 16) return false;
    clearTimeout(introTimer);
    introTimer = null;
    tutorial.step = 16;
    tutorial.skipped = true;
    saveAndShow();
    return true;
  }

  function allowsStoryInteraction(object) {
    const step = current();
    if (!step || object.id === 'return-village' || object.id === 'apprentice-jun') return true;
    if (step === 3 && object.type === 'npc') return true;
    if (step === 5 && (object.id === 'route-entrance' || object.id === 'tree-sign')) return true;
    if (step === 15 && object.id === 'route-entrance') return true;
    return false;
  }

  function show() {
    if (destroyed) return;
    const game = getActive();
    document.querySelectorAll('.tutorial-arrow').forEach(element => element.classList.remove('tutorial-arrow'));
    clearPointer();
    document.body.removeAttribute('data-tutorial-step');
    const tutorial = state();
    if (!game || !tutorial || !game.state.progress.story.flags.arrival || (tutorial.step >= 16 && !tutorial.pending)) {
      return;
    }
    const step = current();
    if (step) document.body.dataset.tutorialStep = String(step);
    if (dialogueBusy && !document.querySelector('#overlay .tutorial-dialog-card')) {
      queueMicrotask(() => {
        if (destroyed || !dialogueBusy || document.querySelector('#overlay .tutorial-dialog-card')) return;
        dialogueBusy = false;
        show();
      });
      return;
    }
    if (dialogueBusy) return;
    if (overlay.isOpen) { markArrow(step, tutorial, true); return; }
    if (step && tutorial.awaitingPanelClose === step) {
      tutorial.awaitingPanelClose = null;
      advance();
      return;
    }
    if (tutorial.pending) {
      const completed = tutorial.pending;
      speak(transitions[completed] || [], () => {
        tutorial.pending = null;
        lastActionAt = Date.now();
        persist();
      });
      return;
    }
    if (step === 1 && (tutorial.walkSteps || 0) >= 5) {
      const stage = tutorial.introStage || 'welcome';
      if (stage === 'welcome') {
        speak(['Welcome to Scholar Village! I’m Apprentice Jun. I’ll show you one thing at a time.', 'First, look at the Next step box. Whenever you are unsure what to do, it tells you where to go.'], () => { tutorial.introStage = 'point-next'; saveAndShow(); });
        return;
      }
      if (stage === 'point-next' || stage === 'point-map') {
        markArrow(step, tutorial, false);
        if (!introTimer) introTimer = setTimeout(() => {
          introTimer = null;
          tutorial.introStage = stage === 'point-next' ? 'map-talk' : 'shop-talk';
          saveAndShow();
        }, 4000);
        return;
      }
      if (stage === 'map-talk') {
        speak(['The map at the top right shows your position as a white dot.', 'Its red pin points toward your Next step. Let’s find it together.'], () => { tutorial.introStage = 'point-map'; saveAndShow(); });
        return;
      }
      if (stage === 'shop-talk') {
        speak(['Now follow the map pin to the Shop.', 'Grandma left you 10 coins to help buy a Rice Ball. A Rice Ball restores HP when you use it in battle.'], () => {
          if (!tutorial.allowanceGiven) { game.state.player.coins += 10; tutorial.allowanceGiven = true; }
          tutorial.introStage = 'done';
          tutorial.step = 2;
          reminder = false;
          saveAndShow();
        });
        return;
      }
    }
    if (step === 7 && !tutorial.partTwoIntroduced) {
      speak(['You reached level 3! Welcome back.', 'Open Spirit Book. Let’s look at how many Bronze, Silver, and Gold Spirits you have, then I’ll show you how they grow.'], () => {
        tutorial.partTwoIntroduced = true;
        persist();
      });
      return;
    }
    if (reminder && step && step > 1) {
      reminder = false;
      speak([`Still working on this? ${objective()?.text || lessons[step][2]}`], () => { lastActionAt = Date.now(); });
      return;
    }
    markArrow(step, tutorial, false);
  }

  function speak(lines, onDone) {
    if (!lines.length) { onDone?.(); return; }
    dialogueBusy = true;
    overlay.tutorialDialogue(lines, () => {
      dialogueBusy = false;
      onDone?.();
      show();
    });
  }

  function markArrow(step, tutorial, inOverlay) {
    let selector = '';
    if (step === 1) selector = tutorial.introStage === 'point-next' ? '.objective' : tutorial.introStage === 'point-map' ? '.guide-map' : '';
    else if (inOverlay && tutorial.awaitingPanelClose === step) selector = '[data-close-overlay]';
    else if (inOverlay) selector = ({ 2: '[data-buy="rice-ball"]', 4: '[data-school-quiz]', 5: '[data-fight], [data-use-item="rice-ball"], [data-bag].tutorial-bag-cue, [data-attack].recommended:not([disabled])', 6: '[data-tutorial-word]', 7: '[data-tutorial-tier-done], [data-guided-spirit-practice]', 8: '[data-room-creatures], [data-choose-creature]', 9: '[data-board-open], [data-tutorial-board-done]', 13: '[data-craft-open]', 15: tutorial.repellentBought ? '[data-bait-word]:not(.collected), [data-bait-lesson]' : '[data-buy="forest-repellent"]' })[step] || '';
    else selector = ({ 2: '.guide-map', 3: '.objective', 4: '.guide-map', 5: '.guide-map', 6: '#book-button', 7: '#book-button', 8: '#creatures-button', 9: '#room-button', 10: '#story-button', 11: '#daily-button', 12: '#bag-button', 13: '#character-button', 14: '#dictation-button', 15: '.guide-map' })[step] || '';
    if (!inOverlay && step >= 6 && step <= 14 && !document.querySelector('.game-shell')?.classList.contains('atlas-menu-expanded')) selector = '.atlas-menu-toggle';
    if (selector) {
      arrowTarget = document.querySelector(selector);
      arrowTarget?.classList.add('tutorial-arrow');
      if (arrowTarget?.closest('#overlay')) {
        arrowTarget.classList.add('tutorial-pointer-host');
        const targetPosition = document.defaultView.getComputedStyle(arrowTarget).position;
        if (!targetPosition || targetPosition === 'static') {
          positionedTarget = arrowTarget;
          originalPosition = arrowTarget.style.position;
          arrowTarget.style.position = 'relative';
        }
        pointer.classList.add('attached');
        pointer.classList.toggle('points-left', arrowTarget.getBoundingClientRect().left < 54);
        arrowTarget.appendChild(pointer);
        pointer.hidden = false;
      } else if (arrowTarget) {
        document.body.appendChild(pointer);
        positionPointer();
        document.defaultView.requestAnimationFrame?.(positionPointer);
      }
    }
  }

  const reminderTimer = setInterval(() => {
    if (!current() || current() === 1 || document.hidden || reminder || Date.now() - lastActionAt < 45000) return;
    reminder = true;
    show();
  }, 5000);

  return { action, objective, show, skipByParent, allowsStoryInteraction, current, destroy: () => { destroyed = true; clearInterval(reminderTimer); clearTimeout(introTimer); document.defaultView.removeEventListener('resize', positionPointer); document.removeEventListener('scroll', positionPointer, true); document.querySelectorAll('.tutorial-arrow').forEach(element => element.classList.remove('tutorial-arrow')); document.body.removeAttribute('data-tutorial-step'); clearPointer(); } };
}
