import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm, cp, statfs, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';

// Public, logged-out qualification only. This script never builds or modifies
// application source/dist and must only run after the coordinator grants the
// browser lane. --prepare downloads/extracts verified official archives only.
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'engine/.cache/public-comparison');
const artifacts = path.join(root, 'artifacts/public-qualification');
const reportFile = path.join(root, '../docs/PUBLIC_QUALIFICATION.md');
const args = new Set(process.argv.slice(2));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanUrl = value => { try { const url = new URL(value); return `${url.origin}${url.pathname}`; } catch { return String(value).slice(0, 200); } };
const median = values => { const xs = values.filter(Number.isFinite).sort((a, b) => a - b); return xs.length ? (xs[Math.floor((xs.length - 1) / 2)] + xs[Math.ceil((xs.length - 1) / 2)]) / 2 : null; };
const rounded = (value, digits = 1) => value === null || value === undefined || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

export const SITES = [
  ['bbc', 'news', 'https://www.bbc.com/news'],
  ['guardian', 'news', 'https://www.theguardian.com/international'],
  ['reuters', 'news', 'https://www.reuters.com/'],
  ['ap', 'news', 'https://apnews.com/'],
  ['npr', 'news', 'https://www.npr.org/'],
  ['aljazeera', 'news', 'https://www.aljazeera.com/'],
  ['cnn', 'news', 'https://www.cnn.com/'],
  ['nytimes', 'news', 'https://www.nytimes.com/'],
  ['amazon', 'ecommerce', 'https://www.amazon.com/'],
  ['ebay', 'ecommerce', 'https://www.ebay.com/'],
  ['etsy', 'ecommerce', 'https://www.etsy.com/'],
  ['walmart', 'ecommerce', 'https://www.walmart.com/'],
  ['ikea', 'ecommerce', 'https://www.ikea.com/'],
  ['bestbuy', 'ecommerce', 'https://www.bestbuy.com/'],
  ['notion', 'productivity', 'https://www.notion.com/'],
  ['figma', 'productivity', 'https://www.figma.com/'],
  ['linear', 'productivity', 'https://linear.app/'],
  ['trello', 'productivity', 'https://trello.com/'],
  ['google-docs', 'productivity', 'https://www.google.com/docs/about/'],
  ['youtube', 'video', 'https://www.youtube.com/watch?v=jNQXAC9IVRw'],
  ['vimeo', 'video', 'https://vimeo.com/watch'],
  ['twitch', 'video', 'https://www.twitch.tv/directory'],
  ['dailymotion', 'video', 'https://www.dailymotion.com/'],
  ['archive-video', 'video', 'https://archive.org/details/movies'],
  ['reddit', 'social', 'https://www.reddit.com/r/technology/'],
  ['x', 'social', 'https://x.com/explore'],
  ['instagram', 'social', 'https://www.instagram.com/'],
  ['bluesky', 'social', 'https://bsky.app/profile/bsky.app'],
  ['tiktok', 'social', 'https://www.tiktok.com/explore'],
  ['w3schools-form', 'forms', 'https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit', 'input[name="fname"]'],
  ['httpbin-form', 'forms', 'https://httpbin.org/forms/post', 'input[name="custname"]'],
  ['selenium-form', 'forms', 'https://www.selenium.dev/selenium/web/web-form.html', 'input[name="my-text"]'],
  ['mdn-js', 'docs', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript'],
  ['chrome-docs', 'docs', 'https://developer.chrome.com/docs/extensions/'],
  ['python-docs', 'docs', 'https://docs.python.org/3/'],
  ['wikipedia', 'docs', 'https://en.wikipedia.org/wiki/Main_Page'],
  ['github', 'docs', 'https://github.com/AdguardTeam/tsurlfilter'],
  ['stackoverflow', 'docs', 'https://stackoverflow.com/questions'],
  ['wcag', 'docs', 'https://www.w3.org/TR/WCAG22/'],
  ['node-docs', 'docs', 'https://nodejs.org/en/learn/getting-started/introduction-to-nodejs'],
].map(([id, category, url, inputSelector]) => ({ id, category, url, inputSelector }));
assert.equal(SITES.length, 40);
const PERFORMANCE_SITES = ['bbc', 'guardian', 'amazon', 'youtube', 'mdn-js', 'wikipedia'];
const VARIANT_IDS = ['no-extension', 'bloku-2', 'bloku-1', 'ubol', 'adguard'];
const OFFICIAL = [
  {
    id: 'ubol', version: '2026.1026.1812', name: 'uBlock Origin Lite',
    release: 'https://github.com/uBlockOrigin/uBOL-home/releases/tag/2026.1026.1812',
    asset: 'https://github.com/uBlockOrigin/uBOL-home/releases/download/2026.1026.1812/uBOLite_2026.1026.1812.chromium.zip',
    sha256: 'd3788eac9f0a44c67f3745a43c3fd446ef33d56b1121f469b19e0fa0a836c2b5',
    publishedAt: '2026-10-26T18:13:42Z', maximumArchiveBytes: 12_000_000,
  },
  {
    id: 'adguard', version: '5.5.3.3', name: 'AdGuard Browser Extension MV3',
    release: 'https://github.com/AdguardTeam/AdguardBrowserExtension/releases/tag/v5.5.3.3',
    asset: 'https://github.com/AdguardTeam/AdguardBrowserExtension/releases/download/v5.5.3.3/chrome-mv3.zip',
    sha256: '628b5da9749cf6b4730cf8ffe28b6afdb2b3e029c1acd918c73d7c4b2e90986e',
    publishedAt: '2026-09-30T15:48:55Z', maximumArchiveBytes: 35_000_000,
  },
];
const PLATFORM_VERSIONS = [
  { version: '145.0.7632.117', label: 'minimum supported snapshot', cached: true },
  { version: '155.0.8059.84', label: 'previous milestone' },
  { version: '158.0.8127.2', label: 'requested beta snapshot' },
];
const BLOCKED_HOSTS = ['backend-mellardoos-projects.vercel.app', 'bloku.app', 'www.bloku.app'];
const SETTINGS = {
  viewport: { width: 1365, height: 900 }, locale: 'en-US', timezone: 'Africa/Cairo',
  navigationTimeoutMs: 18_000, settleMs: 2500, processSampleMs: 750,
  cacheDisabled: true, performanceRepeats: 3, headless: true,
  credentials: 'none', externalSubmissions: 'none', autoPlay: 'user gesture required',
};
let activeBrowser;
let activeProfile;
let stopping = false;
let run;
let runDirectory;

async function ensureSpace(minimumMiB = 500) {
  const info = await statfs(root);
  const freeMiB = info.bavail * info.bsize / 1024 ** 2;
  if (freeMiB < minimumMiB) throw new Error(`Only ${Math.floor(freeMiB)} MiB free; refusing to create another comparison profile.`);
}

async function extractArchive(archive, destination) {
  // Python's standard library only. No package installation or archive hooks.
  const script = `import pathlib,stat,sys,zipfile\narchive,destination=sys.argv[1:]\nroot=pathlib.Path(destination).resolve()\nwith zipfile.ZipFile(archive) as z:\n infos=z.infolist()\n if sum(i.file_size for i in infos)>400*1024*1024: raise ValueError('Archive uncompressed size limit exceeded')\n for i in infos:\n  p=pathlib.PurePosixPath(i.filename)\n  if p.is_absolute() or '..' in p.parts or '\\\\' in i.filename or stat.S_ISLNK(i.external_attr>>16): raise ValueError('Unsafe archive entry')\n  target=(root/i.filename).resolve()\n  if not target.is_relative_to(root): raise ValueError('Archive escapes destination')\n z.extractall(root)\n`;
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await exec('python3', ['-c', script, archive, destination], { timeout: 30_000 });
}

async function findManifest(directory, depth = 0) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.some(entry => entry.isFile() && entry.name === 'manifest.json')) return directory;
  if (depth >= 2) throw new Error('No extension manifest within the extracted archive root.');
  for (const entry of entries.filter(entry => entry.isDirectory() && entry.name !== '__MACOSX')) {
    try { return await findManifest(path.join(directory, entry.name), depth + 1); } catch { /* Try another bounded directory. */ }
  }
  throw new Error('Extension manifest not found.');
}

