import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import http from 'node:http';

// This is a browser-local fixture qualification, not a Chrome Web Store update test.
// Never import product source here: only the selected immutable package is executed.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.dirname(root);
const FROZEN_CHECKSUMS = '41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2';
const retiredKeys = ['licenseKey', 'expiresAt', 'plan', 'subscriptionId', 'polarSubscriptionId', 'licenseValidatedAt', 'userEmail', 'deviceId', 'premiumJustActivated', 'premiumDeactivatedReason'];
const appKeys = ['blokuV2', 'settings', 'distractionRules', 'distractionPresets', 'stats', 'dailyHistory', 'migrationFixtureMarker', ...retiredKeys];
const sharedLegacy = {
  settings: { blockingEnabled: false, layers: { network: true }, theme: 'dark', whitelistedDomains: ['https://www.allow.bloku.test/path', 'sub.allow.bloku.test', 'bad domain'], privacyShield: true },
  distractionRules: { 'https://www.news.bloku.test/story': ['#legacy-hide', '#legacy-hide', '.legacy-panel'] },
  distractionPresets: { 'youtube.com': ['shorts', 'comments', 'shorts'] },
  stats: { adsBlocked: 17, dataSaved: 2048, negativeEstimate: -1 },
  dailyHistory: { '2026-10-01': { adsBlocked: 3 } },
  migrationFixtureMarker: 'SYNTHETIC-BROWSER-LOCAL-FIXTURE',
};
const identifiers = status => ({ licenseKey: `SYNTHETIC-${status}-NOT-A-REAL-LICENSE`, expiresAt: status === 'expired' ? '2020-01-01T00:00:00.000Z' : '2099-01-01T00:00:00.000Z', plan: 'annual', subscriptionId: `synthetic-${status}-subscription`, polarSubscriptionId: `synthetic-${status}-polar-subscription`, licenseValidatedAt: 1234567890, userEmail: `synthetic-${status}@example.invalid`, deviceId: `synthetic-${status}-device`, premiumJustActivated: status === 'active', premiumDeactivatedReason: status === 'expired' ? 'synthetic-expired' : '' });
const fixtureCases = [
  { name: 'fresh', input: {}, expected: { theme: 'system', adsEnabled: true, sourceVersion: 2 } },
  { name: 'legacy-free', input: structuredClone(sharedLegacy), expected: { theme: 'dark', adsEnabled: false, sourceVersion: 1 } },
  { name: 'legacy-active-premium', input: { ...structuredClone(sharedLegacy), ...identifiers('active'), settings: { ...structuredClone(sharedLegacy.settings), blockingEnabled: true, layers: { network: false }, theme: 'light' } }, expected: { theme: 'light', adsEnabled: false, sourceVersion: 1 } },
  { name: 'legacy-expired-premium', input: { ...structuredClone(sharedLegacy), ...identifiers('expired'), settings: { ...structuredClone(sharedLegacy.settings), blockingEnabled: true, layers: { network: true } } }, expected: { theme: 'dark', adsEnabled: true, sourceVersion: 1 } },
  { name: 'malformed-v2', input: { ...structuredClone(sharedLegacy), ...identifiers('malformed'), blokuV2: { schemaVersion: 2, preferences: { adsEnabled: 'invalid-synthetic-value' } } }, error: /Unsupported settings format|Invalid preference/ },
  { name: 'future-schema', input: { ...structuredClone(sharedLegacy), ...identifiers('future'), blokuV2: { schemaVersion: 3, opaque: { preserve: 'SYNTHETIC-FUTURE-STATE' } } }, error: /Unknown settings version/ },
];
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(value).digest('hex');
const fixturesSha256 = hash(canonical(fixtureCases.map(({ name, input, expected, error }) => ({ name, input, expected, expectedError: error?.source }))));
if (!process.argv.includes('--run')) {
  console.log(JSON.stringify({ status: 'READY — NOT RUN', command: 'node B2/scripts/v2-migration-check.mjs --run', fixtures: fixtureCases.map(f => f.name), fixturesSha256, expectedChecksumsSha256: FROZEN_CHECKSUMS, note: 'Run only after the coordinator explicitly grants the heavy browser lane.' }, null, 2));
  process.exit(0);
}

