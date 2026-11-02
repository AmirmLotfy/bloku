import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const expected = ['ar', 'de', 'en', 'es', 'fr', 'hi', 'ja', 'pt_BR'];
const directory = new URL('./locales/', import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
assert.deepEqual(files, expected.map(locale => `${locale}.json`));

const results = [];
for (const file of files) {
  const copy = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  assert.deepEqual(Object.keys(copy).sort(), ['description', 'screenshotCaptions', 'status', 'summary', 'title']);
  assert.equal(copy.status, 'DRAFT—NOT QUALIFIED');
  for (const key of ['title', 'summary', 'description']) {
    assert.equal(typeof copy[key], 'string');
    assert.equal(copy[key], copy[key].trim());
    assert.ok(copy[key].length > 0);
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(copy[key]));
  }
  // Check both code points and UTF-16 units to keep every draft within the limits.
  assert.ok(copy.title.length <= 75 && [...copy.title].length <= 75);
  assert.ok(copy.summary.length <= 132 && [...copy.summary].length <= 132);
  assert.ok(!copy.title.includes('\n') && !copy.summary.includes('\n'));
  assert.equal(copy.screenshotCaptions.length, 5);
  for (const caption of copy.screenshotCaptions) {
    assert.equal(typeof caption, 'string');
    assert.ok(caption.trim().length > 0 && caption === caption.trim());
    assert.ok(!caption.includes('\n'));
  }
  if (file === 'en.json') {
    assert.equal(copy.title, 'BLOKU — Ad Blocker & Focus');
    assert.equal(copy.summary, 'Block ads and trackers, hide distracting feeds, and schedule focus time. All features free. No account required.');
    assert.equal(copy.summary.length, 112);
  }
  results.push({ locale: file.slice(0, -5), titleCharacters: [...copy.title].length, summaryCharacters: [...copy.summary].length, screenshotCaptions: copy.screenshotCaptions.length });
}
console.log(JSON.stringify({ status: 'DRAFT—NOT QUALIFIED', textValidation: 'passed', locales: results }, null, 2));