async function describeExtension(directory) {
  const bytes = await readFile(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.manifest_version, 3, 'Comparisons require Chrome MV3 packages.');
  const staticCounts = {};
  for (const resource of manifest.declarative_net_request?.rule_resources ?? []) {
    // Chrome permits extension-root paths beginning with '/'. They are not
    // absolute host-filesystem paths.
    const resourcePath = path.resolve(directory, resource.path.replace(/^\/+/, ''));
    if (!resourcePath.startsWith(`${directory}${path.sep}`)) throw new Error('Static ruleset path escapes package.');
    staticCounts[resource.id] = JSON.parse(await readFile(resourcePath, 'utf8')).length;
  }
  return { manifest, manifestSha256: sha256(bytes), staticCounts };
}

async function prepareComparators() {
  await ensureSpace();
  await mkdir(cache, { recursive: true });
  await mkdir(artifacts, { recursive: true });
  const prepared = {};
  const legacyZip = path.join(root, 'bloku-extension.zip');
  const legacyBytes = await readFile(legacyZip);
  const legacyFolder = path.join(cache, 'legacy-1.1.3');
  await extractArchive(legacyZip, legacyFolder);
  const legacyDirectory = await findManifest(legacyFolder);
  const legacy = await describeExtension(legacyDirectory);
  assert.equal(legacy.manifest.version, '1.1.3');
  prepared['bloku-1'] = { id: 'bloku-1', name: 'Original BLOKU 1.1.3 ZIP', version: '1.1.3', source: 'B2/bloku-extension.zip (original local archive)', archiveSha256: sha256(legacyBytes), directory: legacyDirectory, ...legacy, status: 'prepared', limitation: 'Default free state only; no premium entitlement is forged. Licensing and BLOKU website hosts are DNS-blocked for all variants.' };
  for (const source of OFFICIAL) {
    try {
      const archive = path.join(cache, `${source.id}-${source.version}.zip`);
      let bytes;
      try { bytes = await readFile(archive); if (sha256(bytes) !== source.sha256) bytes = undefined; } catch { /* First preparation. */ }
      if (!bytes) {
        const response = await fetch(source.asset, { signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`Official download HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > source.maximumArchiveBytes) throw new Error('Official archive exceeded expected size bound.');
        assert.equal(sha256(bytes), source.sha256, 'Official GitHub asset SHA-256 mismatch.');
        await writeFile(archive, bytes);
      }
      const directory = path.join(cache, `${source.id}-${source.version}`);
      await extractArchive(archive, directory);
      const extensionDirectory = await findManifest(directory);
      const description = await describeExtension(extensionDirectory);
      assert.equal(description.manifest.version, source.version, 'Official archive manifest version differs from release.');
      prepared[source.id] = { ...source, ...description, directory: extensionDirectory, archiveSha256: source.sha256, status: 'prepared' };
      console.log(`PREPARED ${source.id} ${source.version} sha256=${source.sha256}`);
    } catch (error) {
      prepared[source.id] = { ...source, status: 'not-prepared', reason: String(error) };
      console.log(`NOT PREPARED ${source.id}: ${error.message}`);
    }
  }
  await writeFile(path.join(cache, 'prepared.json'), `${JSON.stringify(prepared, null, 2)}\n`);
  await writeFile(path.join(artifacts, 'comparator-provenance.json'), `${JSON.stringify(prepared, null, 2)}\n`);
  return prepared;
}

async function snapshotCurrent() {
  const directory = process.env.BLOKU_EXTENSION_PATH ? path.resolve(process.env.BLOKU_EXTENSION_PATH) : path.join(root, 'dist');
  const packageArchive = process.env.BLOKU_PACKAGE_ARCHIVE ? { name: path.basename(process.env.BLOKU_PACKAGE_ARCHIVE), sha256: sha256(await readFile(process.env.BLOKU_PACKAGE_ARCHIVE)) } : null;
  const checksumBytes = await readFile(path.join(directory, 'checksums.json'));
  const checksums = JSON.parse(checksumBytes);
  for (const [file, expected] of Object.entries(checksums)) assert.equal(sha256(await readFile(path.join(directory, file))), expected, `Current dist checksum mismatch: ${file}`);
  const fingerprint = sha256(checksumBytes);
  const snapshot = path.join(cache, `bloku-2-${fingerprint.slice(0, 16)}`);
  await rm(snapshot, { recursive: true, force: true });
  await cp(directory, snapshot, { recursive: true, filter: source => path.basename(source) !== '_metadata' });
  const description = await describeExtension(snapshot);
  assert.equal(description.manifest.version, '2.0.0');
  return { id: 'bloku-2', name: 'BLOKU 2.0.0 actual dist snapshot', version: '2.0.0', status: 'prepared', directory: snapshot, checksumsSha256: fingerprint, packageArchive, packageFiles: Object.keys(checksums).length, ...description };
}

async function executable() {
  if (process.env.BLOKU_CHROME_PATH) return process.env.BLOKU_CHROME_PATH;
  return path.join(root, 'engine/.cache/browser/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

async function closeOwnedBrowser() {
  const browser = activeBrowser;
  const profile = activeProfile;
  activeBrowser = undefined;
  activeProfile = undefined;
  if (browser) {
    let timer;
    try { await Promise.race([browser.close().catch(() => undefined), new Promise(resolve => { timer = setTimeout(() => { browser.process()?.kill('SIGTERM'); resolve(); }, 12_000); })]); }
    finally { clearTimeout(timer); }
  }
  if (profile) await rm(profile, { recursive: true, force: true });
}

async function launchVariant(id, phase, repeat) {
  await ensureSpace();
  const variant = run.variants[id];
  if (variant.status !== 'prepared' && id !== 'no-extension') throw new Error(variant.reason ?? 'Comparator was not prepared.');
  activeProfile = path.join(cache, `profile-${run.id}-${phase}-${id}-${repeat}`);
  await rm(activeProfile, { recursive: true, force: true });
  const extensionArgs = id === 'no-extension' ? [] : [`--disable-extensions-except=${variant.directory}`, `--load-extension=${variant.directory}`];
  activeBrowser = await puppeteer.launch({
    executablePath: await executable(), headless: true, userDataDir: activeProfile, protocolTimeout: 25_000,
    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
    args: [...extensionArgs, '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--autoplay-policy=user-gesture-required', '--lang=en-US', `--host-resolver-rules=${BLOCKED_HOSTS.map(host => `MAP ${host} ~NOTFOUND`).join(', ')}`],
  });
  const browser = activeBrowser;
  const version = await browser.version();
  assert.match(version, /Chrome\/156\./, 'Public comparison is pinned to Chrome 156.');
  run.browserVersion ??= version;
  assert.equal(run.browserVersion, version);
  let initialization = { version, id, phase, repeat, activeRules: null };
  if (id !== 'no-extension') {
    const target = await browser.waitForTarget(item => item.type() === 'service_worker' && item.url().startsWith('chrome-extension://'), { timeout: 30_000 });
    const extensionId = new URL(target.url()).host;
    const probe = await browser.newPage();
    const probePath = id === 'bloku-2' ? 'options.html' : 'manifest.json';
    await probe.goto(`chrome-extension://${extensionId}/${probePath}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    if (id === 'bloku-2') {
      const reply = await probe.evaluate(() => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action: 'GET_STATE' }));
      assert.equal(reply?.ok, true, 'BLOKU current initialization did not succeed.');
      assert.equal(reply.engine?.ok, true, `BLOKU current engine unhealthy: ${JSON.stringify(reply.engine?.errors)}`);
      assert.deepEqual(reply.state.preferences.listIds, ['base', 'privacy'], 'Current comparison must use default base/privacy selection.');
      initialization.preferences = reply.state.preferences;
      initialization.engineRevision = reply.engine.revision;
    }
    await wait(5000);
    const rules = await probe.evaluate(async () => ({
      enabled: await chrome.declarativeNetRequest.getEnabledRulesets(),
      dynamicCount: (await chrome.declarativeNetRequest.getDynamicRules()).length,
      sessionCount: (await chrome.declarativeNetRequest.getSessionRules()).length,
      permissions: await chrome.permissions.getAll(),
    }));
    initialization.activeRules = { ...rules, enabledStaticRuleCount: rules.enabled.reduce((sum, resourceId) => sum + (variant.staticCounts[resourceId] ?? 0), 0) };
    if (!rules.enabled.length && !rules.dynamicCount) throw new Error('No enabled filtering rules detected; refusing an inactive comparator.');
    await probe.close();
  } else await wait(5000);
  // Close first-run/onboarding tabs without clicking any consent, account or
  // purchase controls. No worker debugger sessions are attached or kept alive.
  for (const page of await browser.pages()) await page.close().catch(() => undefined);
  run.initializations.push(initialization);
  await persist();
  return browser;
}

async function browserSample(session) {
  const { processInfo } = await session.send('SystemInfo.getProcessInfo');
  const pids = processInfo.map(process => process.id).filter(id => Number.isSafeInteger(id) && id > 0);
  let rssKiB = null;
  if (pids.length) {
    try {
      const { stdout } = await exec('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')], { timeout: 3000 });
      rssKiB = stdout.trim().split('\n').reduce((sum, line) => sum + (Number(line.trim().split(/\s+/)[1]) || 0), 0);
    } catch { /* A process may exit between SystemInfo and ps. */ }
  }
  return { processInfo, rssKiB };
}

