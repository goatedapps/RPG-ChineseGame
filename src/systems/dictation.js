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
