import { chooseDictationWords } from './dictation.js';

export function tidewaterClue(levelPackage, id) {
  const clue = levelPackage.regionStory.rescue?.clues?.[id];
  const request = levelPackage.regionStory.requests?.[id];
  if (!clue || !request) return null;
  const lesson = request.lesson ?? levelPackage.config.regionLessons.r3[request.lessonSlot];
  return { ...clue, id, lesson, person: request.name };
}

export function tidewaterDictationWords(levelPackage, progress, id, random = Math.random) {
  const clue = tidewaterClue(levelPackage, id);
  if (!clue) return [];
  const collected = levelPackage.content.words.filter(word => word.lesson === clue.lesson && (progress.words[word.w]?.collected || progress.words[word.w]?.c));
  return chooseDictationWords(collected, clue.lesson, levelPackage.regionStory.rescue.wordsPerTest, random);
}

export function tidewaterCluesComplete(story, regionStory) {
  return Object.keys(regionStory.rescue?.clues || {}).every(id => story.flags?.tideClues?.[id] === true);
}

export function completeTidewaterClue(story, regionStory, id, correct) {
  if (!regionStory.rescue?.clues?.[id] || correct < regionStory.rescue.correctToPass) return story;
  return {
    ...story,
    flags: { ...story.flags, tideClues: { ...story.flags?.tideClues, [id]: true } }
  };
}

export function tidewaterEvidenceReady(story, regionStory, inventory) {
  return tidewaterCluesComplete(story, regionStory) && (inventory.keyItems || []).includes(regionStory.readingKeyItem);
}