async function measurePage(browser, site, variant, phase, repeat) {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const session = await page.createCDPSession();
  const browserSession = await browser.target().createCDPSession();
  await page.setViewport(SETTINGS.viewport);
  await page.emulateTimezone(SETTINGS.timezone);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setCacheEnabled(false);
  await session.send('Network.enable');
  await session.send('Performance.enable');
  let requests = 0, transferredBytes = 0, blockedByClient = 0, networkFailures = 0, javascriptErrors = 0;
  let mainDocumentStatus = null;
  session.on('Network.requestWillBeSent', event => { if (/^https?:/.test(event.request.url)) requests++; });
  session.on('Network.loadingFinished', event => { transferredBytes += event.encodedDataLength; });
  session.on('Network.loadingFailed', event => { if (event.errorText.includes('ERR_BLOCKED_BY_CLIENT')) blockedByClient++; else networkFailures++; });
  page.on('pageerror', () => { javascriptErrors++; });
  page.on('response', response => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) mainDocumentStatus = response.status();
  });
  await page.evaluateOnNewDocument(() => {
    window.__publicQualification = { lcp: null, longTaskMs: 0, longTasks: 0 };
    try { new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__publicQualification.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
    try { new PerformanceObserver(list => { for (const entry of list.getEntries()) { window.__publicQualification.longTaskMs += entry.duration; window.__publicQualification.longTasks++; } }).observe({ type: 'longtask', buffered: true }); } catch {}
  });
  let previousProcesses = new Map(), browserCpuSeconds = 0, peakRssKiB = null, processSamples = 0, sampling = false;
  async function sample(first = false) {
    if (sampling) return;
    sampling = true;
    try {
      const snapshot = await browserSample(browserSession);
      const current = new Map(snapshot.processInfo.map(process => [process.id, process.cpuTime]));
      if (!first) for (const [id, cpu] of current) browserCpuSeconds += Math.max(0, cpu - (previousProcesses.get(id) ?? 0));
      previousProcesses = current;
      if (snapshot.rssKiB !== null) peakRssKiB = Math.max(peakRssKiB ?? 0, snapshot.rssKiB);
      processSamples++;
    } catch { /* Metrics are reported unavailable when no usable sample exists. */ }
    finally { sampling = false; }
  }
  await sample(true);
  const before = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
  const interval = setInterval(() => { void sample(); }, SETTINGS.processSampleMs);
  const started = Date.now();
  let response, navigationError = null, result;
  try {
    try { response = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: SETTINGS.navigationTimeoutMs }); }
    catch (error) { navigationError = String(error).match(/net::ERR_[A-Z_]+/)?.[0] ?? error.name; }
    await wait(SETTINGS.settleMs);
    const probe = await page.evaluate(siteInfo => {
      const text = document.body?.innerText ?? '';
      const sample = `${document.title}\n${text.slice(0, 5000)}`.toLowerCase();
      const navigation = performance.getEntriesByType('navigation')[0];
      const modal = [...document.querySelectorAll('[role="dialog"],dialog[open]')].some(element => {
        const rect = element.getBoundingClientRect(); return rect.width > innerWidth * 0.5 && rect.height > innerHeight * 0.4 && getComputedStyle(element).visibility !== 'hidden';
      });
      const password = document.querySelector('input[type="password"]');
      const visiblePassword = password && password.getBoundingClientRect().width > 0 && password.getBoundingClientRect().height > 0;
      const challenge = /^(just a moment|access denied|attention required|security check|robot check)/i.test(document.title)
        || (text.length < 2000 && /verify (that )?you are human|unusual traffic|checking your browser|enable javascript and cookies|access denied|blocked by network security|complete the captcha/.test(sample));
      const publicFeedLinks = siteInfo.id === 'bluesky' ? document.querySelectorAll('a[href*="/post/"]').length : null;
      return {
        title: document.title.slice(0, 160), textCharacters: text.length, headings: document.querySelectorAll('h1,h2').length,
        links: [...document.querySelectorAll('a[href]')].filter(element => element.getBoundingClientRect().width > 0).length,
        bodyHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight,
        challenge,
        adblockWall: /disable your ad.?block|turn off your ad.?block|ad.?blocker detected|ad blocker detected/.test(sample),
        authGate: !siteInfo.inputSelector && (/\/(login|signin|sign-in|auth)(\/|$)/i.test(location.pathname) || (Boolean(visiblePassword) && text.length < 4000)),
        publicFeedLinks,
        largeModal: modal,
        navigation: navigation ? { ttfbMs: navigation.responseStart || null, domContentLoadedMs: navigation.domContentLoadedEventEnd || null, loadEventMs: navigation.loadEventEnd || null } : null,
        lcpMs: window.__publicQualification?.lcp ?? null,
        longTaskMs: window.__publicQualification?.longTaskMs ?? null,
        longTasks: window.__publicQualification?.longTasks ?? null,
      };
    }, site).catch(() => null);
    const elapsedMs = Date.now() - started;
    clearInterval(interval);
    while (sampling) await wait(10);
    await sample();
    const metrics = Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value]));
    const httpStatus = response?.status() ?? mainDocumentStatus;
    let status = !probe ? 'navigation-failed' : (httpStatus !== null && httpStatus >= 400) ? 'http-error' : probe.challenge ? 'challenge' : probe.authGate ? 'authentication-gated' : probe.adblockWall ? 'adblock-wall' : probe.textCharacters < 100 ? 'insufficient-content' : 'public-page-readable';
    if (status === 'public-page-readable' && probe.publicFeedLinks === 0) status = 'public-shell-only';
    if (navigationError && status === 'public-page-readable') status = navigationError === 'TimeoutError' ? 'readable-after-navigation-timeout' : 'navigation-failed';
    const flows = { scroll: 'not-run', input: site.inputSelector ? 'not-run' : 'not-applicable', submission: 'never-attempted', playback: site.category === 'video' ? 'not-attempted' : 'not-applicable' };
    const readable = ['public-page-readable', 'readable-after-navigation-timeout'].includes(status);
    if (phase === 'compatibility' && readable) {
      flows.scroll = await page.evaluate(() => { const before = scrollY; const max = Math.max(0, document.documentElement.scrollHeight - innerHeight); scrollTo({ top: Math.min(max, 600), behavior: 'instant' }); return max < 1 || scrollY !== before ? 'passed' : 'failed'; }).catch(() => 'failed');
      if (site.inputSelector) {
        flows.input = 'not-present';
        for (const frame of page.frames()) {
          const input = await frame.$(site.inputSelector).catch(() => null);
          if (!input) continue;
          const visible = await input.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).catch(() => false);
          if (!visible) { await input.dispose(); continue; }
          try {
            await input.click({ clickCount: 3 });
            await input.type('Bloku compatibility check', { delay: 0 });
            flows.input = await input.evaluate(element => element.value.includes('Bloku compatibility check')) ? 'passed' : 'failed';
          } catch { flows.input = 'failed'; }
          await input.dispose(); break;
        }
      }
    }
    result = {
      key: `${phase}:${repeat}:${variant}:${site.id}`, phase, repeat, variant, site: site.id, category: site.category, requestedUrl: site.url,
      measuredAt: new Date().toISOString(), finalUrl: cleanUrl(page.url()), httpStatus, navigationError, status, readable,
      flows, probe, metrics: {
        windowMs: elapsedMs, browserCpuMs: processSamples > 1 ? rounded(browserCpuSeconds * 1000) : null,
        chromePeakSumRssMiB: rounded(peakRssKiB === null ? null : peakRssKiB / 1024), processSamples,
        rendererTaskMs: rounded((metrics.TaskDuration - (before.TaskDuration ?? 0)) * 1000),
        rendererHeapMiB: rounded(metrics.JSHeapUsedSize / 1024 ** 2), domNodes: metrics.Nodes ?? null,
        requests, transferredBytes, blockedByClient, networkFailures, javascriptErrors,
      },
    };
    if (phase === 'compatibility') {
      const screenshot = `screenshots/${variant}-${site.id}.jpg`;
      try { await page.screenshot({ path: path.join(runDirectory, screenshot), type: 'jpeg', quality: 45, fullPage: false }); result.screenshot = screenshot; } catch { /* Explicit result survives a failed screenshot. */ }
    }
  } finally {
    clearInterval(interval);
    await session.detach().catch(() => undefined);
    await browserSession.detach().catch(() => undefined);
    await page.close().catch(() => undefined);
  }
  return result;
}

