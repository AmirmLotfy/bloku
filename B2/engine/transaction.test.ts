import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EngineTransaction, type EngineDriver } from './transaction';
import type { EngineInput } from './types';

const input: EngineInput = { adsEnabled: true, siteExceptions: [], focusDomains: [], userRules: '', enabledLists: [] };

test('post-mutation failure restores and acknowledges only the last verified state', async () => {
  const configured: string[] = [];
  const driver: EngineDriver = { async initialize() {}, async preflight() {}, async configure(state) { configured.push(state.userRules); if (state.userRules === 'bad') throw new Error('quota exceeded'); } };
  const tx = new EngineTransaction(driver, []);
  assert.equal((await tx.apply(input)).ok, true);
  const failed = await tx.apply({ ...input, userRules: 'bad' });
  assert.equal(failed.ok, false);
  assert.equal(failed.restored, true);
  assert.equal(failed.state?.userRules, '');
  assert.deepEqual(configured, ['', 'bad', '']);
});

test('failed restoration exposes unknown protection rather than false success', async () => {
  let fail = false;
  const driver: EngineDriver = { async initialize() {}, async preflight() {}, async configure() { if (fail) throw new Error('API unavailable'); } };
  const tx = new EngineTransaction(driver, []);
  await tx.apply(input);
  fail = true;
  const failed = await tx.apply(input);
  assert.equal(failed.state, null);
  assert.equal(failed.restored, false);
  assert.equal(failed.errors[1].code, 'engine-restore-failed');
});

test('queued operations serialize across failures', async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  const driver: EngineDriver = { async initialize() {}, async preflight() {}, async configure() { concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent); await new Promise(resolve => setTimeout(resolve, 5)); concurrent--; } };
  const tx = new EngineTransaction(driver, []);
  const results = await Promise.all([tx.apply(input), tx.apply({ ...input, adsEnabled: false }), tx.apply(input)]);
  assert.equal(maxConcurrent, 1);
  assert.deepEqual(results.map(result => result.revision), [1, 2, 3]);
});

test('preflight failure leaves rules untouched', async () => {
  let configured = 0;
  let reject = false;
  const driver: EngineDriver = { async initialize() {}, async preflight() { if (reject) throw new Error('static capacity'); }, async configure() { configured++; } };
  const tx = new EngineTransaction(driver, []);
  await tx.apply(input);
  reject = true;
  const failed = await tx.apply(input);
  assert.equal(configured, 1);
  assert.equal(failed.restored, true);
});
