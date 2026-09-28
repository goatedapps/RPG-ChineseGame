import { escapeHtml } from './dom.js';

export function createOverlay(element) {
  let closeHandler = null;
  let returnFocus = null;
  let typingTimer = null;
  function typeDialogue() {
    const line = element.querySelector('.dialog-card > p:not(.speaker), .storyteller-welcome p, [data-type-dialogue]');
    if (!line || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const fullText = line.textContent;
    if (!fullText) return;
    const characters = Array.from(fullText);
    const advance = element.querySelector('[data-dialogue-next], [data-scene-next]');
    let shown = 0;
    line.setAttribute('aria-label', fullText);
    line.textContent = '';
    const finish = () => { clearTimeout(typingTimer); shown = characters.length; line.textContent = fullText; };
    advance?.addEventListener('click', event => {
      if (shown >= characters.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish();
    }, true);
    const tick = () => {
      shown = Math.min(characters.length, shown + 1);
      line.textContent = characters.slice(0, shown).join('');
      if (shown < characters.length) typingTimer = setTimeout(tick, 26);
    };
    typingTimer = setTimeout(tick, 80);
  }
  function open(content, { dismissible = true, onClose = null } = {}) {
    clearTimeout(typingTimer);
    if (element.hidden) returnFocus = document.activeElement;
    closeHandler = onClose;
    api.dismissible = dismissible;
    element.innerHTML = content;
    element.classList.toggle('full-screen-overlay', Boolean(element.querySelector('.finale-screen, .homecoming-panel')));
    const panel = element.querySelector('.panel');
    if (panel?.querySelector(':scope > .panel-header') && !panel.matches('.bag-panel, .parent-panel')) panel.classList.add('atlas-window');
    element.hidden = false;
    element.dataset.open = 'true';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    const close = element.querySelector('[data-close-overlay]');
    if (close) close.addEventListener('click', api.close, { once: true });
    element.querySelector('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')?.focus();
    typeDialogue();
  }
  function close() {
    clearTimeout(typingTimer);
    element.hidden = true;
    element.dataset.open = 'false';
    element.innerHTML = '';
    element.classList.remove('full-screen-overlay');
    const handler = closeHandler;
    closeHandler = null;
    handler?.();
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function dialogue(interaction) {
    let index = 0;
    const render = () => {
      const last = index === interaction.lines.length - 1;
      open(`<div class="dialog-card">
        <p class="speaker">${escapeHtml(interaction.title)}</p>
        <p>${escapeHtml(interaction.lines[index])}</p>
        <button class="primary" data-dialogue-next>${last ? 'Continue' : 'Next'}</button>
      </div>`, { dismissible: false });
      element.querySelector('[data-dialogue-next]').addEventListener('click', () => {
        if (last) close();
        else { index += 1; render(); }
      }, { once: true });
    };
    render();
  }
  element.addEventListener('keydown', event => {
    if (event.key === 'Escape' && api.dismissible) { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...element.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], summary')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  const api = { open, close, dialogue, dismissible: true, get isOpen() { return !element.hidden; } };
  return api;
}
