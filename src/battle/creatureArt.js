import { escapeHtml } from '../ui/dom.js';

const CREATURE_IMAGES = {
  fogling: 'fogling.webp',
  'echo-bat': 'echo-bat.webp',
  'twin-shade': 'twin-shade.webp',
  'jumble-bug': 'jumble-bug.webp',
  'ink-imp': 'ink-imp.webp',
  'muddle-king': 'muddle-king.webp',
  'chaff-sprite': 'chaff-sprite.webp',
  'rumour-crow': 'rumour-crow.webp',
  'price-mimic': 'price-mimic.webp',
  'doubt-moth': 'doubt-moth.webp',
  'forked-gecko': 'forked-gecko.webp',
  'doubt-serpent': 'doubt-serpent.webp',
  'tangle-crab': 'tangle-crab.webp',
  'drift-jelly': 'drift-jelly.webp',
  'rust-gull': 'rust-gull.webp',
  'minute-mite': 'minute-mite.webp',
  'tide-hare': 'tide-hare.webp',
  'idle-clock': 'idle-clock.webp',
  'mask-moth': 'mask-moth.webp',
  'heckle-magpie': 'heckle-magpie.webp',
  'straw-soldier': 'straw-soldier.webp',
  'spotlight-fox': 'spotlight-fox.webp',
  'wilt-wisp': 'wilt-wisp.webp',
  'mocking-mirror': 'mocking-mirror.webp',
  'ribbon-rat': 'ribbon-rat.webp',
  'drum-gremlin': 'drum-gremlin.webp',
  'spark-kite': 'spark-kite.webp',
  'quarrel-macaque': 'quarrel-macaque.webp',
  'boastful-lion': 'boastful-lion.webp',
  'grudge-dragon': 'grudge-dragon.webp',
  'glyph-beetle': 'glyph-beetle.webp',
  'bone-owl': 'bone-owl.webp',
  'ink-vine': 'ink-vine.webp',
  'relic-tortoise': 'relic-tortoise.webp',
  'whisper-moss': 'whisper-moss.webp',
  'give-up-ghost': 'give-up-ghost.webp',
  'blank-page-wisp': 'blank-page-wisp.webp',
  'eraser-moth': 'eraser-moth.webp',
  'silence-raven': 'silence-raven.webp',
  'lost-name-fox': 'lost-name-fox.webp',
  'hollow-book-golem': 'hollow-book-golem.webp',
  'great-forgetter': 'great-forgetter.webp'
};

export function creatureSvg(id, word = '字') {
  const file = CREATURE_IMAGES[id] || CREATURE_IMAGES.fogling;
  const label = id.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
  return `<div class="creature-portrait"><img class="creature-image creature-${escapeHtml(id)}" src="../assets/images/creatures/${file}" alt="${escapeHtml(label)}">${word ? `<span class="word-seal" aria-label="Word Spirit identity sealed">${escapeHtml(word)}</span>` : ''}</div>`;
}
