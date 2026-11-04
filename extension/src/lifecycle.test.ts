import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCALES, type Locale } from './model';
import { lifecycleUrl, openWelcomeOnce } from './lifecycle';

function memoryStorage(initial: Record<string, unknown> = {}) {
  const values = { ...initial };
  return {
    values,
    async get(_keys: string | string[]): Promise<Record<string, unknown>> { return { ...values }; },
    async set(items: Record<string, unknown>) { Object.assign(values, items); },
  };
}

test('welcome and uninstall URLs use all eight fixed locale paths without user data', () => {
  const paths = ['', 'ar/', 'es/', 'pt-br/', 'fr/', 'de/', 'ja/', 'hi/'];
  LOCALES.forEach((locale, index) => {
    for (const page of ['hey', 'bye'] as const) {
      const url = lifecycleUrl(locale, page);
      assert.equal(url, `https://bloku.app/${paths[index]}${page}`);
      const parsed = new URL(url);
      assert.equal(parsed.search, '');
      assert.equal(parsed.hash, '');
      assert.equal(parsed.username, '');
      assert.equal(parsed.password, '');
    }
  });
});

test('runtime values cannot inject locale or page content into lifecycle URLs', () => {
  for (const locale of ['en?uid=private', '../evil', 'https://evil.test', '__proto__', 'constructor', 'pt-br']) {
    assert.throws(() => lifecycleUrl(locale as Locale, 'hey'), RangeError);
  }
  assert.throws(() => lifecycleUrl('en', 'hey?uid=private' as 'hey'), RangeError);
});

test('a first install persists its local flag before opening and never opens twice', async () => {
  const storage = memoryStorage();
  const opened: string[] = [];
  const open = async (url: string) => {
    assert.equal(storage.values.blokuWelcomeV2, true);
    opened.push(url);
  };
  assert.equal(await openWelcomeOnce('install', 'pt_BR', storage, open), true);
  assert.equal(await openWelcomeOnce('install', 'pt_BR', storage, open), false);
  assert.deepEqual(opened, ['https://bloku.app/pt-br/hey']);
  assert.deepEqual(storage.values, { blokuWelcomeV2: true });
});

test('updates, reloads and worker restarts do not read storage or open a page', async () => {
  const unexpected = async (): Promise<never> => { throw new Error('Unexpected lifecycle effect'); };
  for (const reason of ['update', 'chrome_update', 'shared_module_update', 'reload', 'startup', '']) {
    assert.equal(await openWelcomeOnce(reason, 'en', { get: unexpected, set: unexpected }, unexpected), false);
  }
});

test('a persisted welcome flag survives a new helper invocation after worker restart', async () => {
  const storage = memoryStorage({ blokuWelcomeV2: true });
  assert.equal(await openWelcomeOnce('install', 'ar', storage, async () => assert.fail('Opened again')), false);
});

test('storage failure prevents opening the welcome page', async () => {
  const failure = new Error('Storage unavailable');
  const storage = { ...memoryStorage(), async set() { throw failure; } };
  await assert.rejects(openWelcomeOnce('install', 'en', storage, async () => assert.fail('Opened without persistence')), failure);
});

test('failed tab creation stays recorded and cannot loop on another install callback', async () => {
  const storage = memoryStorage();
  const failure = new Error('Tab creation failed');
  let attempts = 0;
  const open = async () => { attempts += 1; throw failure; };
  await assert.rejects(openWelcomeOnce('install', 'en', storage, open), failure);
  assert.equal(await openWelcomeOnce('install', 'en', storage, open), false);
  assert.equal(attempts, 1);
  assert.deepEqual(storage.values, { blokuWelcomeV2: true });
});

test('invalid install locale neither records welcome nor opens a page', async () => {
  const storage = memoryStorage();
  await assert.rejects(openWelcomeOnce('install', '../../evil' as Locale, storage, async () => assert.fail('Opened invalid locale')), RangeError);
  assert.deepEqual(storage.values, {});
});
