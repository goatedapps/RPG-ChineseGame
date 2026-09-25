import { escapeHtml } from '../ui/dom.js';

const CREATURE_IMAGES = {
  fogling: 'fogling.png',
  'echo-bat': 'echo-bat.png',
  'twin-shade': 'twin-shade.png',
  'jumble-bug': 'jumble-bug.png',
  'ink-imp': 'ink-imp.png',
  'muddle-king': 'muddle-king.png',
  'chaff-sprite': 'chaff-sprite.png',
  'rumour-crow': 'rumour-crow.png',
  'price-mimic': 'price-mimic.png',
  'doubt-moth': 'doubt-moth.png',
  'forked-gecko': 'forked-gecko.png',
  'doubt-serpent': 'doubt-serpent.png',
  'tangle-crab': 'tangle-crab.png',
  'drift-jelly': 'drift-jelly.png',
  'rust-gull': 'rust-gull.png',
  'minute-mite': 'minute-mite.png',
  'tide-hare': 'tide-hare.png',
  'idle-clock': 'idle-clock.png',
  'mask-moth': 'mask-moth.png',
  'heckle-magpie': 'heckle-magpie.png',
  'straw-soldier': 'straw-soldier.png',
  'spotlight-fox': 'spotlight-fox.png',
  'wilt-wisp': 'wilt-wisp.png',
  'mocking-mirror': 'mocking-mirror.png'
};

export function creatureSvg(id, word = '字') {
  const file = CREATURE_IMAGES[id] || CREATURE_IMAGES.fogling;
  const label = id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
  return `<div class="creature-portrait"><img class="creature-image creature-${escapeHtml(id)}" src="../assets/images/creatures/${file}" alt="${escapeHtml(label)}">${word ? `<span class="word-seal" aria-label="Word Spirit identity sealed">${escapeHtml(word)}</span>` : ''}</div>`;
}
