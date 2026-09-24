import { escapeHtml } from './dom.js';
import { AUTO_COMPLETE_AFTER_MISSES, normalizeCharacterProgress, recordCharacter, WRITING_STAGES, writingResult } from '../learning/writing.js';

export function showWritingTask(overlay, word, characterData, characterProgress, onDone, { runId = String(Date.now()), lenient = true, forceMemory = false } = {}) {
  const characters = [...word.w].filter(character => /\p{Script=Han}/u.test(character));
  let index = 0;
  let anyHelp = false;
  let gaveUp = false;
  const nextProgress = { ...characterProgress };
  const stages = characters.map(character => forceMemory ? 2 : normalizeCharacterProgress(nextProgress[character]).stage);
  const allFromMemory = stages.every(stage => stage === 2);
  let writer = null;

  const finish = () => onDone({ ...writingResult({ gaveUp, usedDemonstration: anyHelp, allFromMemory }), gaveUp }, nextProgress);
  const draw = () => {
    const character = characters[index];
    const stage = WRITING_STAGES[stages[index]];
    const memoryTask = forceMemory || stage.id === 2;
    let helped = false;
    overlay.open(`<article class="panel writing-panel">
      <p class="panel-kicker">Writing · ${escapeHtml(stage.name)}</p>
      ${memoryTask
        ? `<div class="dictation-clue"><b>${escapeHtml(word.m)}</b><span>${escapeHtml(word.p)}</span></div>`
        : `<div class="question-word"><b>${escapeHtml(word.w)}</b><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span></div>`}
      <p>Clue: ${escapeHtml(word.ex).replace(escapeHtml(word.w), '＿'.repeat(characters.length))}</p>
      <div class="writing-layout"><div class="writing-box" data-writing-box></div><div>
        <h2>Character ${index + 1} of ${characters.length}</h2>
        <p>${stage.id === 0 ? 'Trace the outline one stroke at a time.' : stage.id === 1 ? 'Write it yourself. A hint appears if you get stuck.' : 'Write it from memory.'}</p>
        <div class="writing-slots">${characters.map((item, itemIndex) => `<span class="${itemIndex === index ? 'current' : ''}">${memoryTask ? (itemIndex === index ? '✎' : '') : itemIndex < index ? escapeHtml(item) : itemIndex === index ? '✎' : ''}</span>`).join('')}</div>
        <div class="button-row"><button class="secondary" data-writing-show type="button">Show me how</button><button class="secondary" data-writing-skip type="button">I don't know</button></div>
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
      writer.animateCharacter({ onComplete: quiz });
    });
    document.querySelector('[data-writing-skip]').addEventListener('click', event => {
      event.currentTarget.disabled = true;
      gaveUp = true;
      anyHelp = true;
      writer.cancelQuiz();
      characters.slice(index).forEach(item => { nextProgress[item] = recordCharacter(nextProgress[item], { helped: true, runId }); });
      writer.showCharacter();
      window.setTimeout(finish, 400);
    }, { once: true });
    quiz();
  };
  draw();
}
