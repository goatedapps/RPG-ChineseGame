import { escapeHtml } from './dom.js';
import { checkAnswer } from '../learning/questions.js';

export function showQuestion(overlay, question, word, onDone, { title = 'Learning challenge', revealWord = word, headerHtml = '', onAnswer = () => {}, readFeedback = null, stopFeedback = () => {} } = {}) {
  overlay.open(`<article class="panel question-panel${headerHtml.includes('battle-question-badge') ? ' battle-question' : ''}">
    ${headerHtml}
    <p class="panel-kicker">${escapeHtml(title)}</p>
    <h2 tabindex="-1" data-question-title>${escapeHtml(question.prompt)}</h2>
    <p class="question-instruction">${escapeHtml(question.instruction)}</p>
    <div class="question-options">${question.options.map((option, index) => `<button type="button" data-answer="${index}">${escapeHtml(option)}</button>`).join('')}</div>
    <div data-feedback></div>
  </article>`, { dismissible: false, focusSelector: '[data-question-title]' });
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
      ${revealWord ? `<p class="answer-word"><b>${escapeHtml(revealWord.w)}</b>${readFeedback ? `<button class="read-feedback" data-read-feedback type="button" aria-label="Read word and example sentence" title="Read word and example sentence"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12-2a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16"/></svg></button>` : ''}<span> · ${escapeHtml(revealWord.p)} · ${escapeHtml(revealWord.m)}</span></p><p>${escapeHtml(revealWord.ex)}</p>` : ''}
      <button class="primary" data-question-next type="button">Continue</button>
    </div>`;
    onAnswer(result);
    document.querySelector('[data-read-feedback]')?.addEventListener('click', () => readFeedback(revealWord));
    document.querySelector('[data-question-next]').addEventListener('click', event => {
      event.currentTarget.disabled = true;
      stopFeedback();
      onDone(result);
    }, { once: true });
  }, { once: true }));
}
