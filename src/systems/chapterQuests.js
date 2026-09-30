import { chooseGateDictationWords } from './dictation.js';
import { normalizeStory } from './story.js';

export function chapterTask(levelPackage, chapterRegion, id) {
  const chapter = levelPackage.campaigns[chapterRegion]?.regionStory.chapter;
  const task = chapter?.tasks?.[id];
  if (!task) return null;
  const lessons = levelPackage.config.regionLessons[task.region] || [];
  const lesson = Number.isInteger(task.lessonSlot) ? lessons[task.lessonSlot] ?? lessons.at(-1) : null;
  const siblings = Object.entries(chapter.tasks).filter(([, candidate]) => {
    const candidateLessons = levelPackage.config.regionLessons[candidate.region] || [];
    const candidateLesson = Number.isInteger(candidate.lessonSlot) ? candidateLessons[candidate.lessonSlot] ?? candidateLessons.at(-1) : null;
    return candidate.region === task.region && candidateLesson === lesson;
  });
  const lessonGroup = siblings.findIndex(([siblingId]) => siblingId === id);
  return { ...task, id, lesson, lessonGroup, requiredCollected: (lessonGroup + 1) * chapter.wordsPerTest };
}

export function chapterDictationWords(levelPackage, progress, chapterRegion, id, random = Math.random) {
  const task = chapterTask(levelPackage, chapterRegion, id);
  if (!task) return [];
  const chapter = levelPackage.campaigns[chapterRegion].regionStory.chapter;
  const lessons = levelPackage.config.regionLessons[task.region] || [];
  const collected = levelPackage.content.words.filter(word =>
    lessons.includes(word.lesson) && (task.lesson === null || word.lesson === task.lesson) &&
    (progress.words[word.w]?.collected || progress.words[word.w]?.c));
  if (collected.length < task.requiredCollected) return [];
  const reserved = collected.slice(task.lessonGroup * chapter.wordsPerTest, task.requiredCollected);
  return chooseGateDictationWords(reserved, progress.words, chapter.wordsPerTest, random);
}

export function chapterGroupComplete(story, chapter, group) {
  return Object.entries(chapter.tasks).filter(([, task]) => task.group === group).every(([id]) => story.flags.chapterTasks?.[id] === true);
}

export function completeChapterTask(value, chapter, id, correct) {
  if (!chapter.tasks[id] || correct < chapter.correctToPass) return value;
  const story = normalizeStory(value);
  story.flags.chapterTasks = { ...story.flags.chapterTasks, [id]: true };
  return story;
}