async function persist() {
  if (!run || !runDirectory) return;
  await writeFile(path.join(runDirectory, 'results.json'), `${JSON.stringify(run, null, 2)}\n`);
  const pointer = run.kind === 'current-only-compatibility' ? 'latest-current.json' : 'latest.json';
  await writeFile(path.join(artifacts, pointer), `${JSON.stringify({ id: run.id, directory: runDirectory, status: run.status, completedSamples: run.results.length, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function compatibilityVerdict(site, variant) {
  const baseline = run.results.find(result => result.phase === 'compatibility' && result.variant === 'no-extension' && result.site === site.id);
  const result = run.results.find(result => result.phase === 'compatibility' && result.variant === variant && result.site === site.id);
  if (!result) return 'NOT RUN';
  if (!baseline?.readable) return `control limited; ${result.status}`;
  if (!result.readable) return `CANDIDATE: ${result.status}`;
  if (result.flows.scroll === 'failed' && baseline.flows.scroll !== 'failed') return 'CANDIDATE: scroll';
  if (site.inputSelector && baseline.flows.input === 'passed' && result.flows.input !== 'passed') return `CANDIDATE: input ${result.flows.input}`;
  return result.probe?.largeModal ? 'readable; large modal' : 'no obvious bootstrap/scroll regression';
}

async function writeReport() {
  if (!run) return;
  if (run.kind === 'current-only-compatibility') {
    const readable = run.results.filter(result => result.readable).length;
    const rows = SITES.map(site => {
      const result = run.results.find(item => item.site === site.id);
      return `| [${site.id}](${site.url}) | ${site.category} | ${result?.status ?? 'NOT RUN'} | ${result?.flows.scroll ?? 'NOT RUN'} | ${result?.flows.input ?? 'NOT RUN'} |`;
    });
    const currentReport = `# Current-package public compatibility\n\nRun: ${run.id}; status: **${run.status}**. Browser: ${run.browserVersion ?? 'NOT RUN'}. Attempts: ${run.results.length}/40. Automated readability signals: ${readable}/40; these are provisional page-bootstrap signals, not full-site passes.\n\nPackage checksum-manifest SHA-256: \`${run.variants['bloku-2'].checksumsSha256}\`. Release archive: ${run.variants['bloku-2'].packageArchive?.name ?? 'not supplied'}, SHA-256: \`${run.variants['bloku-2'].packageArchive?.sha256 ?? 'not supplied'}\`. Collector source SHA-256: \`${run.collectorSourceSha256}\`. [Raw results](results.json) and viewport screenshots are retained in this run directory.\n\nThis separate run measures only the current BLOKU package. It contains no new no-extension or competitor control and no three-repeat performance sample. Earlier benchmark: ${run.priorBenchmark?.id ?? 'not linked'}, package \`${run.priorBenchmark?.packageHash ?? 'unavailable'}\`. It is not contemporaneous and must not be relabeled as this package's benchmark.\n\nThe same fixed 40 URLs, fresh isolated Chrome 156 profile, disabled HTTP cache, 1365×900 viewport, 18-second DOMContentLoaded timeout and 2.5-second settle/probe method apply. It attempts scrolling and types nonpersonal text in the three demo inputs without submission. No personal profiles, credentials, purchases, playback or meetings are used. Challenge/login/country-choice/consent screens and loading skeletons require separate review; a readable shell does not establish a usable complete site.\n\n| URL | Category | Raw status | Scroll | Demo input |\n|---|---|---|---|---|\n${rows.join('\n')}\n\nHarness failures: ${run.failures.length}. ${run.failures.map(failure => failure.error).join('\n')}\n`;
    await writeFile(path.join(runDirectory, 'report.md'), currentReport);
    let combined = await readFile(reportFile, 'utf8').catch(() => '# Public-site qualification\n');
    const section = `<!-- current-package:start -->\n## Separate current-package compatibility run\n\nRun ${run.id}: **${run.status}**, ${run.results.length}/40 attempts, ${readable} raw readability signals. Exact package: \`${run.variants['bloku-2'].checksumsSha256}\`. [Separate report](../B2/artifacts/public-qualification/${run.id}/report.md). This is a new current-only run, not a rerun of the earlier five-variant performance comparison; the earlier benchmark remains tied to its original package hash. Manual review and restricted-site limits remain required.\n<!-- current-package:end -->`;
    combined = combined.includes('<!-- current-package:start -->') ? combined.replace(/<!-- current-package:start -->[\s\S]*?<!-- current-package:end -->/, section) : `${combined}\n${section}\n`;
    await writeFile(reportFile, combined);
    return;
  }
  const rows = SITES.map(site => `| [${site.id}](${site.url}) | ${site.category} | ${run.results.find(result => result.phase === 'compatibility' && result.variant === 'no-extension' && result.site === site.id)?.status ?? 'NOT RUN'} | ${VARIANT_IDS.slice(1).map(variant => compatibilityVerdict(site, variant)).join(' | ')} |`);
  const configurations = VARIANT_IDS.slice(1).map(variant => {
    const initialization = run.initializations.find(item => item.id === variant && item.phase === 'compatibility');
    const rules = initialization?.activeRules;
    return `| ${variant} | ${rules?.enabled.join(', ') ?? 'NOT RUN'} | ${rules?.enabledStaticRuleCount ?? '—'} | ${rules?.dynamicCount ?? '—'} | ${rules?.permissions?.origins?.join(', ') ?? '—'} |`;
  });
  const performance = [];
  for (const site of PERFORMANCE_SITES) for (const variant of VARIANT_IDS) {
    const samples = run.results.filter(result => result.phase === 'performance' && result.site === site && result.variant === variant && result.readable && !result.probe?.largeModal);
    const qualified = samples.length >= 3;
    const measured = selector => { const values = samples.map(selector).filter(value => Number.isFinite(value) && value > 0); return qualified && values.length >= 3 ? rounded(median(values)) : '—'; };
    performance.push(`| ${site} | ${variant} | ${samples.length}/3 | ${measured(sample => sample.probe?.navigation?.domContentLoadedMs)} | ${measured(sample => sample.probe?.lcpMs)} | ${measured(sample => sample.metrics.browserCpuMs)} | ${measured(sample => sample.metrics.chromePeakSumRssMiB)} |`);
  }
  const candidates = SITES.filter(site => compatibilityVerdict(site, 'bloku-2').startsWith('CANDIDATE:'));
  const controlReadable = run.results.filter(result => result.phase === 'compatibility' && result.variant === 'no-extension' && result.readable).length;
  const document = `# Public-site qualification\n\nRun: ${run.id}. Status: **${run.status}**. Browser: ${run.browserVersion ?? 'NOT RUN'}. Completed ${run.results.length}/${40 * VARIANT_IDS.length + PERFORMANCE_SITES.length * 3 * VARIANT_IDS.length} planned navigation samples.\n\nNo-extension control was readable on ${controlReadable}/40 URLs. BLOKU 2 has ${candidates.length} automated regression candidates against readable controls. These are triage findings, not confirmed extension bugs. No claim of best-in-class effectiveness or universal compatibility follows from this run.\n\nCurrent package checksum-manifest SHA-256: \`${run.variants['bloku-2']?.checksumsSha256 ?? 'unavailable'}\`. Raw results, all attempted cases, initialization rule counts and viewport screenshots: [${run.id}](../B2/artifacts/public-qualification/${run.id}/results.json).\n\n## Versions and provenance\n\n${Object.entries(run.variants).map(([id, variant]) => `- ${id}: ${variant.name}; ${variant.version ?? 'browser control'}; ${variant.status}. ${variant.release ? `[Official release](${variant.release}).` : ''} ${variant.archiveSha256 ? `Archive SHA-256: \`${variant.archiveSha256}\`.` : ''} ${variant.reason ?? ''}`).join('\n')}\n\n## Method\n\nOne isolated Chrome for Testing browser runs at a time, using fresh task-owned profiles. No personal profile, credentials, authenticated sessions, checkout, purchases, form submissions or meeting joins are used. First-run tabs are closed without clicking legal/account/purchase controls. Installed extensions are unmodified official/original archives; installation hooks are never executed. The BLOKU 2 artifact is an immutable verified snapshot of actual dist. Default filter choices are recorded; no premium state is forged in the legacy comparison.\n\nEach compatibility case navigates to the fixed URL, waits for DOMContentLoaded up to 18 seconds, then observes a fixed 2.5-second window. It checks public content bootstrap and scrolling. The three form pages additionally attempt to type a nonpersonal test string into the documented demo input without submission. Video checks cover public page/player-shell loading only; playback, mid-roll ads and authenticated experiences are unqualified. Challenge/login/error pages are recorded as limited coverage rather than passed flows. Large modals are noted. Rooted automatic checks cannot prove visual completeness or all interactions.\n\nPerformance uses six representative URLs and three repeats per variant. Variant order rotates between repeats; each variant/repeat starts a fresh profile. HTTP cache is disabled, viewport is 1365×900, language en-US, timezone Africa/Cairo, autoplay requires a gesture, and the same machine/network/browser flags apply. No CPU/network throttling is added. Live-site/network/ad-auction variability and region-dependent responses remain uncontrolled. Compatibility blocks run sequentially by variant and are not simultaneous A/B requests.\n\nDOMContentLoaded, load and LCP are browser navigation/paint observations. CDP Performance renderer TaskDuration/JS heap are recorded separately. Browser CPU is the accumulated delta of Chrome's SystemInfo process cpuTime counters sampled every 750 ms; very short-lived processes between samples may be missed. Peak memory is the maximum summed RSS of only this browser's process IDs, read using macOS ps; shared pages may be double-counted and this is not private working-set memory. CPU/RSS include the browser and extension processes; no worker debugger is kept attached. Startup is completed before page measurement. Request failures marked ERR_BLOCKED_BY_CLIENT are observed network failures, not verified ad counts or bandwidth/time-saving claims.\n\nBLOKU's legacy licensing backend and BLOKU website hosts are DNS-blocked in **every** variant, preventing license/billing calls. This restriction does not alter extension source. No test URL uses these hosts.\n\nPer-site performance medians are shown only when three readable, modal-free samples exist. A fast error page is never promoted into a speed advantage. These are bounded local measurements, not a statistically powered ranking.\n\n## Compatibility matrix\n\n| URL | Category | No extension | BLOKU 2 | BLOKU 1.1.3 | uBOL | AdGuard |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Performance medians\n\n| Page | Variant | Readable/modal-free samples | DCL ms | LCP ms | Browser CPU ms | Peak summed RSS MiB |\n|---|---|---|---|---|---|---|\n${performance.join('\n')}\n\n## Limits and unresolved items\n\n${run.failures.map(failure => `- ${failure.phase}/${failure.variant}: ${failure.error}`).join('\n') || '- No harness-level failure recorded.'}\n- WAF/CAPTCHA, login and paywall coverage is explicitly limited; the runner never bypasses these controls.\n- Authenticated social feeds, account editing, checkout, payment, collaboration meetings and browser-wide compatibility are not tested.\n- All candidates need reproduction and visual/functional review before attribution. Package behavior is not changed by this runner.\n- Profiles are removed after their browser closes; downloaded verified comparison packages remain only in the ignored task cache.\n\nPrimary method references: [CDP SystemInfo](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/), [CDP Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/).\n`;
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, document.replace('## Method\n', `## Observed default configurations\n\nThese compare each product's fresh-install defaults, not matched filtering strength or equivalent permissions. A ruleset count is not an effectiveness score. Optional host grants and nondefault modes are not enabled. Full rule/permission state for every fresh profile is recorded in the raw evidence.\n\n| Variant | Enabled static rulesets | Static rules in enabled sets | Dynamic rules | Granted host patterns |\n|---|---|---|---|---|\n${configurations.join('\n')}\n\n## Method\n`));
}

