import { tierOf } from '../learning/mastery.js?p10f';

export function eligiblePartners(words, progressByWord) {
  return words.filter(word => ['silver', 'gold'].includes(tierOf(progressByWord[word.w])));
}

export function setPartners(current, wordIds, eligibleIds) {
  const allowed = new Set(eligibleIds);
  return [...new Set(wordIds)].filter(id => allowed.has(id)).slice(0, 3);
}

export function partnerBonuses(partners, wordsById, progressByWord) {
  let maxHp = 0;
  for (const id of partners) {
    const word = wordsById[id];
    const tier = word ? tierOf(progressByWord[word.w]) : null;
    if (tier === 'silver') maxHp += 1;
    if (tier === 'gold') maxHp += 2;
  }
  return { maxHp };
}

export function partnerMove(word, progress, wordTags = {}) {
  if (!word || tierOf(progress) !== 'gold') return null;
  const idioms = {
    '狼吞虎咽': { id: 'full-heal', label: 'Wolf Down', message: 'restored all HP' },
    '齐心协力': { id: 'double-hit', label: 'Together as One', message: 'will double the next hit' },
    '抛到脑后': { id: 'ignore-miss', label: 'Cast It Aside', message: 'will block the next missed-answer attack' },
    '异口同声': { id: 'direct-damage', label: 'One Voice', message: 'dealt 1 damage' }
  };
  if (idioms[word.w]) return idioms[word.w];
  const element = wordTags[word.w] || 'Actions';
  const moves = {
    Outdoors: { id: 'heal-5', label: 'Nature Mend', message: 'restored 5 HP' },
    Food: { id: 'heal-3', label: 'Comforting Bite', message: 'restored 3 HP' },
    Feelings: { id: 'shield', label: 'Heart Shield', message: 'will block the next attack' },
    Actions: { id: 'damage-1', label: 'Action Boost', message: 'added 1 damage to the next hit' },
    Time: { id: 'reveal', label: 'Clear Thought', message: 'revealed the creature’s weakness' }
  };
  return moves[element] || moves.Actions;
}
