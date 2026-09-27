const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('route pavilions and onward gates reuse the illustrated building sheet', async () => {
  const OriginalImage = globalThis.Image;
  const images = [];
  globalThis.Image = class {
    complete = true;
    naturalWidth = 1024;
    set src(value) { this.url = value; images.push(this); }
  };
  try {
    const { createRenderer } = await import('../src/world/renderer.js');
    const drawings = [];
    const context = new Proxy({}, {
      get(target, key) {
        if (key === 'measureText') return value => ({ width: value.length * 8 });
        if (key === 'drawImage') return (...args) => drawings.push(args);
        return target[key] ?? (() => {});
      },
      set(target, key, value) { target[key] = value; return true; }
    });
    const map = {
      route: true, region: 'r1', width: 20, height: 20,
      legend: { p: { color: '#c9ac69', walkable: true } },
      tiles: Array(20).fill('p'.repeat(20)), zones: [],
      objects: [
        { id: 'boss-pavilion-building', type: 'building', name: 'Muddle Pavilion', rect: { x: 3, y: 3, width: 5, height: 4 }, door: { x: 5, y: 7 } },
        { id: 'next-region-gate', type: 'sign', x: 12, y: 12 }
      ]
    };
    const canvas = { width: 640, height: 640, getContext: () => context };
    createRenderer(canvas, map).render({ player: { x: 1, y: 1, direction: 'up' }, progress: { routes: {} } });
    const sheet = images.find(image => image.url.endsWith('/buildings.webp'));
    assert.ok(sheet, 'battlefield should preload the reusable building sheet');
    assert.ok(drawings.some(([image, sourceX, sourceY]) => image === sheet && sourceX === 512 && sourceY === 256), 'pavilion should use the pavilion sprite');
    assert.ok(drawings.some(([image, sourceX, sourceY]) => image === sheet && sourceX === 768 && sourceY === 256), 'gate should use the gate sprite');
  } finally {
    globalThis.Image = OriginalImage;
  }
});

test('primary left-menu and building panels share the Atlas header treatment', () => {
  const overlay = fs.readFileSync('src/ui/overlay.js', 'utf8');
  const gameplay = fs.readFileSync('src/gameplay.js', 'utf8');
  const styles = fs.readFileSync('css/stage.css', 'utf8');
  assert.match(overlay, /panel\.classList\.add\('atlas-window'\)/);
  for (const panel of ['school-panel', 'dictation-picker', 'reading-panel', 'inn-welcome', 'parent-access-panel']) {
    assert.match(gameplay, new RegExp(`class=\\"panel ${panel}\\"`));
  }
  assert.match(styles, /\.atlas-window > \.panel-header/);
  assert.match(styles, /word-spirit-logo\.webp/);
});
