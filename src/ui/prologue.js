import { escapeHtml } from './dom.js';

export const PROLOGUE_SLIDES = Object.freeze([
  {
    image: '../assets/images/intro/dictionary-tree.png',
    position: 'center',
    title: 'Every word was alive',
    body: 'Long ago, every word in the land lived as a Word Spirit — 字灵 — in the Great Dictionary Tree, 字典树. With their help, people could speak clearly, read bravely and write down the stories that mattered.'
  },
  {
    image: '../assets/images/intro/great-forgetter.png',
    position: 'center',
    title: 'Then remembering had an enemy',
    body: 'The Great Forgetter — 遗忘大王 — wanted every name, letter and promise to disappear. He reached for the Spirit Brush that guarded the Tree.'
  },
  {
    image: '../assets/images/intro/spirits-scattered.png',
    position: 'center',
    title: 'The Spirit Brush shattered',
    body: 'Seven bright fragments flew across the world. The Word Spirits scattered with them and were sealed inside wild creatures.'
  },
  {
    image: '../assets/images/intro/spirits-scattered.png',
    position: '66% center',
    title: 'Now the whole world is muddled',
    body: 'People forget names, signs point the wrong way, and cooks mix up salt and sugar. Without their words, people may soon lose their stories and the promises they made.'
  },
  {
    image: '../assets/images/intro/spirits-scattered.png',
    position: '54% center',
    title: 'The empty brush handle chose you',
    body: 'Find the lost Word Spirits. Restore the seven Brush Fragments. Help every town remember — before the Great Forgetter reaches the Tree again.'
  }
]);

export function createPrologue({ root, audio, onComplete, skippable = true }) {
  let index = -1;
  let finished = false;
  let typingTimer = null;
  let finishTyping = null;

  function stopTyping() {
    clearInterval(typingTimer);
    typingTimer = null;
    finishTyping = null;
  }

  function finish(skipped = false) {
    if (finished) return;
    finished = true;
    stopTyping();
    root.hidden = true;
    root.innerHTML = '';
    root.removeEventListener('keydown', onKeydown);
    audio?.setScene('village');
    onComplete?.({ skipped });
  }

  function renderSplash() {
    root.hidden = false;
    root.innerHTML = `<section class="prologue-screen prologue-splash" style="--prologue-image:url('../assets/images/intro/dictionary-tree.png')" aria-label="Word Spirit Quest introduction">
      <div class="prologue-vignette"></div>
      <div class="prologue-title-lockup"><p>字灵</p><h1>Word Spirit Quest</h1><span>A story about the words only you can save</span></div>
      <div class="prologue-actions"><button class="prologue-begin" data-prologue-begin>Begin the story</button>${skippable ? '<button class="prologue-skip" data-prologue-skip>Skip intro for testing</button>' : ''}</div>
    </section>`;
    root.querySelector('[data-prologue-begin]').addEventListener('click', () => {
      audio?.unlock();
      audio?.setScene('intro');
      index = 0;
      renderSlide();
    }, { once: true });
    root.querySelector('[data-prologue-skip]')?.addEventListener('click', () => finish(true), { once: true });
    root.querySelector('[data-prologue-begin]')?.focus();
  }

  function renderSlide() {
    stopTyping();
    const slide = PROLOGUE_SLIDES[index];
    const last = index === PROLOGUE_SLIDES.length - 1;
    root.innerHTML = `<section class="prologue-screen" style="--prologue-image:url('${slide.image}');--prologue-position:${slide.position}" aria-label="Introduction, part ${index + 1} of ${PROLOGUE_SLIDES.length}">
      <div class="prologue-vignette"></div>
      <article class="prologue-story">
        <div class="prologue-progress" aria-label="Part ${index + 1} of ${PROLOGUE_SLIDES.length}">${PROLOGUE_SLIDES.map((_, dot) => `<i class="${dot === index ? 'current' : dot < index ? 'done' : ''}"></i>`).join('')}</div>
        <h1>${escapeHtml(slide.title)}</h1>
        <p data-prologue-copy aria-label="${escapeHtml(slide.body)}"></p>
        <div class="prologue-controls">${index ? '<button class="prologue-back" data-prologue-back>Back</button>' : ''}<button class="prologue-next" data-prologue-next>${last ? 'Begin your quest' : 'Continue'}</button></div>
      </article>
      ${skippable ? '<button class="prologue-skip" data-prologue-skip>Skip intro for testing</button>' : ''}
    </section>`;
    root.querySelector('[data-prologue-back]')?.addEventListener('click', () => { index -= 1; renderSlide(); });
    const copy = root.querySelector('[data-prologue-copy]');
    const revealImmediately = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let characterIndex = 0;
    finishTyping = () => {
      copy.textContent = slide.body;
      copy.classList.remove('typing');
      stopTyping();
    };
    if (revealImmediately) finishTyping();
    else {
      copy.classList.add('typing');
      typingTimer = setInterval(() => {
        characterIndex += 1;
        copy.textContent = slide.body.slice(0, characterIndex);
        if (characterIndex >= slide.body.length) finishTyping?.();
      }, 28);
    }
    root.querySelector('[data-prologue-next]').addEventListener('click', () => {
      if (typingTimer) return finishTyping?.();
      if (last) finish();
      else { index += 1; renderSlide(); }
    });
    root.querySelector('[data-prologue-skip]')?.addEventListener('click', () => finish(true), { once: true });
    root.querySelector('[data-prologue-next]')?.focus();
  }

  function onKeydown(event) {
    if (event.key === 'ArrowLeft' && index > 0) { index -= 1; renderSlide(); }
    if (event.key === 'ArrowRight' && typingTimer) finishTyping?.();
    else if (event.key === 'ArrowRight' && index >= 0 && index < PROLOGUE_SLIDES.length - 1) { index += 1; renderSlide(); }
  }

  root.addEventListener('keydown', onKeydown);
  renderSplash();
  return { finish };
}
