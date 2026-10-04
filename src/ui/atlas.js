const ATLAS_REGIONS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'];

export function setAtlasRegion(shell, regionId) {
  if (shell.dataset.atlasRegion === regionId && !shell.classList.contains('atlas-pregame')) return;
  shell.classList.remove('atlas-pregame');
  shell.dataset.atlasRegion = regionId;
  const menu = shell.querySelector('.hud-actions');
  if (menu) menu.scrollTop = 0;
  shell.classList.toggle('atlas-enabled', ATLAS_REGIONS.includes(regionId));
  for (const id of ATLAS_REGIONS) shell.classList.toggle(`atlas-region-${id}`, regionId === id);
}

export function bindAtlasMenu(shell, button, onLayoutChange, initiallyExpanded = false) {
  const updateButton = expanded => {
    const label = expanded ? 'Collapse menu' : 'Expand menu';
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', label);
    button.querySelector('.atlas-menu-label').textContent = label;
    button.querySelector('.atlas-menu-chevron').textContent = expanded ? '‹' : '›';
  };
  shell.classList.toggle('atlas-menu-expanded', initiallyExpanded);
  updateButton(initiallyExpanded);
  button.addEventListener('click', () => {
    const expanded = shell.classList.toggle('atlas-menu-expanded');
    const menu = shell.querySelector('.hud-actions');
    if (menu) menu.scrollTop = 0;
    updateButton(expanded);
    onLayoutChange();
  });
}

export function guardAtlasPanels(menu, canOpen, onBlocked = () => {}) {
  menu.addEventListener('click', event => {
    if (event.target.closest('#atlas-menu-toggle, #sound-button') || canOpen()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onBlocked();
  }, true);
}
