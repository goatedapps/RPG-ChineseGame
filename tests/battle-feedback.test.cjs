const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

test('answer feedback fires when Correct appears, before Continue advances battle', async () => {
  const { showQuestion } = await import('../src/ui/questionView.js');
  const previousDocument = global.document;
  const dom = new JSDOM('<div id="overlay"></div>');
  global.document = dom.window.document;
  try {
    const rootElement = dom.window.document.querySelector('#overlay');
    const overlay = { open: html => { rootElement.innerHTML = html; } };
    const events = [];
    showQuestion(overlay, { prompt: 'Question', instruction: 'Choose one', options: ['Yes', 'No'], correct: 'Yes' }, null,
      result => events.push(`continue:${result.ok}`), {
        onAnswer: result => {
          assert.match(rootElement.querySelector('[data-feedback]').textContent, /Correct!/);
          events.push(`answer:${result.ok}`);
        }
      });
    rootElement.querySelector('[data-answer="0"]').click();
    assert.deepEqual(events, ['answer:true']);
    rootElement.querySelector('[data-question-next]').click();
    assert.deepEqual(events, ['answer:true', 'continue:true']);
  } finally {
    global.document = previousDocument;
  }
});

test('regular and boss battles play feedback on answer selection without a second cue on Continue', () => {
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const adventure = fs.readFileSync(path.join(root, 'src/adventure.js'), 'utf8');
  assert.match(gameplay, /recordWord\(battle\.word, skill, result\.ok, assisted, false\)/);
  assert.match(gameplay, /recordWord\(word, battle\.creature\.attackSkill, result\.ok, false, false\)/);
  assert.equal((gameplay.match(/onAnswer: result => audio\?\.sfx\(result\.ok \? 'correct' : 'wrong'\)/g) || []).length, 2);
  assert.match(adventure, /onAnswer: result => audio\?\.sfx\(result\.ok \? 'correct' : 'wrong'\)/);
});
