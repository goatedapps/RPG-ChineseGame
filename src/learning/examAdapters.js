export const EXAM_INSTRUCTIONS = Object.freeze({
  sentence: 'Pick the best way to complete the sentence.',
  vocab: 'Pick the word or character that fits the blank.',
  pinyin: 'Pick the correct pinyin for the underlined word.',
  usage: 'Which sentence uses the word correctly?',
  phrase: 'Pick the meaning closest to the underlined word.',
  conjunction: 'Pick the pair of joining words that fits.',
  cloze: 'Pick the answer that best completes the passage.',
  dialogue: 'Pick the answer that best completes the dialogue.',
  errorcorrect: 'Pick the correct character or word.',
  comprehension: 'Answer using the passage.',
  practical: 'Answer using the notice or poster.'
});

export function enabledQuestionKinds(config) {
  return new Set([...(config.coreQuestionKinds || []), ...(config.optionalQuestionKinds || [])]);
}

export function filterSupportedQuestions(content, config, { includeHigherChinese = false } = {}) {
  const enabled = enabledQuestionKinds(config);
  return content.questions.single.filter(question => (
    enabled.has(question.kind)
    && (includeHigherChinese || question.subject !== 'Higher Chinese')
    && Array.isArray(question.o)
    && question.o.length >= 2
    && question.o.includes(question.c)
  ));
}

export function adaptExamQuestion(question) {
  const usage = question.q.match(/以下哪一个句子是正确的？\s*[（(]词语：(.+?)[）)]/);
  const prompt = usage
    ? `Which sentence uses ${usage[1]} correctly?`
    : question.q.replace(/\s*[（(]选出[^）)]*[）)]\s*/g, '').trim();
  return {
    id: question.id,
    source: 'exam',
    kind: question.kind,
    prompt,
    instruction: EXAM_INSTRUCTIONS[question.kind] || 'Choose the best answer.',
    options: [...new Set(question.o)],
    correct: question.c,
    word: question.word || null,
    subject: question.subject
  };
}

