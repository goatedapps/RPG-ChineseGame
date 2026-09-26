const ATLAS_REGIONS = new Set(['r1', 'r2']);

export function setAtlasRegion(shell, regionId) {
  if (shell.dataset.atlasRegion === regionId) return;
  shell.dataset.atlasRegion = regionId;
  const menu = shell.querySelector('.hud-actions');
  if (menu) menu.scrollTop = 0;
  shell.classList.toggle('atlas-enabled', ATLAS_REGIONS.has(regionId));
  shell.classList.toggle('atlas-region-r1', regionId === 'r1');
  shell.classList.toggle('atlas-region-r2', regionId === 'r2');
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
