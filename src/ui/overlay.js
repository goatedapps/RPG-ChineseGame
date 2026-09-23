import { escapeHtml } from './dom.js';

export function createOverlay(element) {
  let closeHandler = null;
  function open(content, { dismissible = true, onClose = null } = {}) {
    closeHandler = onClose;
    element.innerHTML = content;
    element.hidden = false;
    element.dataset.open = 'true';
    const close = element.querySelector('[data-close-overlay]');
    if (close && dismissible) close.addEventListener('click', api.close, { once: true });
    element.querySelector('button:not([disabled]), input, textarea')?.focus();
  }
  function close() {
    element.hidden = true;
    element.dataset.open = 'false';
    element.innerHTML = '';
    const handler = closeHandler;
    closeHandler = null;
    handler?.();
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
  const api = { open, close, dialogue, get isOpen() { return !element.hidden; } };
  return api;
}
