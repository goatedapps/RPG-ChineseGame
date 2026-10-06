const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('native wayfinding panels work without scripts and start expanded', () => {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'));
  const document = dom.window.document;
  const objective = document.getElementById('objective-toggle');
  const map = document.getElementById('guide-map-toggle');
  for (const button of [objective, map]) {
    assert.equal(button.tagName, 'SUMMARY');
    assert.equal(button.parentElement.tagName, 'DETAILS');
    assert.equal(button.parentElement.open, true);
    assert.doesNotMatch(button.textContent, /Collapse|Expand|pinned on map/);
    assert.ok(button.querySelector('.wayfinding-chevron[aria-hidden="true"]'));
  }
  objective.click();
  assert.equal(objective.parentElement.open, false);
  assert.equal(map.parentElement.open, true);
  map.click();
  assert.equal(map.parentElement.open, false);
  document.getElementById('objective-text').textContent = 'Visit the School.';
  document.getElementById('guide-map-heading').textContent = 'Route map';
  document.getElementById('route-zone-label').textContent = 'Mistwood Edge · Lesson 1';
  document.getElementById('guide-map').hidden = false;
  assert.equal(map.parentElement.open, false, 'world renders must not reopen a collapsed map');
  for (const button of [objective, map]) {
    button.click();
    assert.equal(button.parentElement.open, true);
  }
  assert.equal(document.getElementById('objective-text').textContent, 'Visit the School.');
  assert.equal(document.getElementById('guide-map-heading').textContent, 'Route map');
  assert.equal(document.getElementById('route-zone-label').textContent, 'Mistwood Edge · Lesson 1');
  dom.window.close();
});

test('wayfinding disclosures have touchable headers and compact closed styles', () => {
  const stage = fs.readFileSync('css/wayfinding.css', 'utf8');
  const atlas = stage;
  assert.match(stage, /\.wayfinding-toggle \{[^}]*min-height: 44px[^}]*pointer-events: auto/);
  assert.match(stage, /\.guide-map:not\(\[open\]\) \{[^}]*width: max-content/);
  assert.match(atlas, /\.atlas-enabled \.objective:not\(\[open\]\) \{[^}]*width: max-content/);
  assert.match(stage, /\.objective:not\(\[open\]\) > :not\(summary\).*display: none/);
});
