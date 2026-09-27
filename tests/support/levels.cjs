const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'content/authored/shared/levels.json'), 'utf8'));
const playableLevels = registry.filter(level => level.worldMappingReady);
const playableIds = playableLevels.map(level => level.id);

module.exports = { registry, playableLevels, playableIds };