async function runBlock(phase, variant, repeat, sites) {
  if (stopping) return;
  const remaining = sites.filter(site => !run.results.some(result => result.key === `${phase}:${repeat}:${variant}:${site.id}`));
  if (!remaining.length) return;
  try {
    const browser = await launchVariant(variant, phase, repeat);
    for (const site of remaining) {
      if (stopping) break;
      const result = await measurePage(browser, site, variant, phase, repeat);
      run.results.push(result);
      await persist();
      console.log(`${phase} ${variant} r${repeat + 1} ${site.id}: ${result.status} DCL=${rounded(result.probe?.navigation?.domContentLoadedMs)} CPU=${result.metrics.browserCpuMs}ms RSS=${result.metrics.chromePeakSumRssMiB}MiB`);
    }
  } catch (error) {
    run.failures.push({ phase, variant, repeat, error: String(error) });
    console.log(`BLOCK FAILED ${phase} ${variant}: ${error.message}`);
  } finally { await closeOwnedBrowser(); await persist(); await writeReport(); }
}

async function platformProcesses(directory) {
  // Only executables from the unique browser directory this runner created.
  const { stdout } = await exec('ps', ['-axo', 'pid=,command=']);
  return stdout.split('\n').flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    return match && match[2].startsWith(`${directory}/chrome-mac-arm64/`) ? [Number(match[1])] : [];
  });
}

