import { escapeHtml } from './dom.js';
import { checkAnswer } from '../learning/questions.js';

export function showQuestion(overlay, question, word, onDone, { title = 'Learning challenge', revealWord = word, headerHtml = '', onAnswer = () => {} } = {}) {
  overlay.open(`<article class="panel question-panel">
    ${headerHtml}
    <p class="panel-kicker">${escapeHtml(title)}</p>
    <h2>${escapeHtml(question.prompt)}</h2>
    <p class="question-instruction">${escapeHtml(question.instruction)}</p>
    <div class="question-options">${question.options.map((option, index) => `<button type="button" data-answer="${index}">${escapeHtml(option)}</button>`).join('')}</div>
    <div data-feedback></div>
  </article>`, { dismissible: false });
  const buttons = [...document.querySelectorAll('[data-answer]')];
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    const result = checkAnswer(question, question.options[index]);
    buttons.forEach((candidate, candidateIndex) => {
      candidate.disabled = true;
      if (question.options[candidateIndex] === question.correct) candidate.classList.add('right');
    });
    if (!result.ok) button.classList.add('wrong');
    document.querySelector('[data-feedback]').innerHTML = `<div class="answer-feedback ${result.ok ? 'good' : 'bad'}">
      <b>${result.ok ? 'Correct!' : `Not quite. The answer is ${escapeHtml(result.answer)}.`}</b>
      ${revealWord ? `<p><b>${escapeHtml(revealWord.w)}</b> · ${escapeHtml(revealWord.p)} · ${escapeHtml(revealWord.m)}</p><p>${escapeHtml(revealWord.ex)}</p>` : ''}
      <button class="primary" data-question-next type="button">Continue</button>
    </div>`;
    onAnswer(result);
    document.querySelector('[data-question-next]').addEventListener('click', event => {
      event.currentTarget.disabled = true;
      onDone(result);
    }, { once: true });
  }, { once: true }));
}
