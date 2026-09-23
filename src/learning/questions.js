import { adaptExamQuestion } from './examAdapters.js';
import { pinyinVariants } from './pinyin.js';

export const MCQ_SKILLS = Object.freeze(['m', 'p', 'h', 'u']);

function shuffle(values, random) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function options(correct, distractors, random) {
  return shuffle([...new Set([correct, ...distractors].filter(Boolean))].slice(0, 4), random);
}

function otherWords(word, words, predicate = () => true) {
  const preferred = words.filter(candidate => candidate.id !== word.id && predicate(candidate));
  const fallback = words.filter(candidate => candidate.id !== word.id);
  return [...new Map([...preferred, ...fallback].map(candidate => [candidate.id, candidate])).values()];
}

export function makeQuestion(word, skill, words, { random = Math.random } = {}) {
  if (!MCQ_SKILLS.includes(skill)) throw new Error(`Unsupported MCQ skill: ${skill}`);
  const peers = otherWords(word, words);
  if (skill === 'm') return {
    source: 'generated', skill, prompt: word.w, instruction: 'What does this word mean?',
    options: options(word.m, peers.map(candidate => candidate.m), random), correct: word.m, word: word.w
  };
  if (skill === 'p') {
    const matching = otherWords(word, words, candidate => candidate.p.split(/\s+/).length === word.p.split(/\s+/).length);
    return {
      source: 'generated', skill, prompt: word.w, instruction: 'Pick the correct pinyin.',
      options: options(word.p, [...pinyinVariants(word.p), ...matching.map(candidate => candidate.p)], random), correct: word.p, word: word.w
    };
  }
  if (skill === 'h') {
    const matching = otherWords(word, words, candidate => [...candidate.w].length === [...word.w].length);
    return {
      source: 'generated', skill, prompt: `${word.m} · ${word.p}`, instruction: 'Which is the correct word?',
      options: options(word.w, matching.map(candidate => candidate.w), random), correct: word.w, word: word.w, hanziOptions: true
    };
  }
  const sentence = word.sb.find(entry => entry[0].includes(word.w)) || word.sb[0] || [word.ex, ''];
  const matching = otherWords(word, words, candidate => [...candidate.w].length === [...word.w].length && candidate.lesson === word.lesson);
  return {
    source: 'generated', skill,
    prompt: sentence[0].replace(word.w, '＿＿'), instruction: 'Pick the word that fits the blank.',
    options: options(word.w, matching.map(candidate => candidate.w), random), correct: word.w, word: word.w,
    explanation: sentence[1] || ''
  };
}

export function makeExamQuestion(question) {
  return adaptExamQuestion(question);
}

export function checkAnswer(question, answer) {
  return { ok: answer === question.correct, answer: question.correct };
}

