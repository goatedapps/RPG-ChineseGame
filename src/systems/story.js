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

export function requestReady(id, step, progress, story, bindings = {}) {
  const xiaoqiang = bindings.xiaoqiang || { collect: ['贵重', '探险'], silver: '狼吞虎咽' };
  const mrLin = bindings['mr-lin'] || { silver: ['模糊', '眼圈'], write: '距离' };
  const chefMei = bindings['chef-mei'] || { silver: ['调味料', '材料'] };
  if (id === 'xiaoqiang') {
    if (step === 0) return xiaoqiang.collect.every(word => collected(progress, word));
    if (step === 1) return Boolean(story.flags.treasureFound);
    if (step === 2) return silver(progress, xiaoqiang.silver);
  }
  if (id === 'mr-lin') {
    if (step === 0) return mrLin.silver.every(word => silver(progress, word));
    if (step === 1) return (story.counters.creatures['twin-shade'] || 0) >= 3;
    if (step === 2) return (story.counters.writing[mrLin.write] || 0) >= 1;
  }
  if (id === 'chef-mei') {
    if (step === 0) return chefMei.silver.every(word => silver(progress, word));
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

export function bossGateQueue(content, config = {}) {
  const singles = content.questions.single;
  const inRegion = item => !item.lessons?.length || item.lessons.some(lesson => lesson <= 3);
  const configuredKinds = [...(config.coreQuestionKinds || []), ...(config.optionalQuestionKinds || [])];
  const enabled = new Set(configuredKinds.length ? configuredKinds : ['conjunction', 'sentence', 'cloze']);
  const supported = singles.filter(item => enabled.has(item.kind) && item.subject !== 'Higher Chinese' && inRegion(item));
  const firstKind = enabled.has('conjunction') ? 'conjunction' : config.coreQuestionKinds?.[0];
  const secondKind = enabled.has('sentence') ? 'sentence' : config.coreQuestionKinds?.find(kind => kind !== firstKind);
  const conjunctions = supported.filter(item => item.kind === firstKind).slice(0, 3).map(item => ({ phase: 'Chain Spell', kind: 'question', item }));
  const sentences = supported.filter(item => item.kind === secondKind).slice(0, 2).map(item => ({ phase: 'Scramble Spell', kind: 'question', item }));
  const lessonWords = content.words.filter(word => word.lesson <= 3).slice(0, 2).map(word => ({ phase: 'Ink Spell', kind: 'writing', word }));
  const passage = content.questions.groups.find(group => group.id === 'TN-G1' && enabled.has(group.kind))
    || content.questions.groups.find(group => enabled.has(group.kind) && group.subject === 'Chinese');
  const blanks = (passage?.items || []).filter(item => ['MCQ', 'Fill-in'].includes(item.format)).slice(0, 5).map(item => ({ phase: 'Muddle Scroll', kind: 'question', item: { ...item, kind: passage.kind } }));
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
