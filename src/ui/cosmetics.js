import { escapeHtml } from './dom.js';
import { heroPortrait } from './heroPortrait.js?p11';

export function roomCosmeticBackground(cosmetics) {
  const rug = cosmetics.room.includes('jade-garden-rug');
  const throwPlaced = cosmetics.room.includes('crimson-bed-throw');
  return throwPlaced ? `assets/images/room/room-crimson${rug ? '-no-rug' : ''}.webp` : rug ? 'assets/images/room/room-no-rug.webp' : 'assets/images/room/grandmas-room.webp';
}

export function cosmeticControls(cosmetics, catalog, equipment = {}) {
  const owned = catalog.filter(item => cosmetics.owned.includes(item.id));
  if (!owned.length) return '<section class="cosmetic-wardrobe"><h2>Your room and outfits</h2><p>Village shops sell decorations and robes. Purchases change your look, with no battle or learning bonuses.</p></section>';
  return `<section class="cosmetic-wardrobe"><h2>Your room and outfits</h2><p>Place decorations or change your outfit for free. Earned keepsakes stay on their shelf.</p><div class="cosmetic-current-hero">${heroPortrait(equipment, 'paper-hero', cosmetics.outfit)}<span>Your current outfit</span></div><div class="cosmetic-grid">${owned.map(item => {
    const active = item.type === 'outfit' ? cosmetics.outfit === item.id : cosmetics.room.includes(item.id);
    const blocked = item.requires && !cosmetics.room.includes(item.requires);
    return `<article class="cosmetic-card"><img src="${item.image}" alt=""><b>${escapeHtml(item.name)}</b><button data-arrange-cosmetic="${item.id}" aria-pressed="${active}" ${blocked ? 'disabled' : ''}>${blocked ? 'Place companion nest first' : item.type === 'outfit' ? active ? 'Wear original robe' : 'Wear outfit' : active ? 'Put away' : 'Place in room'}</button></article>`;
  }).join('')}</div></section>`;
}

export function roomCosmeticArt(cosmetics, catalog, companion) {
  return `<svg class="room-cosmetic-art" viewBox="0 0 1672 941" aria-hidden="true">${catalog.filter(item => item.type === 'room' && cosmetics.room.includes(item.id) && item.placement).map(item => {
    const [x, y, width, height] = item.placement;
    return `<image href="${item.image}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`;
  }).join('')}${companion && cosmetics.room.includes('companion-nest') ? `<image href="assets/images/creatures/${companion.id}.webp" x="884" y="510" width="100" height="88"/>${cosmetics.room.includes('companion-ribbon') ? '<image href="assets/images/room/companion-ribbon.webp" x="916" y="563" width="34" height="30"/>' : ''}` : ''}</svg>`;
}