const extension = process.env.BLOKU_EXTENSION_PATH ? path.resolve(process.env.BLOKU_EXTENSION_PATH) : path.join(root, 'dist');
const expectedChecksums = process.env.BLOKU_EXPECTED_CHECKSUMS_SHA256 ?? FROZEN_CHECKSUMS;
assert.match(expectedChecksums, /^[a-f0-9]{64}$/);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'artifacts/migration-qualification', runId);
const privateProfiles = path.join(root, 'engine/.cache', `migration-${runId}`);
const reportFile = path.join(repositoryRoot, 'docs/MIGRATION_REPORT.md');
const publicPath = value => { const relative = path.relative(repositoryRoot, value); return relative.startsWith('..') ? '<BLOKU_EXTENSION_PATH>' : relative.split(path.sep).join('/'); };
const checksumBytes = await readFile(path.join(extension, 'checksums.json'));
assert.equal(hash(checksumBytes), expectedChecksums, 'Selected package is not the explicitly frozen/expected input');
const packageChecksums = JSON.parse(checksumBytes);
const manifestBytes = await readFile(path.join(extension, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.version, '2.0.0');
assert.ok(manifest.background?.service_worker, 'Actual package must declare a service worker');
for (const [relative, expected] of Object.entries(packageChecksums)) {
  assert.ok(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..'), 'Invalid packaged checksum path');
  assert.equal(hash(await readFile(path.join(extension, relative))), expected, `Package input checksum mismatch: ${relative}`);
}
const browserCache = path.join(root, 'engine/.cache/browser/chrome');
const build = (await readdir(browserCache)).filter(name => name.includes('156.')).sort().at(-1);
assert.ok(process.env.BLOKU_CHROME_PATH || build, 'Chrome for Testing 156 must be installed or explicitly selected');
const executablePath = process.env.BLOKU_CHROME_PATH ?? path.join(browserCache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
await mkdir(output, { recursive: true });
await mkdir(privateProfiles, { recursive: true });
const publicFixtures = fixtureCases.map(({ name, input, expected, error }) => ({ name, input, expected, expectedError: error?.source, inputSha256: hash(canonical(input)) }));
await writeFile(path.join(output, 'fixtures.json'), JSON.stringify({ fixturesSha256, fixtures: publicFixtures }, null, 2)+'\n');
const results = [], networkAttempts = [], cleanupErrors = [], proxyDeniedRequests = [];
let browserVersion, currentFixture = 'setup';
const sanitize = value => String(value).replaceAll(executablePath, '<ChromeForTesting>').replaceAll(repositoryRoot, '<repository>');
// Never forward proxy traffic. This also blocks direct-IP HTTP(S) before it can leave Chrome.
const denyingProxy = http.createServer((request, response) => {
  try { const url = new URL(request.url); proxyDeniedRequests.push({ fixture: currentFixture, origin: url.origin, pathname: url.pathname, transport: 'HTTP', denied: true }); } catch { proxyDeniedRequests.push({ fixture: currentFixture, transport: 'HTTP', denied: true }); }
  response.writeHead(403, { 'Content-Type': 'text/plain', Connection: 'close' }); response.end('External network disabled for local migration qualification.');
});
denyingProxy.on('connect', (_request, socket) => { proxyDeniedRequests.push({ fixture: currentFixture, transport: 'CONNECT', denied: true }); socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); });
await new Promise((resolve, reject) => { denyingProxy.once('error', reject); denyingProxy.listen(0, '127.0.0.1', resolve); });
const proxyPort = denyingProxy.address().port;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(operation, label, timeout = 30000) { let timer; try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeout}ms`)), timeout); })]); } finally { clearTimeout(timer); } }
async function until(operation, label, timeout = 15000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await operation()) return; await delay(100); } throw new Error(`${label} exceeded ${timeout}ms`); }

async function runCase(fixture) {
  currentFixture = fixture.name;
  const profile = path.join(privateProfiles, fixture.name);
  const result = { name: fixture.name, inputSha256: hash(canonical(fixture.input)), pass: false, checks: [], restarts: 0, errors: [] };
  results.push(result);
  let browser, options, control, versions = new Map(), extensionId, stopping = false;
  const inspections = new Map(), workerSessions = new Set();
  const check = (condition, name) => { assert.ok(condition, `${fixture.name}: ${name}`); result.checks.push(name); };
  const equal = (actual, expected, name) => { assert.equal(canonical(actual), canonical(expected), `${fixture.name}: ${name}`); result.checks.push(name); };
  async function inspect(target) {
    if (inspections.has(target)) return inspections.get(target);
    const task = (async () => {
      if (!['page', 'service_worker'].includes(target.type()) || (stopping && target.type() === 'service_worker')) return;
      const session = await target.createCDPSession();
      if (target.type() === 'service_worker') workerSessions.add(session);
      session.on('Fetch.requestPaused', async event => {
        const url = new URL(event.request.url);
        networkAttempts.push({ fixture: fixture.name, origin: url.origin, pathname: url.pathname, blocked: true });
        await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => undefined);
      });
      await session.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
    })();
    inspections.set(target, task);
    return task;
  }
  async function send(action, payload) { return bounded(options.evaluate(({ action, payload }) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), { action, payload }), action, 45000); }
  async function appStorage() { return options.evaluate(keys => chrome.storage.local.get(keys), appKeys); }
  async function restart() {
    const running = [...versions.values()].find(value => value.scriptURL?.startsWith(`chrome-extension://${extensionId}/`) && value.runningStatus === 'running');
    assert.ok(running, `${fixture.name}: running production worker must be observable before stop`);
    stopping = true;
    await Promise.allSettled([...workerSessions].map(session => session.detach()));
    workerSessions.clear();
    await bounded(control.send('ServiceWorker.stopWorker', { versionId: running.versionId }), 'Explicit worker stop');
    await until(() => versions.get(running.versionId)?.runningStatus === 'stopped', 'CDP confirmation of actual worker termination');
    result.restarts++;
    // ServiceWorker domain on the page is not a worker debugger; detach it too before waking.
    await control.detach();
    const reply = await send('GET_STATE');
    stopping = false;
    for (const target of browser.targets().filter(target => target.type() === 'service_worker')) { inspections.delete(target); await inspect(target); }
    control = await options.createCDPSession();
    versions = new Map();
    control.on('ServiceWorker.workerVersionUpdated', event => { for (const version of event.versions) versions.set(version.versionId, version); });
    await control.send('ServiceWorker.enable');
    await until(() => [...versions.values()].some(value => value.scriptURL?.startsWith(`chrome-extension://${extensionId}/`) && value.runningStatus === 'running'), 'Worker wake after trusted options message');
    return reply;
  }
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, protocolTimeout: 60000, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-quic', '--lang=en-US', '--host-resolver-rules=MAP * ~NOTFOUND', `--proxy-server=http://127.0.0.1:${proxyPort}`, '--proxy-bypass-list=<-loopback>'] });
    browserVersion = await browser.version();
    assert.match(browserVersion, /Chrome\/156\./, 'Migration qualification requires the declared CFT 156 browser');
    browser.on('targetcreated', target => { void inspect(target).catch(error => { if (!stopping) result.errors.push(`Instrumentation: ${sanitize(error.message)}`); }); });
    for (const target of browser.targets()) await inspect(target);
    const workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'), { timeout: 30000 });
    extensionId = new URL(workerTarget.url()).hostname;
    options = await browser.newPage(); await inspect(options.target());
    options.setDefaultTimeout(20000);
    await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const warm = await send('GET_STATE');
    check(warm?.ok && warm.state && warm.engine?.ok, `unmodified package starts before ${fixture.name} is seeded`);
    check(await options.evaluate(() => chrome.runtime.getManifest().version === '2.0.0'), 'observed installed manifest version is 2.0.0');
    control = await options.createCDPSession();
    control.on('ServiceWorker.workerVersionUpdated', event => { for (const version of event.versions) versions.set(version.versionId, version); });
    await control.send('ServiceWorker.enable');
    await until(() => [...versions.values()].some(value => value.scriptURL?.startsWith(`chrome-extension://${extensionId}/`) && value.runningStatus === 'running'), 'Initial worker version inspection');
    // Seed only known application keys. The v2 warm-start SDK cache is deliberately retained.
    await options.evaluate(async ({ appKeys, input }) => {
      await chrome.storage.local.remove(appKeys);
      await chrome.storage.session.remove(['blokuNavigationStarts', 'blokuActivityObservation']);
      if (Object.keys(input).length) await chrome.storage.local.set(input);
    }, { appKeys, input: fixture.input });
    equal(await appStorage(), fixture.input, 'trusted options context seeded exact synthetic application storage');
    const reply = await restart();
    const stored = await appStorage();
    if (fixture.error) {
      check(reply?.ok && reply.recoveryAvailable === true && reply.state === null && reply.engine?.ok === false, 'malformed/future state enters explicit recovery without claiming filtering success');
      check(fixture.error.test(reply.error ?? ''), 'recovery error identifies malformed or unsupported schema');
      equal(stored, fixture.input, 'failed migration preserves original state and every synthetic identifier');
      const recovery = await send('EXPORT_RECOVERY');
      check(recovery?.ok && typeof recovery.recovery === 'string', 'trusted recovery export remains available after initialization failure');
      const parsed = JSON.parse(recovery.recovery);
      check(parsed.format === 'bloku-recovery' && parsed.version === 2, 'recovery export uses its explicit non-settings format');
      for (const key of ['blokuV2', 'settings', 'distractionRules', 'distractionPresets', 'stats', 'dailyHistory']) equal(parsed.data[key], fixture.input[key], `recovery preserves ${key}`);
      for (const key of retiredKeys) check(!(key in parsed.data), `recovery does not publish identifier ${key}`);
      equal(await appStorage(), fixture.input, 'recovery export does not mutate failed-migration storage');
    } else {
      check(reply?.ok && reply.state && reply.engine?.ok, 'worker migration and filtering initialization are confirmed');
      const state = reply.state;
      equal(state.preferences.theme, fixture.expected.theme, 'theme preserved/defaulted');
      equal(state.preferences.adsEnabled, fixture.expected.adsEnabled, 'legacy enabled/network-layer choice preserved');
      equal(state.migration.sourceVersion, fixture.expected.sourceVersion, 'migration source version is correct');
      for (const key of ['rejectConsent', 'cleanUrls', 'gpc', 'activityEnabled', 'disableAutoplay']) equal(state.preferences[key], false, `new optional ${key} stays off`);
      equal(state.preferences.listIds, ['base', 'privacy'], 'free packaged filter choices do not depend on synthetic entitlement');
      if (fixture.name === 'fresh') {
        equal(state.sitePolicies, [], 'fresh site policies are empty'); equal(state.distractionRules, {}, 'fresh saved hides are empty'); equal(state.distractionPresets, {}, 'fresh presets are empty');
      } else {
        equal(state.sitePolicies, [{ domain: 'allow.bloku.test', adsPausedUntil: null }, { domain: 'sub.allow.bloku.test', adsPausedUntil: null }], 'user exceptions normalized without adding blanket exceptions');
        equal(state.distractionRules, { 'news.bloku.test': ['#legacy-hide', '.legacy-panel'] }, 'saved element selectors preserved and deduplicated');
        equal(state.distractionPresets, { 'youtube.com': ['shorts', 'comments'] }, 'saved distraction presets preserved and deduplicated');
        equal(state.legacyEstimates, { label: 'Legacy v1 estimates', stats: { adsBlocked: 17, dataSaved: 2048 }, dailyHistory: fixture.input.dailyHistory }, 'old statistics preserved only as labeled legacy estimates');
        equal(stored.settings, fixture.input.settings, 'legacy settings retained as recovery source');
        equal(stored.migrationFixtureMarker, fixture.input.migrationFixtureMarker, 'unrelated synthetic marker retained');
      }
      for (const key of retiredKeys) check(!(key in stored), `retired identifier ${key} removed after successful persistence`);
      equal(stored.blokuV2, state, 'Chrome storage read-back equals the returned migrated state semantically');
      await options.reload({ waitUntil: 'domcontentloaded' });
      await options.waitForFunction(() => document.querySelector('.badge')?.textContent === 'All features free');
      check(true, 'actual options UI presents free features without license activation');
      const repeated = await restart();
      check(repeated?.ok && repeated.engine?.ok, 'second worker restart initializes normally');
      equal(repeated.state, state, 'repeated migration leaves full v2 state unchanged, including migration timestamp');
      equal(await appStorage(), stored, 'repeated migration leaves complete application storage unchanged');
    }
    check(result.errors.length === 0, 'no instrumentation failures were hidden');
    check(networkAttempts.filter(attempt => attempt.fixture === fixture.name).length === 0, 'no observed HTTP billing, licensing or telemetry request attempted');
    result.pass = true;
    console.log(`PASS ${fixture.name}: ${result.checks.length} assertions; ${result.restarts} explicit worker restarts`);
  } catch (error) {
    result.error = sanitize(error); result.stack = sanitize(error.stack);
    console.error(`FAIL ${fixture.name}: ${error.stack || error}`);
    throw error; // Stop at the first failed fixture; never continue an uncertain migration.
  } finally {
    stopping = true;
    await Promise.allSettled([...workerSessions].map(session => session.detach()));
    await control?.detach().catch(() => undefined);
    if (browser) {
      try { await bounded(browser.close(), 'Owned browser cleanup', 15000); }
      catch (error) { browser.process()?.kill('SIGKILL'); cleanupErrors.push({ fixture: fixture.name, error: sanitize(error.message) }); }
    }
    await rm(profile, { recursive: true, force: true });
  }
}
let failure;
try { for (const fixture of fixtureCases) await runCase(fixture); }
catch (error) { failure = error; }
finally {
  denyingProxy.closeAllConnections(); await new Promise(resolve => denyingProxy.close(resolve));
  await rm(privateProfiles, { recursive: true, force: true });
  let immutable = hash(await readFile(path.join(extension, 'checksums.json'))) === expectedChecksums;
  for (const [relative, expected] of Object.entries(packageChecksums)) immutable &&= hash(await readFile(path.join(extension, relative))) === expected;
  const complete = !failure && results.length === fixtureCases.length && results.every(result => result.pass) && cleanupErrors.length === 0 && immutable;
  const report = { status: complete ? 'PASS — BROWSER-LOCAL SEEDED STATE ONLY' : 'FAIL — NOT QUALIFIED', observedAt: new Date().toISOString(), browser: browserVersion ?? 'not observed', manifestVersion: manifest.version, extensionInput: publicPath(extension), checksumsSha256: expectedChecksums, manifestSha256: hash(manifestBytes), runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))), fixturesSha256, packageFilesVerified: Object.keys(packageChecksums).length, packageUnchanged: immutable, results, blockedHttpAttempts: networkAttempts, deniedProxyTransportRequests: proxyDeniedRequests, cleanupErrors, limits: ['This executes the actual verified package in isolated CFT 156 profiles, one browser at a time.', 'Legacy application storage is seeded from a trusted v2 options page after a fresh v2 startup; SDK caches from that warm startup remain.', 'Synthetic active/expired identifiers are inert fixtures, not real entitlements. No original 1.1.3 binary, license server or customer state is used.', 'This is not a Chrome Web Store 1.1.3-to-2.0 update, permission/re-enable UX, old-binary write compatibility, or v1 downgrade test.', 'Worker inspection sessions are detached before explicit worker stop; a trusted options message wakes migration. New worker initial network monitoring has an attachment gap.', 'All browser HTTP(S) is routed through a task-owned loopback proxy that denies every HTTP/CONNECT request without forwarding. All host resolution maps to NOTFOUND, and observed HTTP requests are additionally blocked. No external site or HTTP fixture is used.', 'No real billing/account/donation operation, deployment or store submission is performed.'] };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2)+'\n');
  const rows = results.map(result => `| ${result.pass ? 'PASS' : 'FAIL'} | ${result.name} | ${result.checks.length} | ${result.restarts} | ${result.error ? result.error.replaceAll('|', '\\|').replaceAll('\n', ' ') : '—'} |`).join('\n');
  await writeFile(reportFile, (await readFile(reportFile, 'utf8')) + `\n\n## Browser-local seeded migration run — ${report.observedAt}\n\n**${report.status}**. Observed browser: ${report.browser}; installed version: ${manifest.version}. Verified package input: \`${report.extensionInput}\`; checksums manifest SHA-256: \`${expectedChecksums}\`; runner SHA-256: \`${report.runnerSha256}\`; fixture manifest SHA-256: \`${fixturesSha256}\`. All ${report.packageFilesVerified} package files were checked before execution; unchanged afterward: ${immutable}.\n\n| Result | Synthetic input | Assertions completed | Explicit worker restarts | Failure |\n| --- | --- | --- | --- | --- |\n${rows}\n\nSanitized fixtures and machine results: \`${publicPath(output)}/fixtures.json\` and \`${publicPath(output)}/results.json\`. All fixture values are synthetic. Private browser profiles are removed and are not report artifacts.\n\n${report.limits.map(limit => `- ${limit}`).join('\n')}\n\nObserved extension/page HTTP attempts blocked: ${networkAttempts.length}. Browser transport requests denied by the loopback proxy: ${proxyDeniedRequests.length}. Cleanup errors: ${cleanupErrors.length}. A bounded browser-local pass does not qualify actual Store-update or permission UX.\n`);
  console.log(JSON.stringify({ status: report.status, completedFixtures: results.length, expectedFixtures: fixtureCases.length, output: publicPath(output) }));
  if (!complete) process.exitCode = 1;
}
