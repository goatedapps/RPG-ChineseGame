import { loadLevelPackage } from './content/loader.js';
import { localDay } from './core/time.js';
import { createSpeechController } from './learning/audio.js';
import { filterSupportedQuestions, EXAM_INSTRUCTIONS } from './learning/examAdapters.js';
import { normalizeWordProgress, recordAnswer, SKILLS, SKILL_TICKS_REQUIRED, starsOf, tierOf } from './learning/mastery.js?p10f';
import { checkAnswer, makeExamQuestion, makeQuestion } from './learning/questions.js';
import { AUTO_COMPLETE_AFTER_MISSES, recordCharacter, WRITING_STAGES, writingResult } from './learning/writing.js';
import { $, escapeHtml } from './ui/dom.js';

const elements = {
  level: $('#lab-level'), lesson: $('#lab-lesson'), search: $('#lab-word-search'), word: $('#lab-word'),
  task: $('#lab-task'), run: $('#lab-run'), summary: $('#lab-summary'), workspace: $('#lab-workspace')
};
const speech = createSpeechController();
const wordProgress = new Map();
const characterProgress = new Map();
let levelPackage = null;
let supportedExam = [];
let visibleWords = [];
let writer = null;
let writingRun = 0;

function stopActivity() {
  speech.stop();
  try { writer?.cancelQuiz(); } catch {}
  writer = null;
}

function currentWord() {
  return levelPackage?.content.words.find(word => word.id === elements.word.value) || visibleWords[0];
}

function lessonWords() {
  const lesson = Number(elements.lesson.value);
  const query = elements.search.value.trim().toLocaleLowerCase();
  return levelPackage.content.words.filter(word => word.lesson === lesson && (
    !query || `${word.w} ${word.p} ${word.m}`.toLocaleLowerCase().includes(query)
  ));
}

function renderWordOptions(preferredId) {
  visibleWords = lessonWords();
  elements.word.innerHTML = visibleWords.map(word => `<option value="${escapeHtml(word.id)}">${escapeHtml(word.w)} · ${escapeHtml(word.p)} · ${escapeHtml(word.m)}</option>`).join('');
  if (preferredId && visibleWords.some(word => word.id === preferredId)) elements.word.value = preferredId;
  elements.run.disabled = !visibleWords.length;
  renderSummary();
}

function examTasksForWord(word) {
  return supportedExam.filter(question => (
    question.word === word.w || question.lessons.length === 0 || question.lessons.includes(word.lesson)
  ));
}

function renderTasks() {
  const word = currentWord();
  const kinds = [...new Set(examTasksForWord(word).map(question => question.kind))];
  elements.task.innerHTML = `<optgroup label="Word skills">
    <option value="skill:m">Meaning</option><option value="skill:p">Pinyin</option>
    <option value="skill:h">Hanzi recognition</option><option value="skill:u">Usage</option>
    <option value="writing">Writing</option>
  </optgroup>${kinds.length ? `<optgroup label="Real exam questions">${kinds.map(kind => `<option value="exam:${escapeHtml(kind)}">${escapeHtml(EXAM_INSTRUCTIONS[kind] || kind)}</option>`).join('')}</optgroup>` : ''}`;
}

function renderSummary() {
  const word = currentWord();
  if (!word) {
    elements.summary.innerHTML = '<div><b>No matching words</b>Clear the search to continue.</div>';
    return;
  }
  const progress = normalizeWordProgress(wordProgress.get(word.w));
  elements.summary.innerHTML = `
    <div>Curriculum<b>${escapeHtml(levelPackage.label)}</b></div>
    <div>Selected word<b>${escapeHtml(word.w)} · ${escapeHtml(word.p)}</b></div>
    <div>Lesson<b>${word.lesson}</b></div>
    <div>Mastery preview<b>${tierOf(progress) || 'Not collected'} · ${starsOf(progress)}/5 stars</b></div>
    <div>Exam pool<b>${examTasksForWord(word).length} supported MCQs</b></div>`;
}

function hearButton(text) {
  const button = $('[data-hear]', elements.workspace);
  button?.addEventListener('click', () => {
    if (speech.isSpeaking) {
      speech.stop();
      button.textContent = 'Hear it';
      button.setAttribute('aria-pressed', 'false');
      return;
    }
    const started = speech.speak(text, { onEnd: () => {
      button.textContent = 'Hear it';
      button.setAttribute('aria-pressed', 'false');
    } });
    if (started) {
      button.textContent = 'Stop';
      button.setAttribute('aria-pressed', 'true');
    } else button.textContent = 'Audio unavailable';
  });
}

function masteryMarkup(word) {
  const progress = normalizeWordProgress(wordProgress.get(word.w));
  return `<div class="lab-stars">${Object.entries(SKILLS).map(([key, skill]) => `<span>${skill.name} <b>${progress.ticks[key] >= SKILL_TICKS_REQUIRED ? '●' : '○'}</b></span>`).join('')}</div>`;
}

