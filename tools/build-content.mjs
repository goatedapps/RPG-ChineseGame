import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'content', 'source');
const generatedRoot = path.join(projectRoot, 'content', 'generated');
const groupKinds = new Set(['cloze', 'comprehension', 'dialogue', 'errorcorrect', 'practical']);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function readYaml(file) {
  return loadYaml(read(file));
}

function sourceVersion(root) {
  const hash = crypto.createHash('sha256');
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        hash.update(path.relative(root, file).replaceAll('\\', '/'));
        hash.update(read(file));
      }
    }
  };
  visit(root);
  return hash.digest('hex').slice(0, 12);
}

function parseStory(markdown, lesson) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || `Lesson ${lesson}`;
  return {
    lesson,
    title,
    pages: markdown.split(/^## Page \d+\s*$/m).slice(1).map(page => page.trim()).filter(Boolean)
  };
}

function mapQuestionWord(kind, question, knownWords) {
  const exact = value => knownWords.has(value) ? value : null;
  if (kind === 'vocab') return exact(question.correct);
  if (kind === 'usage') return exact(question.question.match(/（词语[：:]\s*([^）]+)）/)?.[1]?.trim());
  if (kind === 'pinyin' || kind === 'phrase') return exact(question.question.match(/__(.+?)__/)?.[1]?.trim());
  return null;
}

function normalizeSingle(kind, question, knownWords) {
  return {
    id: question.questionID,
    kind,
    lessons: question.lessonIds || [],
    subject: question.subject || 'Chinese',
    q: question.question,
    o: question.options || [],
    c: question.correct,
    word: mapQuestionWord(kind, question, knownWords)
  };
}

function normalizeGroup(kind, group) {
  return {
    id: group.groupId,
    kind,
    lessons: group.lessonIds || [],
    subject: group.subject || 'Chinese',
    category: group.category || kind,
    passage: group.passage || null,
    optionBank: group.optionBank || null,
    items: (group.questions || []).map(question => ({
      format: question.format || (question.options ? 'MCQ' : 'Fill-in'),
      q: question.text,
      o: question.options || [],
      c: question.correct ?? null,
      accepted: question.accepted || null,
      displayAnswer: question.displayAnswer || null,
      marks: question.marks ?? null,
      context: question.context || null
    }))
  };
}

function buildLevel(level) {
  const root = path.join(sourceRoot, level);
  const meta = readYaml(path.join(root, 'meta.yaml'));
  const lessons = readYaml(path.join(root, 'tingxie', 'index.yaml'));
  const words = [];
  const sentences = [];
  const stories = [];

  for (const lesson of lessons) {
    const lessonData = readYaml(path.join(root, 'tingxie', `${lesson.id}.yaml`));
    for (const word of lessonData.vocab || []) {
      words.push({
        id: `${level}-${lesson.id}-${word.word}`,
        w: word.word,
        p: word.pinyin,
        m: word.meaning,
        lesson: lesson.id,
        ex: word.example,
        sb: (word.sentenceBank || []).map(sentence => [sentence.zh, sentence.en]),
        isIdiom: [...word.word].length === 4
      });
    }
    for (const sentence of lessonData.sentences || []) {
      sentences.push({
        lesson: lesson.id,
        t: sentence.text,
        seg: sentence.segments || [],
        icon: sentence.icon || null,
        description: sentence.description || null
      });
    }
    stories.push(parseStory(read(path.join(root, 'stories', `${lesson.id}.md`)), lesson.id));
  }

  const knownWords = new Set(words.map(word => word.w));
  const single = [];
  const groups = [];
  const questionDir = path.join(root, 'questions');
  for (const file of fs.readdirSync(questionDir).filter(file => file.endsWith('.yaml') && file !== 'index.yaml').sort()) {
    const kind = path.basename(file, '.yaml');
    const records = readYaml(path.join(questionDir, file)) || [];
    if (groupKinds.has(kind)) groups.push(...records.map(group => normalizeGroup(kind, group)));
    else single.push(...records.map(question => normalizeSingle(kind, question, knownWords)));
  }

  const output = {
    schemaVersion: 1,
    contentVersion: sourceVersion(root),
    level,
    label: meta.label,
    lessons,
    words,
    sentences,
    stories,
    questions: { single, groups }
  };
  const outputFile = path.join(generatedRoot, `${level}.content.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`${level}: wrote ${words.length} words, ${single.length} single questions and ${groups.length} passage groups.`);
}

fs.mkdirSync(generatedRoot, { recursive: true });
const levels = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
for (const level of levels) buildLevel(level);
