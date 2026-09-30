import { escapeHtml } from './dom.js';
import { AUTO_COMPLETE_AFTER_MISSES, normalizeCharacterProgress, recordCharacter, WRITING_STAGES, writingResult } from '../learning/writing.js';
import { createSpeechController } from '../learning/audio.js';

export function showWritingTask(overlay, word, characterData, characterProgress, onDone, { runId = String(Date.now()), lenient = true, forceMemory = false, completeOnHelp = false, headerHtml = '', onExit = null, speechRate = 0.85, speech = createSpeechController() } = {}) {
  const characters = [...word.w].filter(character => /\p{Script=Han}/u.test(character));
  let index = 0;
  let anyHelp = false;
  const nextProgress = { ...characterProgress };
  const stages = characters.map(character => forceMemory ? 2 : normalizeCharacterProgress(nextProgress[character]).stage);
  const allFromMemory = stages.every(stage => stage === 2);
  let writer = null;

  const dictate = () => speech.speak(word.w, { rate: speechRate });
  const finish = () => { speech.stop(); onDone({ ...writingResult({ gaveUp: false, usedDemonstration: anyHelp, allFromMemory }), gaveUp: false }, nextProgress); };
  const draw = () => {
    const character = characters[index];
    const stage = WRITING_STAGES[stages[index]];
    const memoryTask = forceMemory || stage.id === 2;
    const blank = '＿'.repeat(characters.length);
    const example = String(word.ex || 'Example sentence unavailable.').split(word.w).join(blank);
    let helped = false;
    overlay.open(`<article class="panel writing-panel${headerHtml.includes('battle-question-badge') ? ' battle-question' : ''}${headerHtml.includes('boss-battle-arena') ? ' boss-question' : ''}">
      ${headerHtml}
      <p class="panel-kicker">Writing · ${escapeHtml(stage.name)}</p>
      ${memoryTask ? '' : `<div class="question-word"><b>${escapeHtml(word.w)}</b></div>`}
      <div class="dictation-clue"><p><small>Meaning</small><b>${escapeHtml(word.m)}</b></p><p><small>Hanyu Pinyin</small><span>${escapeHtml(word.p)}</span></p><p><small>Example sentence</small><span>${escapeHtml(memoryTask ? example : word.ex || 'Example sentence unavailable.')}</span></p><button class="dictation-speak" type="button" data-dictate-word aria-label="Hear the word again" title="Hear the word again">🔊 <span>Hear word</span></button></div>
      <div class="writing-layout"><div class="writing-box" data-writing-box></div><div>
        <h2>Character ${index + 1} of ${characters.length}</h2>
        <p>${stage.id === 0 ? 'Trace the outline one stroke at a time.' : stage.id === 1 ? 'Write it yourself. A hint appears if you get stuck.' : 'Write it from memory.'}</p>
        <div class="writing-slots">${characters.map((item, itemIndex) => `<span class="${itemIndex === index ? 'current' : ''}">${itemIndex < index ? escapeHtml(item) : itemIndex === index ? '✎' : ''}</span>`).join('')}</div>
        <div class="button-row"><button class="secondary" data-writing-show type="button">Show me how</button>${onExit ? '<button class="secondary" data-writing-exit type="button">Leave dictation</button>' : ''}</div>
      </div></div>
    </article>`, { dismissible: false });
    const box = document.querySelector('[data-writing-box]');
    const size = Math.max(190, Math.round(box.getBoundingClientRect().width) || 260);
    writer = window.HanziWriter.create(box, character, {
      width: size, height: size, padding: 10, showCharacter: false, showOutline: stage.outline,
      strokeColor: '#1b2430', outlineColor: '#d5cbb6', drawingColor: '#2f6f8f', drawingWidth: 7,
      highlightColor: '#2f8a66', strokeAnimationSpeed: 1.6, delayBetweenStrokes: 150,
      leniency: lenient ? 1.4 : 1,
      charDataLoader: (requested, done, fail) => characterData[requested] ? done(characterData[requested]) : fail?.(`Missing ${requested}`)
    });
    const quiz = () => writer.quiz({
      showHintAfterMisses: stage.hintAfterMisses,
      markStrokeCorrectAfterMisses: AUTO_COMPLETE_AFTER_MISSES,
      leniency: lenient ? 1.4 : 1,
      acceptBackwardsStrokes: lenient,
      highlightOnComplete: true,
      onCorrectStroke: data => { if (data.mistakesOnStroke >= AUTO_COMPLETE_AFTER_MISSES) helped = true; },
      onComplete: () => {
        anyHelp ||= helped;
        nextProgress[character] = recordCharacter(nextProgress[character], { helped, runId });
        window.setTimeout(() => { index += 1; index < characters.length ? draw() : finish(); }, 400);
      }
    });
    document.querySelector('[data-writing-show]').addEventListener('click', () => {
      helped = true;
      writer.cancelQuiz();
      if (completeOnHelp) {
        document.querySelector('[data-writing-show]').disabled = true;
        const exit = document.querySelector('[data-writing-exit]');
        if (exit) exit.disabled = true;
      }
      writer.animateCharacter({ onComplete: completeOnHelp ? () => {
        anyHelp = true;
        nextProgress[character] = recordCharacter(nextProgress[character], { helped: true, runId });
        window.setTimeout(() => { index += 1; index < characters.length ? draw() : finish(); }, 400);
      } : quiz });
    });
    document.querySelector('[data-writing-exit]')?.addEventListener('click', () => {
      speech.stop();
      writer.cancelQuiz();
      onExit();
    }, { once: true });
    document.querySelector('[data-dictate-word]').addEventListener('click', dictate);
    if (index === 0) dictate();
    quiz();
  };
  draw();
}
