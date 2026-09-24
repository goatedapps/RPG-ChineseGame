const HATS = new Set(['red-cap', 'bamboo-hat', 'scholar-cap', 'gold-crown']);

export function heroPortrait(equipment = {}, sizeClass = '') {
  const hat = HATS.has(equipment.hat) ? equipment.hat : '';
  return `<div class="hero-avatar ${sizeClass} ${hat}" role="img" aria-label="Main character"><span class="hero-avatar-body" aria-hidden="true"></span><span class="hero-avatar-head" aria-hidden="true"></span><span class="hero-avatar-brush" aria-hidden="true"></span><span class="hero-avatar-hat" aria-hidden="true"></span></div>`;
}
