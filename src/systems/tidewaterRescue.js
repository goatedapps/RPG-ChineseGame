import { chooseDictationWords } from './dictation.js';

export function tidewaterClue(levelPackage, id) {
  const clue = levelPackage.regionStory.rescue?.clues?.[id];
  const request = levelPackage.regionStory.requests?.[id];
  if (!clue || !request) return null;
  const lesson = request.lesson ?? levelPackage.config.regionLessons.r3[request.lessonSlot];
  const clueIds = Object.keys(levelPackage.regionStory.rescue?.clues || {});
  const matchingIds = clueIds.filter(clueId => {
    const matchingRequest = levelPackage.regionStory.requests?.[clueId];
    const matchingLesson = matchingRequest?.lesson ?? levelPackage.config.regionLessons.r3[matchingRequest?.lessonSlot];
    return matchingLesson === lesson;
  });
  const lessonGroup = matchingIds.indexOf(id);
  const wordsPerTest = levelPackage.regionStory.rescue.wordsPerTest;
  return { ...clue, id, lesson, person: request.name, lessonGroup, requiredCollected: (lessonGroup + 1) * wordsPerTest };
}

export function tidewaterDictationWords(levelPackage, progress, id, random = Math.random) {
  const clue = tidewaterClue(levelPackage, id);
  if (!clue) return [];
  const collected = levelPackage.content.words.filter(word => word.lesson === clue.lesson && (progress.words[word.w]?.collected || progress.words[word.w]?.c));
  if (collected.length < clue.requiredCollected) return [];
  const count = levelPackage.regionStory.rescue.wordsPerTest;
  const reserved = collected.slice(clue.lessonGroup * count, clue.requiredCollected);
  return chooseDictationWords(reserved, clue.lesson, count, random);
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
