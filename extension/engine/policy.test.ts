import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compilePolicy, normalizeInput, MAX_USER_RULE_BYTES } from './policy';
import type { EngineInput, PackagedList } from './types';

const lists: PackagedList[] = [{ id: 'base', filterId: 2, name: 'Base', ruleCount: 10, focusOverrideRules: ['@@||parent.test^$document,important'] }];
const base: EngineInput = { adsEnabled: true, enabledLists: ['base'], siteExceptions: [], focusDomains: [], userRules: '' };

test('focus constrains important exceptions through SDK badfilter and to modifiers', () => {
  const input = { ...base, focusDomains: ['child.parent.test'], siteExceptions: ['parent.test'], userRules: '@@||parent.test^$important,to=parent.test|~other.test' };
  const result = compilePolicy(input, lists);
  assert.match(result.content, /@@\|\|parent\.test\^\$document,important,badfilter/);
  assert.match(result.content, /@@\$document,important,to=parent\.test\|~child\.parent\.test/);
  assert.match(result.content, /to=parent\.test\|~other\.test\|~child\.parent\.test/);
  assert.match(result.content, /\|\|child\.parent\.test\^\$document,important/);
  assert.equal(input.userRules, '@@||parent.test^$important,to=parent.test|~other.test');
});

test('pausing ads leaves only separately enabled focus rules', () => {
  const result = compilePolicy({ ...base, adsEnabled: false, userRules: '||ads.test^', siteExceptions: ['parent.test'], focusDomains: ['focus.test'] }, lists);
  assert.deepEqual(result, { content: '||focus.test^$document,important', filterIds: [] });
});

test('all user badfilter permutations are rejected during focus without changing source', () => {
  for (const userRules of ['||focus.test^$important,document,badfilter', '||focus.test^$badfilter,document,important']) {
    assert.throws(() => compilePolicy({ ...base, focusDomains: ['focus.test'], userRules }, lists), /badfilter overrides/);
  }
});

test('local executable and cookie rules are rejected before engine invocation', () => {
  for (const userRules of ['site.test#%#alert(1)', 'site.test##+js(set, hello, true)', '||site.test^$cookie=tracking', 'site.test#$#body { background:url(https://remote.test) }']) {
    assert.throws(() => compilePolicy({ ...base, userRules }, lists));
  }
  assert.doesNotThrow(() => compilePolicy({ ...base, userRules: 'site.test##.advertisement\n||ads.test^$script,third-party' }, lists));
});

test('bounded configuration rejects oversized text, unknown lists and malformed hostnames', () => {
  assert.throws(() => normalizeInput({ ...base, userRules: 'a'.repeat(MAX_USER_RULE_BYTES + 1) }, lists));
  assert.throws(() => normalizeInput({ ...base, enabledLists: ['remote-url'] }, lists));
  assert.throws(() => normalizeInput({ ...base, focusDomains: ['site.test/path'] }, lists));
  assert.throws(() => normalizeInput({ ...base, focusDomains: new Array(201).fill('site.test') }, lists));
  assert.deepEqual(normalizeInput({ ...base, siteExceptions: ['EXAMPLE.com', 'example.com'] }, lists).siteExceptions, ['example.com']);
});
