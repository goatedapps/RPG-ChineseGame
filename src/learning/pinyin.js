const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };

export function syllableTone(syllable) {
  for (const [vowel, tones] of Object.entries(TONES)) {
    for (let index = 0; index < tones.length; index += 1) {
      if (syllable.includes(tones[index])) return { base: syllable.replace(tones[index], vowel), vowel, tone: index + 1 };
    }
  }
  const vowel = ['a', 'o', 'e', 'i', 'u', 'ü'].find(candidate => syllable.includes(candidate)) || null;
  return { base: syllable, vowel, tone: 0 };
}

export function withTone(syllable, tone) {
  const parsed = syllableTone(syllable);
  if (!parsed.vowel || tone === 0) return parsed.base;
  let vowel = parsed.vowel;
  if (parsed.base.includes('a')) vowel = 'a';
  else if (parsed.base.includes('o')) vowel = 'o';
  else if (parsed.base.includes('e')) vowel = 'e';
  else if (parsed.base.includes('iu')) vowel = 'u';
  else if (parsed.base.includes('ui')) vowel = 'i';
  return parsed.base.replace(vowel, TONES[vowel][tone - 1]);
}

export function pinyinVariants(pinyin) {
  const parts = pinyin.split(/\s+/);
  const variants = [];
  for (let partIndex = 0; partIndex < parts.length && variants.length < 3; partIndex += 1) {
    const current = syllableTone(parts[partIndex]).tone;
    for (let tone = 1; tone <= 4 && variants.length < 3; tone += 1) {
      if (tone === current) continue;
      const next = [...parts];
      next[partIndex] = withTone(next[partIndex], tone);
      const value = next.join(' ');
      if (value !== pinyin && !variants.includes(value)) variants.push(value);
    }
  }
  return variants;
}

