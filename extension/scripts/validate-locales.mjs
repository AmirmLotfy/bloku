import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const directory = new URL('../src/locales/', import.meta.url);
const english = JSON.parse(await readFile(new URL('en.json', directory), 'utf8'));
const sharedWords = {
  ar: ['shorts'],
  es: ['shorts', 'feed', 'reels'],
  pt_BR: ['shorts', 'feed', 'reels', 'stories'],
  fr: ['protection', 'distractions', 'version', 'shorts', 'reels', 'stories', 'minutes'],
  de: ['version', 'shorts', 'trends', 'feed', 'reels'],
  ja: [],
  hi: ['shorts'],
};
const placeholders = value => value.match(/\{[^{}]+\}|\$\w+\$|%\d*\$?[sd]/gu) ?? [];
const results = [];
for (const [locale, shared] of Object.entries(sharedWords)) {
  const translated = JSON.parse(await readFile(new URL(`${locale}.json`, directory), 'utf8'));
  assert.deepEqual(Object.keys(translated), Object.keys(english), `${locale}: incomplete or reordered keys`);
  for (const [key, value] of Object.entries(translated)) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0 && value === value.trim(), `${locale}.${key}: empty or padded`);
    assert.ok(!/[\u0000-\u001f\ufffd]/u.test(value), `${locale}.${key}: control/replacement characters`);
    assert.deepEqual(placeholders(value), placeholders(english[key]), `${locale}.${key}: placeholder mismatch`);
    for (const brand of ['BLOKU', 'Chrome', 'YouTube', 'AdGuard', 'GPL-3.0', 'JSON', 'CSS', 'Global Privacy Control']) {
      if (english[key].includes(brand)) assert.ok(value.includes(brand), `${locale}.${key}: missing ${brand}`);
    }
    if (value === english[key]) assert.ok(shared.includes(key), `${locale}.${key}: possible English fallback`);
  }
  assert.ok(translated.name.length <= 75 && [...translated.name].length <= 75);
  assert.ok(translated.summary.length <= 132 && [...translated.summary].length <= 132);
  results.push({ locale, keys: Object.keys(translated).length, titleCharacters: [...translated.name].length, summaryCharacters: [...translated.summary].length });
}
console.log(JSON.stringify({ textValidation: 'passed', scope: 'UI locale structure, not runtime or native-speaker acceptance', locales: results }, null, 2));
