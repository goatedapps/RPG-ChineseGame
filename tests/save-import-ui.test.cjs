const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('save files can be read on browsers with or without File.text', async () => {
  const { readSaveFile } = await import('../src/ui/saveTransfer.js');
  assert.equal(await readSaveFile({ text: async () => '{"save":1}' }), '{"save":1}');
  class Reader {
    readAsText(file) { this.result = file.content; this.onload(); }
  }
  assert.equal(await readSaveFile({ content: '{"save":2}' }, Reader), '{"save":2}');
  assert.equal(await readSaveFile({ text: async () => { throw new Error('unsupported'); }, content: '{"save":3}' }, Reader), '{"save":3}');
  await assert.rejects(readSaveFile(null), /Choose a Word Spirit Quest save file/);
});

test('import uses a native picker, confirms replacement, and reloads the saved map', () => {
  const gameplay = fs.readFileSync(path.join(root, 'src/gameplay.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(gameplay, /<label class="secondary save-import-picker">Import save<input data-import-save type="file"/);
  assert.doesNotMatch(gameplay, /data-import-trigger/);
  assert.match(gameplay, /data-import-confirm/);
  assert.match(main, /function importCurrentLevelSave\(state\)/);
  assert.match(main, /saveLevelState\(storage, state\);\s*window\.location\.reload\(\)/);
  assert.match(serviceWorker, /src\/ui\/saveTransfer\.js/);
});