function renderQuestion(question, word, skill = null) {
  stopActivity();
  elements.workspace.innerHTML = `<article class="lab-task-card">
    <div class="lab-word-line"><strong>${escapeHtml(word.w)}</strong><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span><button class="secondary" data-hear type="button" aria-pressed="false">Hear it</button></div>
    <p class="lab-question">${escapeHtml(question.prompt)}</p>
    <p class="lab-instruction">${escapeHtml(question.instruction)}${question.source === 'exam' ? ' · Real exam question' : ''}</p>
    <div class="lab-options">${question.options.map((option, index) => `<button class="lab-option" data-answer="${index}" type="button">${escapeHtml(option)}</button>`).join('')}</div>
    <div id="lab-feedback"></div>
  </article>`;
  hearButton(word.w);
  const buttons = [...elements.workspace.querySelectorAll('[data-answer]')];
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    const result = checkAnswer(question, question.options[index]);
    buttons.forEach((candidate, candidateIndex) => {
      candidate.disabled = true;
      if (question.options[candidateIndex] === question.correct) candidate.classList.add('is-correct');
    });
    if (!result.ok) button.classList.add('is-wrong');
    if (skill) {
      const recorded = recordAnswer(wordProgress.get(word.w), { skill, correct: result.ok, day: localDay() });
      wordProgress.set(word.w, { ...recorded.progress, collected: true });
    }
    $('#lab-feedback').innerHTML = `<div class="lab-feedback ${result.ok ? '' : 'bad'}">
      <p><b>${result.ok ? 'Correct!' : `Not quite. The answer is ${escapeHtml(result.answer)}.`}</b></p>
      <p>${escapeHtml(word.w)} · ${escapeHtml(word.p)} · ${escapeHtml(word.m)}</p>
      <p>Example: ${escapeHtml(word.ex)}</p>
      ${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ''}
      ${masteryMarkup(word)}
      <div class="lab-writing-actions"><button class="primary" data-another type="button">Try another</button></div>
    </div>`;
    $('[data-another]').addEventListener('click', runTask, { once: true });
    renderSummary();
    if (!result.ok) speech.speak(word.w);
  }, { once: true }));
}

function runExam(word, kind) {
  const pool = examTasksForWord(word).filter(question => question.kind === kind);
  if (!pool.length) {
    elements.workspace.innerHTML = '<div class="lab-loading"><h2>No matching question</h2><p>This question type is not enabled or has no suitable item for the selected lesson.</p></div>';
    return;
  }
  const source = pool[Math.floor(Math.random() * pool.length)];
  renderQuestion(makeExamQuestion(source), word);
}

function writingFeedback(word, result) {
  elements.workspace.innerHTML = `<article class="lab-task-card"><div class="lab-feedback ${result.ok ? '' : 'bad'}">
    <p><b>${result.ok ? 'Well done! You wrote it all by yourself.' : result.gaveUp ? 'That is OK. Study the strokes and try again soon.' : 'Nearly! You needed some help this time.'}</b></p>
    <div class="lab-word-line"><strong>${escapeHtml(word.w)}</strong><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span><button class="secondary" data-hear type="button">Hear it</button></div>
    ${masteryMarkup(word)}
    <div class="lab-writing-actions"><button class="primary" data-another type="button">Write again</button></div>
  </div></article>`;
  hearButton(word.w);
  $('[data-another]').addEventListener('click', () => renderWriting(word), { once: true });
  renderSummary();
}