async function stopPlatformProcesses(directory, preexisting = []) {
  const owned = (await platformProcesses(directory)).filter(pid => !preexisting.includes(pid));
  for (const pid of owned) { try { process.kill(pid, 'SIGTERM'); } catch { /* Already closed. */ } }
  if (owned.length) await wait(1000);
  for (const pid of owned) { try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* Already closed. */ } }
  return owned.length;
}

async function runPlatformRuntime(source, directory, browserPath, packageEvidence) {
  const resultPath = path.join(root, 'artifacts/qualification/runtime-results.json');
  const runtimeDocument = path.join(root, '../docs/RUNTIME_QUALIFICATION.md');
  const savedJson = await readFile(resultPath);
  const savedDocument = await readFile(runtimeDocument);
  const existingProcesses = await platformProcesses(directory);
  const runtimeCache = path.join(root, 'engine/.cache');
  const existingProfiles = new Set(await readdir(runtimeCache));
  const evidence = { version: source.version, screenshotsSkipped: true, startedAt: new Date().toISOString(), status: 'running', package: packageEvidence };
  evidence.runtimeRunnerSha256 = sha256(await readFile(path.join(root, 'scripts/v2-runtime-check.mjs')));
  evidence.stableResultsBeforeSha256 = sha256(savedJson);
  evidence.stableDocumentBeforeSha256 = sha256(savedDocument);
  try {
    console.log(`PLATFORM runtime Chrome ${source.version}: exact ZIP without screenshots`);
    await rm(resultPath, { force: true });
    let failure;
    try {
      const command = await exec(process.execPath, [path.join(root, 'scripts/v2-runtime-check.mjs')], { cwd: root, env: { ...process.env, BLOKU_CHROME_PATH: browserPath, BLOKU_SKIP_SCREENSHOTS: '1', BLOKU_EXTENSION_PATH: packageEvidence.directory, BLOKU_PACKAGE_ARCHIVE: packageEvidence.archive }, timeout: 180_000, maxBuffer: 2_000_000 });
      evidence.output = `${command.stdout}${command.stderr}`;
    } catch (error) { failure = error; evidence.output = `${error.stdout ?? ''}${error.stderr ?? ''}`; }
    const raw = await readFile(resultPath).catch(() => undefined);
    if (raw) {
      evidence.runtime = JSON.parse(raw);
      await writeFile(path.join(artifacts, `runtime-${source.version}-results.json`), raw);
      await writeFile(path.join(artifacts, `runtime-${source.version}-report.md`), await readFile(runtimeDocument));
    }
    if (failure) throw failure;
    assert.equal(evidence.runtime?.browser, `Chrome/${source.version}`);
    assert.equal(evidence.runtime?.checksumsManifestSha256, packageEvidence.checksumsSha256);
    assert.equal(evidence.runtime?.packageArchive?.sha256, packageEvidence.archiveSha256);
    assert.equal(evidence.runtime?.results?.length, 20, 'Final runtime requires all 20 authored checks.');
    assert.ok(evidence.runtime.results.every(check => check.pass || check.skip));
    evidence.status = evidence.runtime.results.some(check => check.skip) ? 'passed-with-stated-skips' : 'passed';
    console.log(`PLATFORM runtime ${source.version}: ${evidence.runtime.results.filter(check => check.pass).length} pass; ${evidence.runtime.results.filter(check => check.skip).length} skip`);
  } catch (error) { evidence.status = 'failed-or-limited'; evidence.error = String(error); console.log(`PLATFORM runtime ${source.version}: ${evidence.error}`); }
  finally {
    evidence.processesStoppedAfterRuntime = await stopPlatformProcesses(directory, existingProcesses);
    for (const entry of await readdir(runtimeCache)) {
      if (entry.startsWith('runtime-profile-') && !existingProfiles.has(entry)) await rm(path.join(runtimeCache, entry), { recursive: true, force: true });
    }
    await writeFile(resultPath, savedJson);
    await writeFile(runtimeDocument, savedDocument);
    evidence.stableEvidenceRestored = sha256(await readFile(resultPath)) === sha256(savedJson) && sha256(await readFile(runtimeDocument)) === sha256(savedDocument);
    assert.equal(evidence.stableEvidenceRestored, true, 'Stable Chrome 156 runtime evidence was not restored.');
    evidence.finishedAt = new Date().toISOString();
    await writeFile(path.join(artifacts, `runtime-${source.version}-wrapper.json`), `${JSON.stringify(evidence, null, 2)}\n`);
  }
  return evidence;
}

