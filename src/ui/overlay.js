import { escapeHtml } from './dom.js';

export function createOverlay(element) {
  let closeHandler = null;
  let returnFocus = null;
  function open(content, { dismissible = true, onClose = null } = {}) {
    if (element.hidden) returnFocus = document.activeElement;
    closeHandler = onClose;
    api.dismissible = dismissible;
    element.innerHTML = content;
    element.hidden = false;
    element.dataset.open = 'true';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    const close = element.querySelector('[data-close-overlay]');
    if (close && dismissible) close.addEventListener('click', api.close, { once: true });
    element.querySelector('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]')?.focus();
  }
  function close() {
    element.hidden = true;
    element.dataset.open = 'false';
    element.innerHTML = '';
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