function renderWriting(word, requestedStage = null) {
  stopActivity();
  const characters = [...word.w].filter(character => /\p{Script=Han}/u.test(character));
  let characterIndex = 0;
  let usedDemonstration = false;
  let autoCompleted = false;
  let gaveUp = false;
  const runId = `${Date.now()}-${++writingRun}`;
  const initialStage = requestedStage ?? Math.min(...characters.map(character => Number(characterProgress.get(character)?.stage) || 0));

  const drawCharacter = stageId => {
    const character = characters[characterIndex];
    const stage = WRITING_STAGES[stageId];
    let characterDemonstration = false;
    let characterAutoCompleted = false;
    elements.workspace.innerHTML = `<article class="lab-task-card">
      <div class="lab-word-line"><strong>${escapeHtml(word.w)}</strong><span>${escapeHtml(word.p)} · ${escapeHtml(word.m)}</span><button class="secondary" data-hear type="button">Hear it</button></div>
      <p class="lab-instruction">Clue: ${escapeHtml(word.ex).replace(escapeHtml(word.w), '＿'.repeat(characters.length))}</p>
      <div class="lab-writing">
        <div class="lab-hanzi-box" id="lab-hanzi"></div>
        <div class="lab-writing-side">
          <h2>${stage.name} · character ${characterIndex + 1} of ${characters.length}</h2>
          <p>${stage.id === 0 ? 'Trace the grey outline one stroke at a time.' : stage.id === 1 ? 'Write it yourself. Hints appear if you get stuck.' : 'Write it from memory. You can ask for a demonstration.'}</p>
          <div class="lab-slots">${characters.map((item, index) => `<span class="${index === characterIndex ? 'current' : ''}">${index < characterIndex ? escapeHtml(item) : index === characterIndex ? '✎' : ''}</span>`).join('')}</div>
          <p class="lab-instruction">Preview a stage:</p>
          <div class="lab-stage-picker">${WRITING_STAGES.map(candidate => `<button class="${candidate.id === stage.id ? 'active' : ''}" data-stage="${candidate.id}" type="button">${candidate.name}</button>`).join('')}</div>
          <div class="lab-writing-actions"><button class="secondary" data-show type="button">Show me how</button><button class="secondary" data-skip type="button">I don't know</button></div>
        </div>
      </div>
    </article>`;
    hearButton(word.w);
    for (const button of elements.workspace.querySelectorAll('[data-stage]')) {
      button.addEventListener('click', () => renderWriting(word, Number(button.dataset.stage)), { once: true });
    }
    const box = $('#lab-hanzi');
    const size = Math.max(220, Math.round(box.getBoundingClientRect().width) || 300);
    writer = window.HanziWriter.create(box, character, {
      width: size, height: size, padding: 12, showCharacter: false, showOutline: stage.outline,
      strokeColor: '#1b2430', outlineColor: '#d5cbb6', drawingColor: '#2f6f8f', drawingWidth: 7,
      highlightColor: '#2f8a66', strokeAnimationSpeed: 1.6, delayBetweenStrokes: 180,
      charDataLoader: (requested, done, fail) => levelPackage.characters.characters[requested] ? done(levelPackage.characters.characters[requested]) : fail?.(`Missing ${requested}`)
    });
    const startQuiz = () => writer.quiz({
      showHintAfterMisses: stage.hintAfterMisses,
      markStrokeCorrectAfterMisses: AUTO_COMPLETE_AFTER_MISSES,
      leniency: 1.4,
      acceptBackwardsStrokes: true,
      highlightOnComplete: true,
      onCorrectStroke: data => {
        if (data.mistakesOnStroke >= AUTO_COMPLETE_AFTER_MISSES) {
          characterAutoCompleted = true;
          autoCompleted = true;
        }
      },
      onComplete: () => {
        const helped = characterDemonstration || characterAutoCompleted;
        characterProgress.set(character, recordCharacter(characterProgress.get(character), { helped, runId }));
        window.setTimeout(() => {
          characterIndex += 1;
          if (characterIndex < characters.length) drawCharacter(stageId);
          else {
            const result = writingResult({ gaveUp, usedDemonstration, autoCompleted, allFromMemory: stage.id === 2 });
            if (result.earnsTick) {
              const recorded = recordAnswer(wordProgress.get(word.w), { skill: 'w', correct: true, day: localDay() });
              wordProgress.set(word.w, { ...recorded.progress, collected: true });
            }
            writingFeedback(word, { ...result, gaveUp });
          }
        }, 500);
      }
    });
    $('[data-show]').addEventListener('click', () => {
      characterDemonstration = true;
      usedDemonstration = true;
      writer.cancelQuiz();
      writer.animateCharacter({ onComplete: startQuiz });
    });
    $('[data-skip]').addEventListener('click', () => {
      gaveUp = true;
      characters.slice(characterIndex).forEach(item => characterProgress.set(item, recordCharacter(characterProgress.get(item), { helped: true, runId })));
      writer.cancelQuiz();
      writer.showCharacter();
      window.setTimeout(() => writingFeedback(word, { ...writingResult({ gaveUp: true }), gaveUp: true }), 450);
    }, { once: true });
    startQuiz();
  };
  drawCharacter(initialStage);
}

function runTask() {
  const word = currentWord();
  if (!word) return;
  const [type, value] = elements.task.value.split(':');
  if (type === 'skill') renderQuestion(makeQuestion(word, value, levelPackage.content.words), word, value);
  else if (type === 'exam') runExam(word, value);
  else renderWriting(word);
}

async function loadLevel() {
  stopActivity();
  elements.workspace.innerHTML = '<div class="lab-loading"><h2>Loading curriculum…</h2></div>';
  try {
    levelPackage = await loadLevelPackage(elements.level.value);
    supportedExam = filterSupportedQuestions(levelPackage.content, levelPackage.config);
    elements.lesson.innerHTML = levelPackage.content.lessons.map(lesson => `<option value="${lesson.id}">${escapeHtml(lesson.title)}</option>`).join('');
    elements.lesson.value = '1';
    elements.search.value = '';
    renderWordOptions();
    renderTasks();
    runTask();
  } catch (error) {
    console.error(error);
    elements.workspace.innerHTML = `<div class="lab-loading"><h2>The content lab could not load</h2><p>${escapeHtml(error.message)}</p></div>`;
  }
}

elements.level.addEventListener('change', loadLevel);
elements.lesson.addEventListener('change', () => { renderWordOptions(); renderTasks(); runTask(); });
elements.search.addEventListener('input', () => { const selected = elements.word.value; renderWordOptions(selected); renderTasks(); });
elements.word.addEventListener('change', () => { renderTasks(); renderSummary(); runTask(); });
elements.task.addEventListener('change', runTask);
elements.run.addEventListener('click', runTask);
window.addEventListener('beforeunload', stopActivity);
window.__WSQ_LEARNING_LAB__ = { get levelPackage() { return levelPackage; }, runTask, wordProgress, characterProgress };
loadLevel();