async function platformReport(results) {
  await writeFile(path.join(artifacts, 'platforms.json'), `${JSON.stringify(results, null, 2)}\n`);
  let document;
  try { document = await readFile(reportFile, 'utf8'); }
  catch { document = '# Public-site qualification\n\nPublic matrix: NOT RUN.\n'; }
  document = document.split('\n<!-- platform-results -->')[0];
  document += `\n<!-- platform-results -->\n## Additional Chrome engine and exact-package runtime checks\n\nRequested exact Chrome for Testing versions are reported as snapshots, not current channel labels. Each browser runs the 21-case isolated stock-SDK engine gate followed by the 20 authored runtime checks against the exact release ZIP extraction. These are local fixture checks, not repeat public-site matrices, authenticated workflows, native toolbar tests or comparative performance measurements. Screenshots are disabled here. Physical idle checks remain SKIP when the real host is idle.\n\n| Requested snapshot | Overall result | Engine cases | Runtime pass / skip / fail | Observed browser |\n|---|---|---|---|---|\n${results.map(result => { const checks = result.runtime?.runtime?.results ?? []; return `| ${result.version} (${result.label}) | ${result.status} | ${result.gate?.results?.filter(test => test.pass).length ?? 0}/21 | ${checks.filter(check => check.pass).length} / ${checks.filter(check => check.skip).length} / ${checks.filter(check => !check.pass && !check.skip).length} | ${result.runtime?.runtime?.browser ?? result.gate?.browser ?? 'not observed'} |`; }).join('\n')}\n\n[Raw platform evidence](../B2/artifacts/public-qualification/platforms.json) records per-version official metadata, archive provenance, executable version, environment, complete outputs and cleanup. The 155/158 browser archives are freshly downloaded from URLs verified against official per-version metadata; their local SHA-256 identifies downloaded bytes and is not a publisher-signed digest. The minimum 145 uses the preexisting cached bundle and records its executable hash; its original archive is unavailable. Task-downloaded bundles are removed after each version. Stable Chrome 156 runtime JSON and documentation are restored byte-for-byte after every wrapper. Separate runtime evidence is retained per exact version. Earlier interrupted minimum-version screenshot/CDP attempts remain historical harness limitations; these no-screenshot results do not qualify screenshot capture. [Official CfT metadata documentation](https://github.com/GoogleChromeLabs/chrome-for-testing).\n`;
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, document);
}

async function runPlatforms() {
  assert.equal(os.platform(), 'darwin', 'This bounded platform gate targets the current macOS arm64 host.');
  assert.equal(os.arch(), 'arm64');
  await mkdir(artifacts, { recursive: true });
  await mkdir(cache, { recursive: true });
  const gatePath = path.join(root, 'scripts/v2-engine-gate.mjs');
  const gateResultPath = path.join(root, 'engine/gate-generated/gate-results.json');
  const previousGate = await readFile(gateResultPath).catch(() => undefined);
  const archive = path.join(root, '../artifacts/release/bloku-2.0.0-chrome.zip');
  const extensionDirectory = path.join(root, '../artifacts/release/unpacked');
  const checksumBytes = await readFile(path.join(extensionDirectory, 'checksums.json'));
  const packageEvidence = { directory: extensionDirectory, archive, archiveSha256: sha256(await readFile(archive)), checksumsSha256: sha256(checksumBytes) };
  assert.equal(packageEvidence.archiveSha256, '320c288293c7438d1044603e17da5405042707e5163ef13e2a425098faa31190');
  assert.equal(packageEvidence.checksumsSha256, '41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2');
  for (const [file, expected] of Object.entries(JSON.parse(checksumBytes))) assert.equal(sha256(await readFile(path.join(extensionDirectory, file))), expected, `Exact ZIP extraction checksum mismatch: ${file}`);
  const results = [];
  const platformRunId = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    for (const source of PLATFORM_VERSIONS) {
      if (stopping) break;
      const result = { ...source, status: 'running', startedAt: new Date().toISOString(), package: packageEvidence, environment: { platform: os.platform(), arch: os.arch(), release: os.release(), node: process.version, cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryGiB: rounded(os.totalmem() / 1024 ** 3) } };
      const directory = source.cached ? path.join(root, `engine/.cache/compat-browser/chrome/mac_arm-${source.version}`) : path.join(cache, `platform-${source.version}-${platformRunId}`);
      const archive = `${directory}.zip`;
      const preexistingProcesses = await platformProcesses(directory);
      results.push(result);
      await platformReport(results);
      try {
        assert.equal(preexistingProcesses.length, 0, 'Refusing to share a preexisting browser process.');
        await ensureSpace(1500);
        result.metadataUrl = `https://googlechromelabs.github.io/chrome-for-testing/${source.version}.json`;
        const response = await fetch(result.metadataUrl, { signal: AbortSignal.timeout(30_000) });
        assert.equal(response.status, 200);
        const metadata = await response.json();
        assert.equal(metadata.version, source.version);
        result.revision = metadata.revision;
        result.archiveUrl = metadata.downloads.chrome.find(item => item.platform === 'mac-arm64')?.url;
        assert.equal(result.archiveUrl, `https://storage.googleapis.com/chrome-for-testing-public/${source.version}/mac-arm64/chrome-mac-arm64.zip`);
        result.metadataObservedAt = new Date().toISOString();
        result.metadata = metadata;
        if (!source.cached) {
          console.log(`PLATFORM downloading official Chrome ${source.version}`);
          const download = await fetch(result.archiveUrl, { signal: AbortSignal.timeout(180_000) });
          assert.equal(download.status, 200);
          const hash = createHash('sha256');
          let bytes = 0;
          const output = await open(archive, 'wx');
          try {
            for await (const chunk of download.body) {
              bytes += chunk.length;
              assert.ok(bytes <= 300_000_000, 'Chrome archive exceeded bounded download size.');
              hash.update(chunk);
              await output.write(chunk);
            }
          } finally { await output.close(); }
          result.archiveSha256 = hash.digest('hex');
          result.archiveBytes = bytes;
          if (download.headers.has('content-length')) assert.equal(bytes, Number(download.headers.get('content-length')));
          // Official Chrome app bundles contain signed framework symlinks and
          // executable modes. ditto preserves them without invoking installers.
          const validateZip = `import pathlib,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1]) as z:\n infos=z.infolist()\n if sum(i.file_size for i in infos)>1500*1024*1024: raise ValueError('Browser expanded size limit')\n for i in infos:\n  p=pathlib.PurePosixPath(i.filename)\n  if p.is_absolute() or '..' in p.parts or '\\\\' in i.filename: raise ValueError('Unsafe archive path')\n`;
          await exec('python3', ['-c', validateZip, archive], { timeout: 30_000 });
          await rm(directory, { recursive: true, force: true });
          await mkdir(directory, { recursive: true });
          await exec('/usr/bin/ditto', ['-xk', archive, directory], { timeout: 120_000 });
          await rm(archive, { force: true });
        } else result.archiveLimitation = 'Preexisting cached browser bundle; original archive unavailable; local executable hash recorded.';
        const browserPath = path.join(directory, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
        const version = await exec(browserPath, ['--version'], { timeout: 10_000 });
        result.executableVersion = version.stdout.trim();
        result.executableSha256 = sha256(await readFile(browserPath));
        assert.ok(result.executableVersion.includes(source.version));
        await rm(gateResultPath, { force: true });
        console.log(`PLATFORM engine gate Chrome ${source.version}`);
        let failure;
        try {
          const gate = await exec(process.execPath, [gatePath], { cwd: root, env: { ...process.env, BLOKU_CHROME_PATH: browserPath }, timeout: 240_000, maxBuffer: 2_000_000 });
          result.output = `${gate.stdout}${gate.stderr}`;
        } catch (error) { failure = error; result.output = `${error.stdout ?? ''}${error.stderr ?? ''}`; }
        result.gate = JSON.parse(await readFile(gateResultPath, 'utf8').catch(() => '{}'));
        if (failure) throw failure;
        assert.equal(result.gate.complete, true);
        assert.equal(result.gate.results.length, 21);
        assert.ok(result.gate.results.every(test => test.pass));
        assert.equal(result.gate.browser, `Chrome/${source.version}`);
        console.log(`PLATFORM Chrome ${source.version}: 21/21 PASS`);
        result.runtime = await runPlatformRuntime(source, directory, browserPath, packageEvidence);
        assert.ok(['passed', 'passed-with-stated-skips'].includes(result.runtime.status), 'Exact-package runtime failed or was limited.');
        result.status = result.runtime.status;
      } catch (error) { result.status = 'failed-or-limited'; result.error = String(error); console.log(`PLATFORM ${source.version}: ${result.error}`); }
      finally {
        result.processesStoppedAfterGate = await stopPlatformProcesses(directory, preexistingProcesses);
        await rm(path.join(root, 'engine/gate-generated/browser-profile'), { recursive: true, force: true });
        if (!source.cached) { await rm(directory, { recursive: true, force: true }); await rm(archive, { force: true }); }
        result.bundleRemoved = !source.cached;
        result.finishedAt = new Date().toISOString();
        await platformReport(results);
      }
      if (result.status === 'failed-or-limited') throw new Error(`Stopping platform milestone after ${source.version}: ${result.error}`);
    }
  } finally {
    if (previousGate) await writeFile(gateResultPath, previousGate);
    else await rm(gateResultPath, { force: true });
  }
}

