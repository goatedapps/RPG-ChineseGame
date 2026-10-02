import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { load as loadYaml } from 'js-yaml';
import { validateMap } from '../src/world/map.js';
import { gateDictationRules } from '../src/systems/dictation.js';

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
  const wordsByLesson = new Map();
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
    wordsByLesson.set(lesson, vocab.map(word => word.word));
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
    const records = readYaml(path.join(questionDir, file)) || [];
    if (!Array.isArray(records)) {
      errors.push(`questions/${file} must contain an array.`);
      continue;
    }
    if (records.length) availableKinds.add(path.basename(file, '.yaml'));
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
        if (!questions.length) errors.push(`${id || file} has no passage questions.`);
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
        if (question.lessonIds?.length && question.subject !== 'Higher Chinese' && (!Array.isArray(question.options) || question.options.length !== 4 || new Set(question.options).size !== 4)) {
          errors.push(`${id || file} needs four distinct answer options for lesson play.`);
        }
      }
    }
  }

  return { summary, errors, warnings, availableKinds, wordsByLesson };
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
  if (registryById.size !== registry.length) errors.push('content/authored/shared/levels.json contains duplicate curriculum ids.');
  for (const entry of registry) {
    if (!/^[a-z][a-z0-9-]*$/.test(entry.id || '')) errors.push(`Invalid curriculum id ${entry.id}.`);
    if (!entry.label || typeof entry.label !== 'string') errors.push(`${entry.id} needs a display label.`);
    if (entry.badge != null && (typeof entry.badge !== 'string' || !entry.badge.trim())) errors.push(`${entry.id} has an invalid picker badge.`);
    if (entry.worldMappingReady && !entry.sourceReady) errors.push(`${entry.id} cannot be playable before its source is ready.`);
  }
  const gateWordCount = gateDictationRules({}).count;
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
    if (registryById.get(level).worldMappingReady) {
      for (const regionId of regionIds) {
        const lessonsForRegion = config.regionLessons?.[regionId] || [];
        const uniqueWords = new Set(lessonsForRegion.flatMap(lesson => report.wordsByLesson.get(lesson) || []));
        if (lessonsForRegion.length < 2 || (regionId === 'r1' && lessonsForRegion.length !== 3)) {
          errors.push(`${level} ${regionId} needs ${regionId === 'r1' ? 'three' : 'at least two'} mapped lessons.`);
        }
        if (regionId === 'r1') {
          const bindings = config.region1 || {};
          if (!uniqueWords.has(bindings.tutorialWord)) errors.push(`${level} Region 1 tutorial word is absent from its mapped lessons.`);
          for (const [requestId, request] of Object.entries(bindings.requests || {})) {
            const words = [...(request.collect || []), ...(Array.isArray(request.bronze) ? request.bronze : [request.bronze]), request.write].filter(Boolean);
            if (words.some(word => !uniqueWords.has(word))) errors.push(`${level} Region 1 request ${requestId} uses a word outside its mapped lessons.`);
          }
        }
        const storyFile = path.join(authoredRoot, 'campaign', `${regionId}-story.json`);
        const story = JSON.parse(fs.readFileSync(storyFile, 'utf8'));
        const setsFile = path.join(authoredRoot, 'campaign', `${regionId}-sets.json`);
        const sets = JSON.parse(fs.readFileSync(setsFile, 'utf8'))[level] || [];
        if (!sets.length) errors.push(`${level} ${regionId} needs curriculum-specific Restoration Sets.`);
        const setIds = new Set();
        for (const set of sets) {
          if (!set.id || setIds.has(set.id) || !set.name || !set.restoration) errors.push(`${level} ${regionId} has an incomplete or duplicate Restoration Set ${set.id}.`);
          setIds.add(set.id);
          if (!Array.isArray(set.words) || set.words.length < 3 || new Set(set.words).size !== set.words.length || set.words.some(word => !uniqueWords.has(word))) {
            errors.push(`${level} ${regionId} set ${set.id} needs at least three distinct words from this region.`);
          }
        }
        for (const [requestId, request] of Object.entries(story.requests || {})) {
          if (request.lessonSlot !== undefined && (!Number.isInteger(request.lessonSlot) || request.lessonSlot < 0 || request.lessonSlot > 2 || !lessonsForRegion.length)) {
            errors.push(`${level} ${regionId} request ${requestId} has an invalid lesson slot.`);
          }
        }
        if (!Number.isFinite(story.gateBronzePct) || story.gateBronzePct <= 0 || story.gateBronzePct > 1) {
          errors.push(`${regionId}-story.json needs a Bronze threshold between 0 and 1.`);
        } else if (Math.ceil(uniqueWords.size * story.gateBronzePct) < gateWordCount) {
          errors.push(`${level} ${regionId} needs at least ${gateWordCount} distinct words available at the Bronze boss threshold for default gate dictation.`);
        }
        if (story.chapter) {
          const chapter = story.chapter;
          if (!Number.isInteger(chapter.wordsPerTest) || chapter.wordsPerTest < 1 || !Number.isInteger(chapter.correctToPass) || chapter.correctToPass < 1 || chapter.correctToPass > chapter.wordsPerTest) {
            errors.push(`${regionId}-story.json has invalid chapter dictation rules.`);
          }
          for (const asset of Object.values(chapter.art || {})) {
            if (typeof asset !== 'string' || !fs.existsSync(path.join(projectRoot, asset))) errors.push(`${regionId}-story.json refers to missing chapter art ${asset}.`);
          }
          if (chapter.board) {
            const evidence = chapter.board.evidence || [];
            const choices = chapter.board.choices || [];
            if (!chapter.board.intro || !chapter.board.question || evidence.length < 2 || choices.length < 2 || choices.filter(choice => choice.correct === true).length !== 1 || evidence.some(item => !chapter.tasks?.[item.id] || !item.label || !item.detail) || choices.some(choice => !choice.id || !choice.label)) {
              errors.push(`${regionId}-story.json has an incomplete chapter evidence board.`);
            }
          }
          const groupCounts = new Map();
          for (const [id, task] of Object.entries(chapter.tasks || {})) {
            const taskLessons = config.regionLessons?.[task.region] || [];
            const lesson = Number.isInteger(task.lessonSlot) ? taskLessons[task.lessonSlot] ?? taskLessons.at(-1) : null;
            if (!regionIds.includes(task.region) || !taskLessons.length || (Number.isInteger(task.lessonSlot) && task.lessonSlot < 0) || !task.group || !task.name || !task.person || !task.prompt || !task.found) {
              errors.push(`${level} ${regionId} chapter task ${id} has invalid binding or missing text.`);
              continue;
            }
            const poolKey = `${task.region}:${lesson ?? 'all'}`;
            const count = (groupCounts.get(poolKey) || 0) + 1;
            groupCounts.set(poolKey, count);
            const pool = new Set((lesson === null ? taskLessons : [lesson]).flatMap(value => report.wordsByLesson.get(value) || []));
            if (pool.size < count * chapter.wordsPerTest) errors.push(`${level} ${regionId} chapter task ${id} needs ${count * chapter.wordsPerTest} distinct words in ${poolKey}.`);
          }
        }
      }
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
