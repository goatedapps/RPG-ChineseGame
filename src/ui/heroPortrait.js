const HATS = new Set(['red-cap', 'bamboo-hat', 'scholar-cap', 'gold-crown']);

export function heroPortrait(equipment = {}, sizeClass = '') {
  const hat = HATS.has(equipment.hat) ? equipment.hat : '';
  return `<div class="hero-avatar ${sizeClass} ${hat}" role="img" aria-label="Main character"><img class="hero-avatar-image" src="../assets/images/hero/main-hero.webp" alt=""><span class="hero-avatar-hat" aria-hidden="true"></span></div>`;
}
