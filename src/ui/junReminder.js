import { escapeHtml } from './dom.js';

const contexts = [
  ['companion', '.companion-battle-card [data-companion-skill]:not([disabled])', '.companion-battle-card'],
  ['restoration', '[data-offer]:not([disabled])', '.set-card'],
  ['crafting', '.craft-panel [data-craft]:not([disabled])', '.craft-card'],
  ['equipment', '.hero-status-panel [data-equip]:not([disabled])', '.gear-card'],
  ['dailyChest', '.daily-board-panel [data-daily-chest]:not([disabled])', '.daily-quests'],
  ['gateDictation', '[data-gate-test]:not([disabled])', '.button-row'],
  ['repellent', '.bag-panel [data-use-repellent="forest-repellent"]:not([disabled])', '.bag-list article']
];

export function attachJunReminder(game, root, persist) {
  const tutorial = game?.state.progress.tutorial;
  if (root.hidden || root.querySelector('.jun-reminder, .question-panel, .writing-panel') || !tutorial?.partTwoIntroduced || tutorial.step < 16 || tutorial.skipped || tutorial.pending) return;
  const flags = game.state.progress.flags;
  const copy = game.levelPackage.strings?.junGuidance?.reminders;
  if (!flags || !copy) return;
  for (const [key, selector, container] of contexts) {
    const flag = `jun-reminder-${key}`;
    if (flags[flag] || !copy[key]) continue;
    if (key === 'repellent' && (!game.levelPackage.map?.route || game.state.progress.encounter?.repellentSteps > 0)) continue;
    const control = root.querySelector(selector);
    if (!control) continue;
    const note = root.ownerDocument.createElement('aside');
    note.className = 'jun-reminder';
    note.innerHTML = `<div><b>Jun’s note</b><p>${escapeHtml(copy[key])}</p></div><button type="button" class="secondary">Got it</button>`;
    (control.closest(container) || control).before(note);
    const remember = () => {
      if (flags[flag]) return;
      flags[flag] = true;
      persist();
      const dismiss = note.querySelector('button');
      if (root.ownerDocument.activeElement === dismiss) control.focus({ preventScroll: true });
      note.remove();
    };
    note.querySelector('button').addEventListener('click', remember, { once: true });
    control.addEventListener('click', remember, { once: true });
    return;
  }
}
