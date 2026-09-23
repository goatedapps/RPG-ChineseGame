import { tierOf } from '../learning/mastery.js';

export function setProgress(set, progressByWord, availableWords) {
  const available = new Set(availableWords.map(word => word.w));
  const words = set.words.filter(word => available.has(word));
  const ready = words.length >= 3 && words.every(word => ['silver', 'gold'].includes(tierOf(progressByWord[word])));
  return { words, ready, completed: false };
}

export function offerSet(set, state) {
  if (!state.ready || state.completed) return { ...state };
  return { ...state, completed: true, restoration: set.restoration };
}

