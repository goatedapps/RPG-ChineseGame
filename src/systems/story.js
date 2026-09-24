import { tierOf } from '../learning/mastery.js';

export function createStoryState() {
  return {
    flags: {},
    bossDefeated: false,
    fragment: null,
    rivalDuels: 0,
    requests: { xiaoqiang: 0, 'mr-lin': 0, 'chef-mei': 0 },
    counters: { creatures: {}, writing: {}, tingxieLesson3: 0 },
    storiesRead: []
  };
}

export function normalizeStory(value = {}) {
  const fresh = createStoryState();
  return {
    ...fresh,
    ...value,
    flags: { ...fresh.flags, ...(value.flags || {}) },
    requests: { ...fresh.requests, ...(value.requests || {}) },
    counters: {
      ...fresh.counters,
      ...(value.counters || {}),
      creatures: { ...fresh.counters.creatures, ...(value.counters?.creatures || {}) },
      writing: { ...fresh.counters.writing, ...(value.counters?.writing || {}) }
    },
    storiesRead: Array.isArray(value.storiesRead) ? value.storiesRead : []
  };
}

export function regionWords(levelPackage) {
  const lessons = levelPackage.config.regionLessons.r1;
  return levelPackage.content.words.filter(word => lessons.includes(word.lesson));
}

export function gateStatus(levelPackage, progress, inventory, requiredPct = 0.22) {
  const words = regionWords(levelPackage);
  const silver = words.filter(word => ['silver', 'gold'].includes(tierOf(progress.words[word.w]))).length;
  const required = Math.ceil(new Set(words.map(word => word.w)).size * requiredPct);
  const lantern = (inventory.keyItems || []).includes('cave-lantern');
  return { silver, total: words.length, required, requiredPct, lantern, open: silver >= required && lantern };
}

function collected(progress, word) {
  return Boolean(progress.words[word]?.collected || progress.words[word]?.c);
}

function silver(progress, word) {
  return ['silver', 'gold'].includes(tierOf(progress.words[word]));
}

export function requestReady(id, step, progress, story) {
  if (id === 'xiaoqiang') {
    if (step === 0) return collected(progress, '贵重') && collected(progress, '探险');
    if (step === 1) return Boolean(story.flags.treasureFound);
    if (step === 2) return silver(progress, '狼吞虎咽');
  }
  if (id === 'mr-lin') {
    if (step === 0) return silver(progress, '模糊') && silver(progress, '眼圈');
    if (step === 1) return (story.counters.creatures['twin-shade'] || 0) >= 3;
    if (step === 2) return (story.counters.writing['距离'] || 0) >= 1;
  }
  if (id === 'chef-mei') {
    if (step === 0) return silver(progress, '调味料') && silver(progress, '材料');
    if (step === 1) return (story.counters.creatures['ink-imp'] || 0) >= 2;
    if (step === 2) return story.counters.tingxieLesson3 >= 3;
  }
  return false;
}

export function recordStoryEvent(value, event, payload = {}) {
  const story = normalizeStory(value);
  if (event === 'creature-win') story.counters.creatures[payload.id] = (story.counters.creatures[payload.id] || 0) + 1;
  if (event === 'writing-success') story.counters.writing[payload.word] = (story.counters.writing[payload.word] || 0) + 1;
  if (event === 'tingxie-lesson3') story.counters.tingxieLesson3 += payload.count || 1;
  return story;
}

export function bossGateQueue(content) {
  const singles = content.questions.single;
  const inRegion = item => !item.lessons?.length || item.lessons.some(lesson => lesson <= 3);
  const conjunctions = singles.filter(item => item.kind === 'conjunction' && inRegion(item)).slice(0, 3).map(item => ({ phase: 'Chain Spell', kind: 'question', item }));
  const sentences = singles.filter(item => item.kind === 'sentence' && inRegion(item)).slice(0, 2).map(item => ({ phase: 'Scramble Spell', kind: 'question', item }));
  const lessonWords = content.words.filter(word => word.lesson <= 3).slice(0, 2).map(word => ({ phase: 'Ink Spell', kind: 'writing', word }));
  const cloze = content.questions.groups.find(group => group.id === 'TN-G1') || content.questions.groups.find(group => group.kind === 'cloze' && group.subject === 'Chinese');
  const blanks = (cloze?.items || []).slice(0, 5).map(item => ({ phase: 'Muddle Scroll', kind: 'question', item: { ...item, kind: 'cloze' } }));
  return [...conjunctions, ...sentences, ...lessonWords, ...blanks];
}

export function applyStoryCommands(value, commands) {
  const story = normalizeStory(value);
  const rewards = [];
  for (const command of commands) {
    if (command.setFlag) story.flags[command.setFlag] = true;
    if (command.rewardKey) {
      story.fragment = command.rewardKey;
      rewards.push(command.rewardKey);
    }
  }
  if (story.flags.bossDefeated) story.bossDefeated = true;
  return { story, rewards };
}
