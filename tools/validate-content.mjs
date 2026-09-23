import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { load as loadYaml } from 'js-yaml';
import { validateMap } from '../src/world/map.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(projectRoot, 'content', 'source');
const authoredRoot = path.join(projectRoot, 'content', 'authored');
const groupFiles = new Set([
  'cloze.yaml',
  'comprehension.yaml',
  'dialogue.yaml',
  'errorcorrect.yaml',
  'practical.yaml'
]);

function readYaml(file) {
  return loadYaml(fs.readFileSync(file, 'utf8'));
}

function storyPageCount(markdown) {
  return [...markdown.matchAll(/^## Page \d+\s*$/gm)].length;
}

function auditLevel(level) {
  const root = path.join(sourceRoot, level);
  const errors = [];
  const warnings = [];
  const meta = readYaml(path.join(root, 'meta.yaml'));
  const lessonIndex = readYaml(path.join(root, 'tingxie', 'index.yaml')) || [];
  const storyIndex = readYaml(path.join(root, 'stories', 'index.yaml')) || {};
  const lessonIds = new Set(Array.from({ length: meta.lessonCount }, (_, index) => index + 1));
  const ids = new Set();
  const availableKinds = new Set();
  const summary = {
    level,
    label: meta.label,
    lessons: meta.lessonCount,
    words: 0,
    modelSentences: 0,
    stories: 0,
    singleQuestions: 0,
    passageGroups: 0,
    passageQuestions: 0,
    higherChineseGroups: 0
  };

  if (lessonIndex.length !== meta.lessonCount) {
    errors.push(`tingxie/index.yaml lists ${lessonIndex.length} lessons; meta.yaml declares ${meta.lessonCount}.`);
  }

  for (const lesson of lessonIds) {
    const lessonFile = path.join(root, 'tingxie', `${lesson}.yaml`);
    const storyFile = path.join(root, 'stories', `${lesson}.md`);
    if (!fs.existsSync(lessonFile)) {
      errors.push(`Missing tingxie/${lesson}.yaml.`);
      continue;
    }
    if (!fs.existsSync(storyFile)) {
      errors.push(`Missing stories/${lesson}.md.`);
      continue;
    }

    const lessonData = readYaml(lessonFile);
    const vocab = lessonData.vocab || [];
    summary.words += vocab.length;
    summary.modelSentences += (lessonData.sentences || []).length;
    for (const [index, word] of vocab.entries()) {
      for (const field of ['word', 'pinyin', 'meaning', 'example']) {
        if (!word[field]) errors.push(`tingxie/${lesson}.yaml vocab ${index + 1} is missing ${field}.`);
      }
      if (!Array.isArray(word.sentenceBank) || word.sentenceBank.length === 0) {
        warnings.push(`tingxie/${lesson}.yaml ${word.word || `vocab ${index + 1}`} has no sentenceBank.`);
      }
    }

    const story = fs.readFileSync(storyFile, 'utf8');
    const pages = storyPageCount(story);
    if (pages !== 6) warnings.push(`stories/${lesson}.md has ${pages} pages; the campaign format expects 6.`);
    summary.stories += 1;
  }

  const writtenStories = Array.isArray(storyIndex) ? storyIndex : storyIndex.written;
  if (!Array.isArray(writtenStories) || writtenStories.length !== meta.lessonCount) {
    warnings.push('stories/index.yaml does not mark every declared lesson as written.');
  }

  const questionDir = path.join(root, 'questions');
  for (const file of fs.readdirSync(questionDir).filter(file => file.endsWith('.yaml') && file !== 'index.yaml')) {
    availableKinds.add(path.basename(file, '.yaml'));
    const records = readYaml(path.join(questionDir, file)) || [];
    if (!Array.isArray(records)) {
      errors.push(`questions/${file} must contain an array.`);
      continue;
    }
    if (groupFiles.has(file)) {
      summary.passageGroups += records.length;
      for (const group of records) {
        const id = group.groupId;
        if (!id) errors.push(`questions/${file} contains a group without groupId.`);
        else if (ids.has(id)) errors.push(`Duplicate question/group id: ${id}.`);
        else ids.add(id);
        if (group.subject === 'Higher Chinese') summary.higherChineseGroups += 1;
        for (const lesson of group.lessonIds || []) {
          if (!lessonIds.has(lesson)) errors.push(`${id || file} refers to missing lesson ${lesson}.`);
        }
        const questions = group.questions || [];
        summary.passageQuestions += questions.length;
        for (const [index, question] of questions.entries()) {
          if (!question.text) errors.push(`${id || file} question ${index + 1} has no text.`);
          if (question.options && !question.options.includes(question.correct)) {
            errors.push(`${id || file} question ${index + 1} has a correct answer outside its options.`);
          }
        }
      }
    } else {
      summary.singleQuestions += records.length;
      for (const question of records) {
        const id = question.questionID;
        if (!id) errors.push(`questions/${file} contains a question without questionID.`);
        else if (ids.has(id)) errors.push(`Duplicate question/group id: ${id}.`);
        else ids.add(id);
        for (const lesson of question.lessonIds || []) {
          if (!lessonIds.has(lesson)) errors.push(`${id || file} refers to missing lesson ${lesson}.`);
        }
        if (!question.question) errors.push(`${id || file} has no question text.`);
        if (question.options && !question.options.includes(question.correct)) {
          errors.push(`${id || file} has a correct answer outside its options.`);
        }
      }
    }
  }

  return { summary, errors, warnings, availableKinds };
}

function validateSharedConfiguration(reports) {
  const errors = [];
  const registry = JSON.parse(fs.readFileSync(path.join(authoredRoot, 'shared', 'levels.json'), 'utf8'));
  const regions = JSON.parse(fs.readFileSync(path.join(authoredRoot, 'campaign', 'regions.json'), 'utf8'));
  const regionIds = regions.map(region => region.id);
  if (new Set(regionIds).size !== 7 || regionIds.length !== 7) errors.push('The shared campaign must define seven unique regions.');
  const mapRoot = path.join(authoredRoot, 'campaign', 'maps');
  for (const file of fs.readdirSync(mapRoot).filter(file => file.endsWith('.json'))) {
    const map = JSON.parse(fs.readFileSync(path.join(mapRoot, file), 'utf8'));
    if (!regionIds.includes(map.region)) errors.push(`${file} refers to missing region ${map.region}.`);
    for (const error of validateMap(map)) errors.push(`${file}: ${error}`);
    const objectIds = map.objects.map(object => object.id);
    if (objectIds.length !== new Set(objectIds).size) errors.push(`${file} contains duplicate object ids.`);
  }

  const registryById = new Map(registry.map(level => [level.id, level]));
  for (const report of reports) {
    const { level, lessons } = report.summary;
    if (!registryById.has(level)) {
      errors.push(`${level} is missing from content/authored/shared/levels.json.`);
      continue;
    }
    const configFile = path.join(authoredRoot, 'levels', level, 'level.json');
    if (!fs.existsSync(configFile)) {
      errors.push(`${level} is missing content/authored/levels/${level}/level.json.`);
      continue;
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (config.id !== level) errors.push(`${level}/level.json has the wrong id.`);
    const configuredRegions = Object.keys(config.regionLessons || {});
    if (configuredRegions.length !== regionIds.length || regionIds.some(id => !configuredRegions.includes(id))) {
      errors.push(`${level}/level.json must map lessons for all seven shared regions.`);
    }
    const assigned = Object.values(config.regionLessons || {}).flat();
    const expected = Array.from({ length: lessons }, (_, index) => index + 1);
    if (assigned.length !== new Set(assigned).size) errors.push(`${level}/level.json assigns at least one lesson more than once.`);
    if (assigned.length !== expected.length || expected.some(lesson => !assigned.includes(lesson))) {
      errors.push(`${level}/level.json must assign every lesson exactly once.`);
    }
    const core = config.coreQuestionKinds || [];
    const optional = config.optionalQuestionKinds || [];
    const overlap = core.filter(kind => optional.includes(kind));
    if (overlap.length) errors.push(`${level}/level.json lists ${overlap.join(', ')} as both core and optional.`);
    for (const kind of [...core, ...optional]) {
      if (!report.availableKinds.has(kind)) errors.push(`${level}/level.json enables unavailable question kind ${kind}.`);
    }
  }
  for (const level of registryById.keys()) {
    if (!reports.some(report => report.summary.level === level)) errors.push(`${level} is registered but has no source pack.`);
  }
  return errors;
}

const levels = fs.readdirSync(sourceRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
const reports = levels.map(auditLevel);
const configurationErrors = validateSharedConfiguration(reports);

for (const report of reports) {
  const { summary, errors, warnings } = report;
  console.log(`\n${summary.label} (${summary.level})`);
  console.log(`  ${summary.lessons} lessons · ${summary.words} words · ${summary.stories} stories`);
  console.log(`  ${summary.singleQuestions} single questions · ${summary.passageGroups} passage groups · ${summary.passageQuestions} passage questions`);
  console.log(`  ${summary.higherChineseGroups} Higher Chinese passage groups`);
  for (const warning of warnings) console.warn(`  WARNING: ${warning}`);
  for (const error of errors) console.error(`  ERROR: ${error}`);
}

const errorCount = reports.reduce((total, report) => total + report.errors.length, 0);
const warningCount = reports.reduce((total, report) => total + report.warnings.length, 0);
for (const error of configurationErrors) console.error(`  ERROR: ${error}`);
const totalErrors = errorCount + configurationErrors.length;
console.log(`\nContent validation: ${totalErrors} error(s), ${warningCount} warning(s).`);
if (totalErrors) process.exitCode = 1;
