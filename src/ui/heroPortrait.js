const HATS = new Set(['red-cap', 'bamboo-hat', 'scholar-cap', 'gold-crown']);

const OUTFITS = new Set(['jade-traveller-robe', 'festival-robe', 'tidewater-robe']);

export function heroPortrait(equipment = {}, sizeClass = '', outfit = null) {
  const hat = HATS.has(equipment.hat) ? equipment.hat : '';
  return `<div class="hero-avatar ${sizeClass} ${hat}" role="img" aria-label="Main character"><img class="hero-avatar-image" src="${OUTFITS.has(outfit) ? `assets/images/hero/${outfit}.webp` : 'assets/images/hero/main-hero.webp'}" alt=""><span class="hero-avatar-hat" aria-hidden="true"></span></div>`;
}
