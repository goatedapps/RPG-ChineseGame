import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const generatedRoot = path.join(projectRoot, 'content', 'generated');
const dataRoot = path.join(projectRoot, 'node_modules', 'hanzi-writer-data');
const isHanzi = character => /\p{Script=Han}/u.test(character);

for (const file of fs.readdirSync(generatedRoot).filter(file => file.endsWith('.content.json')).sort()) {
  const content = JSON.parse(fs.readFileSync(path.join(generatedRoot, file), 'utf8'));
  const characters = [...new Set(content.words.flatMap(word => [...word.w]).filter(isHanzi))].sort();
  const data = {};
  const missing = [];
  for (const character of characters) {
    const characterFile = path.join(dataRoot, `${character}.json`);
    if (!fs.existsSync(characterFile)) {
      missing.push(character);
      continue;
    }
    const characterData = JSON.parse(fs.readFileSync(characterFile, 'utf8'));
    delete characterData.radStrokes;
    data[character] = characterData;
  }
  if (missing.length) throw new Error(`${content.level}: missing Hanzi Writer data for ${missing.join(' ')}`);
  const outputFile = path.join(generatedRoot, `${content.level}.chars.json`);
  fs.writeFileSync(outputFile, `${JSON.stringify({ schemaVersion: 1, level: content.level, characters: data })}\n`);
  console.log(`${content.level}: wrote local stroke data for ${characters.length} characters.`);
}
