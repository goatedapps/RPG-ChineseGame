export function dictationLessons(words, allowedLessons = null) {
  const allowed = allowedLessons ? new Set(allowedLessons) : null;
  return [...new Set(words.map(word => Number(word.lesson)).filter(lesson => Number.isInteger(lesson) && (!allowed || allowed.has(lesson))))].sort((a, b) => a - b);
}

export function chooseDictationWords(words, lesson, count, random = Math.random) {
  const pool = words.filter(word => Number(word.lesson) === Number(lesson));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count === 'all' ? pool.length : Math.min(Number(count) || 5, pool.length));
}

export function dictationResult(correct, total) {
  const percent = total ? Math.round(correct / total * 100) : 0;
  return { percent, message: percent >= 80 ? 'Good work!' : 'Practise more and try again.' };
}

export function gateDictationRules(settings = {}) {
  const requestedCount = Number(settings.gateDictationCount);
  const count = Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= 30 ? requestedCount : 15;
  const requestedPass = Number(settings.gateDictationPass);
  const pass = Number.isInteger(requestedPass) && requestedPass >= 1 ? Math.min(requestedPass, count) : Math.min(13, count);
  return { count, pass };
}

export function gateDictationPool(words, progressByWord) {
  return words.filter(word => progressByWord[word.w]?.collected || progressByWord[word.w]?.c);
}

export function chooseGateDictationWords(words, progressByWord, count, random = Math.random) {
  const pool = gateDictationPool(words, progressByWord);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count);
}