async function main() {
  if (args.has('--prepare')) { await prepareComparators(); return; }
  if (args.has('--report')) {
    const latest = JSON.parse(await readFile(path.join(artifacts, args.has('--current-only') ? 'latest-current.json' : 'latest.json'), 'utf8'));
    runDirectory = latest.directory;
    assert.ok(runDirectory.startsWith(`${artifacts}${path.sep}`));
    run = JSON.parse(await readFile(path.join(runDirectory, 'results.json'), 'utf8'));
    await writeReport();
    return;
  }
  if (args.has('--platforms')) { await runPlatforms(); return; }
  if (!args.has('--run')) { console.log('Usage: node scripts/v2-public-qualification.mjs --prepare | --run [--resume] [--current-only] | --report [--current-only] | --platforms'); return; }
  await ensureSpace();
  await mkdir(artifacts, { recursive: true });
  if (args.has('--resume')) {
    const latest = JSON.parse(await readFile(path.join(artifacts, args.has('--current-only') ? 'latest-current.json' : 'latest.json'), 'utf8'));
    runDirectory = latest.directory;
    assert.ok(runDirectory.startsWith(`${artifacts}${path.sep}`));
    run = JSON.parse(await readFile(path.join(runDirectory, 'results.json'), 'utf8'));
    assert.equal(run.kind === 'current-only-compatibility', args.has('--current-only'), 'Resume must use the original dataset mode.');
    run.status = 'running';
  } else {
    let prepared = {};
    if (!args.has('--current-only')) {
      try { prepared = JSON.parse(await readFile(path.join(cache, 'prepared.json'), 'utf8')); } catch { prepared = await prepareComparators(); }
    }
    const current = await snapshotCurrent();
    run = { id: new Date().toISOString().replace(/[:.]/g, '-'), status: 'running', startedAt: new Date().toISOString(), environment: { platform: os.platform(), arch: os.arch(), release: os.release(), node: process.version, cpuModel: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryGiB: rounded(os.totalmem() / 1024 ** 3) }, settings: SETTINGS, sites: SITES, variants: { 'no-extension': { id: 'no-extension', name: 'Chrome without extensions', status: 'prepared' }, 'bloku-2': current, ...prepared }, initializations: [], results: [], failures: [] };
    run.kind = args.has('--current-only') ? 'current-only-compatibility' : 'five-variant-benchmark';
    if (args.has('--current-only')) {
      run.variants = { 'bloku-2': current };
      run.settings = { ...SETTINGS, performanceRepeats: 0 };
      try {
        const benchmark = JSON.parse(await readFile(path.join(artifacts, 'latest.json'), 'utf8'));
        assert.ok(benchmark.directory.startsWith(`${artifacts}${path.sep}`));
        const prior = JSON.parse(await readFile(path.join(benchmark.directory, 'results.json'), 'utf8'));
        run.priorBenchmark = { id: prior.id, packageHash: prior.variants['bloku-2'].checksumsSha256, status: prior.status };
      } catch { /* A current-only run can stand alone; no comparison is inferred. */ }
    }
    runDirectory = path.join(artifacts, run.id);
    await mkdir(path.join(runDirectory, 'screenshots'), { recursive: true });
    const collectorSource = await readFile(fileURLToPath(import.meta.url));
    run.collectorSourceSha256 = sha256(collectorSource);
    await writeFile(path.join(runDirectory, 'collector-source.mjs'), collectorSource);
  }
  await persist(); await writeReport();
  for (const variant of args.has('--current-only') ? ['bloku-2'] : VARIANT_IDS) await runBlock('compatibility', variant, 0, SITES);
  for (let repeat = 0; !args.has('--current-only') && repeat < 3; repeat++) {
    const order = [...VARIANT_IDS.slice(repeat), ...VARIANT_IDS.slice(0, repeat)];
    for (const variant of order) await runBlock('performance', variant, repeat, SITES.filter(site => PERFORMANCE_SITES.includes(site.id)));
  }
  const expected = args.has('--current-only') ? 40 : 290;
  run.status = stopping ? 'interrupted' : run.results.length === expected ? 'complete' : 'incomplete';
  run.finishedAt = new Date().toISOString();
  await persist(); await writeReport();
  console.log(`PUBLIC QUALIFICATION ${run.status}: ${run.results.length}/${expected} samples; ${reportFile}`);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; void closeOwnedBrowser(); });
try { await main(); }
catch (error) { if (run) { run.status = 'failed'; run.failures.push({ phase: 'harness', variant: 'all', error: String(error) }); await persist(); await writeReport(); } throw error; }
finally { await closeOwnedBrowser(); }
