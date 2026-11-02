import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm, cp, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

// Authoring/inspection default. --run requires the coordinator's explicit lane grant.
// No builds, source edits, downloads, personal profiles, credentials or submissions.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'engine/.cache/public-comparison');
const fingerprint = process.env.BLOKU_EXPECTED_CHECKSUMS_SHA256 || '41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2';
const input = path.resolve(process.env.BLOKU_EXTENSION_PATH || path.join(cache, 'bloku-2-41049e2448c58ef3'));
const executable = process.env.BLOKU_CHROME_PATH || path.join(root, 'engine/.cache/browser/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const sha = value => createHash('sha256').update(value).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = new Set(process.argv.slice(2));
const official = [
 { id: 'ubol', version: '2026.1026.1812', archive: 'ubol-2026.1026.1812.zip', sha256: 'd3788eac9f0a44c67f3745a43c3fd446ef33d56b1121f469b19e0fa0a836c2b5', release: 'https://github.com/uBlockOrigin/uBOL-home/releases/tag/2026.1026.1812' },
 { id: 'adguard', version: '5.5.3.3', archive: 'adguard-5.5.3.3.zip', sha256: '628b5da9749cf6b4730cf8ffe28b6afdb2b3e029c1acd918c73d7c4b2e90986e', release: 'https://github.com/AdguardTeam/AdguardBrowserExtension/releases/tag/v5.5.3.3' },
];
const catalog = [
 ['google-search', 'https://www.google.com/search?q=weather+Cairo', 'public-search'],
 ['google-ads', 'https://ads.google.com/home/', 'public-marketing-only'],
 ['google-analytics', 'https://analytics.google.com/', 'authentication-expected'],
 ['meta-adsmanager', 'https://www.facebook.com/adsmanager/', 'authentication-expected'],
 ['meta-business', 'https://business.facebook.com/', 'authentication-expected'],
 ['canva-home', 'https://www.canva.com/', 'public-bootstrap'],
 ['canva-templates', 'https://www.canva.com/templates/', 'public-template-search'],
 ['canva-create', 'https://www.canva.com/create/', 'public-marketing-only'],
 ['google-docs', 'https://www.google.com/docs/about/', 'public-marketing-only'],
 ['google-drive', 'https://drive.google.com/', 'authentication-expected'],
 ['youtube-elephants', 'https://www.youtube.com/watch?v=jNQXAC9IVRw', 'bounded-public-video'],
 ['youtube-nasa', 'https://www.youtube.com/watch?v=21X5lGlDOfg', 'bounded-public-video'],
 ['twitch', 'https://www.twitch.tv/directory', 'public-directory-only'],
 ['egydead-a1', 'https://a1.egydead.media/', 'reported-heavy-site'],
 ['google-tagmanager', 'https://tagmanager.google.com/', 'authentication-expected'],
].map(([id, url, scope]) => ({ id, url, scope }));
const selectedSites=process.env.BLOKU_BEHAVIOR_SITES?.split(',');
if(selectedSites)assert.ok(selectedSites.length&&new Set(selectedSites).size===selectedSites.length&&selectedSites.every(id=>catalog.some(site=>site.id===id)),'Unknown or duplicate requested public site');
const sites=selectedSites?selectedSites.map(id=>catalog.find(site=>site.id===id)):catalog;
const navigationMs=Math.min(15000,Math.max(5500,Number(process.env.BLOKU_BEHAVIOR_NAVIGATION_MS)||5500));
const variantIds = (process.env.BLOKU_BEHAVIOR_VARIANTS || 'no-extension,bloku-default,bloku-ar,ubol,adguard').split(',');
assert.ok(variantIds.every(id => ['no-extension', 'bloku-default', 'bloku-ar', 'ubol', 'adguard'].includes(id)));
const requirePopup = process.env.BLOKU_REQUIRE_POPUP === '1';
const metaControl = process.env.BLOKU_BEHAVIOR_META_CONTROL === '1';
const metaSettleMs = Number(process.env.BLOKU_BEHAVIOR_META_SETTLE_MS) || 3800;
const budgetMs = Math.min(600_000, Math.max(30_000, Number(process.env.BLOKU_BEHAVIOR_BUDGET_MS) || 590_000));
function safeUrl(value) {
 try {
  const url = new URL(value);
  if (!['http:', 'https:', 'chrome-extension:', 'about:'].includes(url.protocol)) return `${url.protocol}[omitted]`;
  if (url.protocol === 'chrome-extension:') return `chrome-extension://[id]/${url.pathname.split('/').at(-1)}`;
  const pathname = url.pathname.split('/').map(part => part.length > 48 || /@|%40|token|signature|credential/i.test(part) ? '[redacted]' : part).join('/');
  return `${url.origin === 'null' ? url.protocol : url.origin}${pathname}`.slice(0, 300);
 } catch { return '[unparseable-url]'; }
}
function errorClass(error) {
 const value = String(error?.message || error);
 return value.match(/net::ERR_[A-Z_]+/)?.[0] || (value.includes('timeout') || value.includes('Timeout') ? 'timeout' : error?.name || 'Error');
}
async function verifyBloku(directory) {
 const bytes = await readFile(path.join(directory, 'checksums.json'));
 assert.equal(sha(bytes), fingerprint, 'BLOKU checksum-manifest fingerprint differs from selected evidence.');
 const files = JSON.parse(bytes);
 for (const [file, expected] of Object.entries(files)) {
  const resolved = path.resolve(directory, file);
  assert.ok(resolved.startsWith(`${directory}${path.sep}`), 'Package path escapes directory');
  assert.equal(sha(await readFile(resolved)), expected, `Package mismatch: ${file}`);
 }
 return { checksumsSha256: sha(bytes), files: Object.keys(files).length, version: JSON.parse(await readFile(path.join(directory, 'manifest.json'))).version };
}
async function treeHash(directory) {
 const entries = [];
 async function visit(current) {
  for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
   if (entry.name === '_metadata') continue;
   const file = path.join(current, entry.name);
   if (entry.isDirectory()) await visit(file);
   else { assert.ok(entry.isFile(), 'Package symlink/special file rejected'); entries.push([path.relative(directory, file), sha(await readFile(file))]); }
  }
 }
 await visit(directory); return sha(JSON.stringify(entries));
}
const packageEvidence = await verifyBloku(input);
for (const source of official) assert.equal(sha(await readFile(path.join(cache, source.archive))), source.sha256, `${source.id} cached official archive changed`);
if (!args.has('--run')) {
 console.log(JSON.stringify({ status: 'AUTHORING_CHECK_ONLY_NO_BROWSER', package: packageEvidence, comparators: official, sites, variants: variantIds, budgetMs }, null, 2));
 process.exit(0);
}
assert.equal(process.env.BLOKU_BROWSER_LANE_GRANTED, '1', 'Explicit coordinator browser-lane grant is required.');
const startedAt = Date.now(), deadline = startedAt + budgetMs;
const id = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'artifacts/behavior-audit', id);
await mkdir(out, { recursive: true });
const work = await mkdtemp(path.join(root, 'engine/.cache/behavior-'));
const run = { id, status: 'RUNNING', startedAt: new Date(startedAt).toISOString(), collectorSha256: sha(await readFile(fileURLToPath(import.meta.url))), package: packageEvidence, settings: { loggedIn: false, locale: 'en-US', timezone: 'Africa/Cairo', viewport: { width: 1365, height: 900 }, navigationMs, settleMs: 800, budgetMs, audioMuted: true, cacheDisabled: true, performanceRanking: false, requirePopup, metaControl, metaSettleMs, ownWebsiteHostsDnsBlocked: ['bloku.app','www.bloku.app','backend-mellardoos-projects.vercel.app'] }, comparators: official, initializations: [], results: [], fixtures: [], failures: [], unattempted: [], screenshots: [], cleanup: [] };
let browser, profile, currentCase = null, currentPrimaryTarget = null, server, port, watchdog, stopping = false, criticalGateFailed = false;
const exec = promisify(execFile);
async function persist() { await writeFile(path.join(out, 'results.json'), JSON.stringify(run, null, 2) + '\n'); }
async function closeBrowser() {
 const owned = browser; browser = undefined;
 if (owned) { let timer; await Promise.race([owned.close().catch(() => {}), new Promise(resolve => { timer = setTimeout(() => { owned.process()?.kill('SIGTERM'); resolve(); }, 5000); })]); clearTimeout(timer); }
 if (profile) { await rm(profile, { recursive: true, force: true }); profile = undefined; }
}
async function extract(source, destination) {
 await mkdir(destination, { recursive: true });
 const script = `import pathlib,stat,sys,zipfile\na,d=sys.argv[1:]\nr=pathlib.Path(d).resolve()\nwith zipfile.ZipFile(a) as z:\n if sum(i.file_size for i in z.infolist())>400*1024*1024: raise ValueError('size limit')\n for i in z.infolist():\n  p=pathlib.PurePosixPath(i.filename)\n  if p.is_absolute() or '..' in p.parts or '\\\\' in i.filename or stat.S_ISLNK(i.external_attr>>16): raise ValueError('unsafe archive')\n z.extractall(r)\n`;
 await exec('python3', ['-c', script, path.join(cache, source.archive), destination], { timeout: 20_000 });
 const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json')));
 assert.equal(manifest.version, source.version, 'Official archive version mismatch');
}
function fixtureHtml(host) {
 return `<!doctype html><meta charset="utf-8"><title>Owned behavior fixture</title><h1>Owned behavior fixture</h1><p id="hide-target">Reversible hide target</p><button id="oauth" onclick="window.open('/oauth-result','owned-oauth','width=400,height=300')">Open ordinary OAuth-like window</button><button id="designated-popup-trigger" onclick="globalThis.lastAdPopup=window.open('http://ads-popup.bloku.test:${port}/popup','owned-ad-popup')">Open targeted popup</button><button id="delayed-popup-trigger" onclick="globalThis.lastAdPopup=window.open('about:blank','owned-ad-blank');setTimeout(()=>{if(globalThis.lastAdPopup)globalThis.lastAdPopup.location='http://ads-popup.bloku.test:${port}/popup'},50)">Open blank then targeted popup</button><input id="file" type="file"><video id="native" controls muted width="320" height="180"></video><button id="generate">Play locally generated video</button><iframe src="http://frame.bloku.test:${port}/frame" title="Owned frame"></iframe><script>document.querySelector('#generate').onclick=async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const ctx=canvas.getContext('2d');let n=0;const interval=setInterval(()=>{ctx.fillStyle=n++%2?'#164b3c':'#8b1230';ctx.fillRect(0,0,320,180);ctx.fillStyle='white';ctx.fillText('Owned synthetic media',30,90)},100);const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{clearInterval(interval);stream.getTracks().forEach(t=>t.stop());const video=document.querySelector('#native');video.src=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));await video.play();};recorder.start();setTimeout(()=>recorder.stop(),700);};</script>`;
}
function canonicalState(value) { const result = structuredClone(value); result.embeddedHides ??= []; return result; }
async function rpc(page, action, payload) { return page.evaluate((action, payload) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), action, payload); }
async function setup(id, directory) {
 profile = path.join(work, `profile-${id}`);
 browser = await puppeteer.launch({ executablePath: executable, headless: true, userDataDir: profile, protocolTimeout: 12_000, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false, args: [...(directory ? [`--disable-extensions-except=${directory}`, `--load-extension=${directory}`] : []), '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--autoplay-policy=user-gesture-required', '--mute-audio', '--lang=en-US', '--host-resolver-rules=MAP *.bloku.test 127.0.0.1, MAP backend-mellardoos-projects.vercel.app ~NOTFOUND, MAP bloku.app ~NOTFOUND, MAP www.bloku.app ~NOTFOUND'] });
 browser.on('targetcreated', target => { if (currentCase && target.type() === 'page' && target !== currentPrimaryTarget) currentCase.newTargets.push({ url: safeUrl(target.url()), event: 'created' }); });
 browser.on('targetchanged', target => { if (currentCase && target.type() === 'page' && target !== currentPrimaryTarget) currentCase.newTargets.push({ url: safeUrl(target.url()), event: 'changed' }); });
 const version = await browser.version(); assert.match(version, /Chrome\/156\./); run.browserVersion = version;
 const init = { variant: id, browser: version, preferences: null, enabledRulesets: [], dynamicCount: null };
 let options;
 if (directory) {
  const target = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension:'), { timeout: 20_000 });
  const extensionId = new URL(target.url()).hostname;
  options = await browser.newPage(); await options.goto(`chrome-extension://${extensionId}/${id.startsWith('bloku') ? 'options.html' : 'manifest.json'}`, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  if (id.startsWith('bloku')) {
   let state = await rpc(options, 'GET_STATE'); assert.equal(state.ok, true); assert.equal(state.engine.ok, true);
   assert.deepEqual(state.state.preferences.listIds, ['base', 'privacy']);
   if (id === 'bloku-ar') { state.state.preferences.listIds.push('region-ar'); state = await rpc(options, 'UPDATE_STATE', state.state); assert.equal(state.ok, true); }
   const value = await rpc(options, 'GET_STATE'); init.preferences = value.state.preferences; init.engineRevision = value.engine.revision;
  }
  await wait(1800);
  Object.assign(init, await options.evaluate(async () => ({ enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(), dynamicCount: (await chrome.declarativeNetRequest.getDynamicRules()).length, sessionCount: (await chrome.declarativeNetRequest.getSessionRules()).length, recordedDefaultMode: await chrome.storage.local.get(['filteringModeDetails', 'rulesetConfig']) })));
  assert.ok(init.enabledRulesets.length || init.dynamicCount, 'Inactive comparator rejected');
 }
 for (const page of await browser.pages()) if (page !== options) await page.close().catch(() => {});
 run.initializations.push(init); await persist(); return options;
}
async function configurePage(page) {
 await page.setViewport(run.settings.viewport); await page.setCacheEnabled(false); await page.emulateTimezone('Africa/Cairo');
 const session = await page.createCDPSession();
 await session.send('Browser.setDownloadBehavior', { behavior: 'deny' });
 await session.detach();
 page.on('dialog', dialog => { currentCase?.dialogs.push({ type: dialog.type(), action: 'dismissed-without-reading-message' }); void dialog.dismiss().catch(() => {}); });
}
async function click(value, selector) {
 await value.bringToFront();
 const point = await value.$eval(selector, node => { node.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }); const r = node.getBoundingClientRect(); if(!r.width||!r.height||getComputedStyle(node).visibility==='hidden')throw new Error('The owned fixture trigger is not visible; no click was attempted.'); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
 await value.mouse.click(point.x, point.y);
}
async function fixtures(id, options) {
 const result = { variant: id, tests: [], scope: 'Owned local synthetic fixtures only; OAuth-like window is not a real login.' };
 run.fixtures.push(result); await persist();
 const page = await browser.newPage(); page.setDefaultTimeout(4000); await configurePage(page); await page.goto(`http://fixture.bloku.test:${port}/`, { waitUntil: 'domcontentloaded', timeout: 5000 });
 async function check(name, task) { try { result.tests.push({ name, status: 'PASS', detail: await task() }); } catch (error) { result.tests.push({ name, status: 'FAIL', error: errorClass(error), detail: String(error.message).slice(0, 1600), nativePopupReference: await page.evaluate(() => ({ exists: Boolean(globalThis.lastAdPopup), closed: globalThis.lastAdPopup?.closed ?? null })).catch(() => null), openPageUrls: (await browser.pages()).map(value => safeUrl(value.url())) }); } await persist(); if (requirePopup && result.tests.at(-1).status === 'FAIL') { criticalGateFailed = true; stopping = true; throw new Error(`Required fixture failed at: ${name}`); } }
 await check('ordinary window.open preserved', async () => { const created = browser.waitForTarget(target => target.type() === 'page' && target.url().includes('/oauth-result'), { timeout: 2500 }); void created.catch(() => {}); await click(page, '#oauth'); const popup = await (await created).page(); assert.ok(popup); await popup.close(); return 'New same-origin window loaded; no account or credentials involved.'; });
 await check('native file chooser opens and cancels', async () => { const pending = page.waitForFileChooser({ timeout: 2500 }); void pending.catch(() => {}); await click(page, '#file'); const chooser = await pending; await chooser.cancel(); assert.equal(await page.$eval('#file', element => element.files.length), 0); return 'Canceled; no local file selected or uploaded.'; });
 await check('native locally generated video plays pauses and seeks', async () => { await click(page, '#generate'); await page.waitForFunction(() => document.querySelector('#native').currentTime > 0.1, { timeout: 4000, polling: 100 }); return page.$eval('#native', video => { video.pause(); const duration = video.duration; video.currentTime = 0.1; return { nativeControls: video.controls, duration, paused: video.paused, error: video.error?.code ?? null, source: 'browser-generated canvas WebM; no remote media' }; }); });
 if (id.startsWith('bloku')) {
  const before = await rpc(options, 'GET_STATE'); const snapshot = canonicalState(before.state);
  await check('targeted popup opens before adding rule', async () => {
   const target = browser.waitForTarget(target => target.type() === 'page' && target.url().includes('ads-popup.bloku.test'), { timeout: 2500 }); void target.catch(() => {});
   await click(page, '#designated-popup-trigger'); const popup = await (await target).page();
   assert.equal(await page.evaluate(() => globalThis.lastAdPopup?.closed), false, 'Control popup did not open');
   await popup.close(); return { popupOpenedBeforeRule: true, path: 'native window.open from real click' };
  });
  await check(requirePopup ? 'REQUIRED stock SDK local popup rule accepted and selective closure verified' : 'stock SDK local popup-rule acceptance or confirmed rejection', async () => {
   const next = structuredClone(before.state); next.userRulesText += '\n||ads-popup.bloku.test^$popup,domain=fixture.bloku.test';
   const reply = await rpc(options, 'UPDATE_STATE', next);
   if (!reply.ok) {
    const after = await rpc(options, 'GET_STATE'); assert.deepEqual(canonicalState(after.state), snapshot);
    const diagnostic = { accepted: false, error: reply.error, engine: reply.engine, originalStatePreserved: true };
    result.popupDiagnostic = diagnostic;
    if (requirePopup) throw new Error(`Required popup rule rejected: ${JSON.stringify(diagnostic)}`);
    return diagnostic;
   }
   await page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
   const cases = []; result.popupProgress = { accepted: true, cases };
   for (const [button, description] of [['#designated-popup-trigger', 'immediate targeted window.open'], ['#delayed-popup-trigger', 'about:blank then delayed navigation']]) {
    result.popupProgress.currentCase = description; await click(page, button); await page.waitForFunction(() => globalThis.lastAdPopup?.closed === true, { timeout: 2500, polling: 100 });
    cases.push({ case: description, nativeWindowReferenceClosed: true });
   }
   const pending = browser.waitForTarget(target => target.type() === 'page' && target.url().includes('/oauth-result'), { timeout: 2500 }); void pending.catch(() => {});
   await click(page, '#oauth'); const oauth = await (await pending).page(); assert.ok(oauth); await oauth.close();
   cases.push({ case: 'ordinary OAuth-like window.open while rule enabled', opened: true });
   const direct = await browser.newPage(); await configurePage(direct);
   try { await direct.goto(`http://ads-popup.bloku.test:${port}/popup`, { waitUntil: 'domcontentloaded', timeout: 5000 }); await direct.waitForSelector('h1', { timeout: 1500 }); assert.ok(direct.url().includes('ads-popup.bloku.test')); cases.push({ case: 'direct tab navigation to popup target', documentNotGloballyBlocked: true }); }
   finally { await direct.close(); }
   return { accepted: true, cases, limitation: 'Owned immediate and 50ms delayed popup cases; no universal popunder guarantee.' };
  });
  const restore = await rpc(options, 'UPDATE_STATE', before.state); assert.equal(restore.ok, true); const after = await rpc(options, 'GET_STATE'); assert.deepEqual(canonicalState(after.state), snapshot, 'Fixture left semantically modified settings');
 }
 await page.close(); await persist();
 if (requirePopup && result.tests.some(test => test.status === 'FAIL')) { criticalGateFailed = true; stopping = true; throw new Error('Required popup/fixture gate failed; stopped before public observations.'); }
}
async function heavySite(initialPage, result) {
 const action = { action: 'bounded catalog-detail-player real click path', stages: [], status: 'LIMITED', downloads: 'denied', maximumPlayerObservationMs: 5000 };
 result.actions.push(action);
 let page = initialPage;
 async function safety(value) {
  return value.evaluate(() => { const text = (document.body?.innerText || '').slice(0, 3500); return { challenge: /just a moment|access denied|security check|robot check/i.test(document.title) || /verify you are human|complete the captcha|checking your browser/i.test(text), gated: /\/(login|signin|payment|checkout)(\/|$)/i.test(location.pathname), password: [...document.querySelectorAll('input[type=password]')].some(node => node.getBoundingClientRect().width > 0) }; }).catch(error => ({ unknown: true, reason: errorClass(error) }));
 }
 async function find(value, stage) {
  for (const handle of await value.$$('a[href],button,[role=button]')) {
   const allowed = await handle.evaluate((node, stage) => {
    const rect = node.getBoundingClientRect(), text = (node.textContent || '').trim().replace(/\s+/g, ' ');
    const watchLanding = stage === 'player' && text === 'المشاهدة والتحميل' && node instanceof HTMLAnchorElement && new URL(node.href).origin === location.origin;
    if (!rect.width || !rect.height || /captcha|verify|تسجيل|اشتراك|شراء|accept|agree|cookie|موافق/i.test(text) || (!watchLanding && /download|تحميل/i.test(text))) return false;
    if (stage === 'catalog') {
     if (!(node instanceof HTMLAnchorElement)) return false;
     try { const url = new URL(node.href); return url.origin === location.origin && url.pathname !== location.pathname && /مشاهدة\s+(فيلم|مسلسل)|watch.*(movie|episode)/i.test(text); } catch { return false; }
    }
    if (!watchLanding && !/^(?:مشاهدة(?: الآن| مباشرة)?|شاهد(?: الآن)?|تشغيل|watch(?: now| online)?|play(?: video)?)$/i.test(text)) return false;
    if (node instanceof HTMLAnchorElement) { try { const url = new URL(node.href); if (!['http:', 'https:'].includes(url.protocol) || /\.(mp4|mkv|zip|rar|exe|apk)(?:$|\?)/i.test(url.pathname)) return false; } catch { return false; } }
    return text.length < 160;
   }, stage).catch(() => false);
   if (allowed) return handle; await handle.dispose();
  }
  return null;
 }
 async function clickStage(handle, label) {
  const descriptor = await handle.evaluate(node => ({ text: (node.textContent || '').trim().slice(0, 100), destination: node instanceof HTMLAnchorElement ? node.href : null }));
  const before = page.url(), existing = new Set(await browser.pages());
  await page.bringToFront();
  const navigation = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).then(() => true, () => false);
  const point = await handle.evaluate(node => { node.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }); const r = node.getBoundingClientRect(); if(!r.width||!r.height)throw new Error('The observed watch control is not visible.'); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(point.x, point.y, { delay: 60 }); const navigationObserved=await navigation;
  const created = (await browser.pages()).filter(value => !existing.has(value));
  for (const candidate of created) { try { if (new URL(candidate.url()).hostname.endsWith('egydead.media') && candidate.url() !== before) { page = candidate; await configurePage(page); break; } } catch {} }
  action.stages.push({ stage: label, clicked: { text: descriptor.text, destination: descriptor.destination ? safeUrl(descriptor.destination) : null }, navigation: safeUrl(page.url()), domContentNavigationObserved: navigationObserved, newPageOrigins: created.map(value => { try { return new URL(value.url()).origin; } catch { return '[pending]'; } }) });
 }
 const catalog = await find(page, 'catalog');
 if (!catalog) { action.reason = 'No safe visible same-site catalog detail link'; return; }
 await clickStage(catalog, 'catalog to detail');
 const detailGate=await safety(page); if(detailGate.unknown){action.reason='Page state unavailable after catalog navigation; no challenge/authentication classification is established';action.stateError=detailGate.reason;return;} if (detailGate.challenge || detailGate.gated || detailGate.password) { action.reason = 'Observed challenge/authentication/payment gate after catalog click; stopped'; return; }
 if (new URL(page.url()).pathname === '/') { action.reason = 'Catalog click did not reach detail; possible intercepted click/popunder retained as evidence'; return; }
 const filename = `${result.variant}--egydead-detail.png`;
 await page.screenshot({ path: path.join(out, filename), timeout: 2500 }).then(() => { result.screenshots.push(filename); run.screenshots.push({ file: filename, qualification: 'NOT_MANUALLY_REVIEWED' }); }).catch(() => {});
 const play = await find(page, 'player');
 if (!play) { action.reason = 'No safe visible watch/play control; no download/security/account control used'; return; }
 await clickStage(play, 'detail to visible watch/play control');
 const gate = await safety(page);
 if (gate.unknown) { action.reason='Page state unavailable after watch navigation; player remains unqualified';action.stateError=gate.reason;return;}
 if (gate.challenge || gate.gated || gate.password) { action.reason = 'Challenge/authentication/payment gate after watch click; stopped'; return; }
 await wait(5000);
 action.playerFrames = [];
 for (const frame of page.frames()) {
  const observed = await frame.evaluate(() => ({ title: document.title.slice(0, 100), videos: [...document.querySelectorAll('video')].slice(0, 3).map(video => { const value = { paused: video.paused, readyState: video.readyState, currentTime: video.currentTime, error: video.error?.code ?? null }; video.pause(); return value; }), iframeOrigins: [...document.querySelectorAll('iframe[src]')].slice(0, 10).map(node => { try { return new URL(node.src, location.href).origin; } catch { return '[invalid]'; } }) })).catch(() => null);
  action.playerFrames.push({ url: safeUrl(frame.url()), observed });
 }
 action.status = 'WATCH_LANDING_OBSERVED_PLAYER_UNQUALIFIED';
 action.limitation = 'Five seconds only; content ads versus program content not classified; no full film, downloads or guarantee of playback.';
 const playerShot = `${result.variant}--egydead-player.png`;
 await page.screenshot({ path: path.join(out, playerShot), timeout: 2500 }).then(() => { result.screenshots.push(playerShot); run.screenshots.push({ file: playerShot, qualification: 'NOT_MANUALLY_REVIEWED' }); }).catch(() => {});
}
async function publicCase(id, site) {
 const result = { variant: id, site: site.id, requested: safeUrl(site.url), scope: site.scope, status: 'UNCLASSIFIED', navigation: null, consoleErrors: [], pageErrors: [], failedRequests: [], newTargets: [], dialogs: [], actions: [], screenshots: [], limit: 'Public unauthenticated bootstrap only; no authenticated editing, export, publishing, payment, meeting or universal ad-blocking qualification.' };
 const page = await browser.newPage(); await configurePage(page);
 const primaryTarget = page.target(); currentPrimaryTarget = primaryTarget; currentCase = result;
 page.on('console', message => { if (message.type() === 'error' && result.consoleErrors.length < 30) result.consoleErrors.push({ type: 'error', location: safeUrl(message.location().url), text: 'omitted to avoid website tokens or user data' }); });
 page.on('pageerror', error => { if (result.pageErrors.length < 20) result.pageErrors.push({ class: errorClass(error) }); });
 page.on('requestfailed', request => { if (result.failedRequests.length < 80) result.failedRequests.push({ url: safeUrl(request.url()), type: request.resourceType(), failure: errorClass(request.failure()?.errorText) }); });
 page.on('framenavigated', frame => { if (frame === page.mainFrame()) result.navigation = safeUrl(frame.url()); });
 try {
  let response;
  try { response = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: navigationMs }); } catch (error) { result.navigationError = errorClass(error); }
  await wait(site.id === 'meta-business' ? metaSettleMs : 800);
  result.httpStatus = response?.status() ?? null;
  const probe = await page.evaluate(() => {
   const body = document.body?.innerText ?? '', sample = `${document.title}\n${body.slice(0, 5000)}`.toLowerCase();
   const visible = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
   return { title: document.title.slice(0, 140), textCharacters: body.length, visibleLinks: [...document.querySelectorAll('a[href]')].filter(visible).length, challenge: /just a moment|access denied|security check|robot check/i.test(document.title) || (body.length < 3000 && /verify (that )?you are human|unusual traffic|checking your browser|complete the captcha/.test(sample)), authGate: /\/(loginpage|login|signin|sign-in|auth)(\/|$)/i.test(location.pathname) || [...document.querySelectorAll('input[type=password]')].some(visible), consent: [...document.querySelectorAll('[role=dialog],dialog[open]')].some(visible), adblockWall: /disable your ad.?block|turn off your ad.?block|ad.?blocker detected/.test(sample), video: [...document.querySelectorAll('video')].map(video => ({ paused: video.paused, readyState: video.readyState, currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null, error: video.error?.code ?? null })).slice(0, 3), iframeOrigins: [...document.querySelectorAll('iframe[src]')].slice(0, 15).map(frame => { try { return new URL(frame.src, location.href).origin; } catch { return '[invalid]'; } }) };
  }).catch(() => null);
  result.probe = probe;
  result.status = !probe ? 'NAVIGATION_FAILED' : result.httpStatus >= 400 ? 'HTTP_ERROR_LIMITED' : probe.challenge ? 'CHALLENGE_LIMITED' : probe.authGate ? 'AUTHENTICATION_LIMITED' : probe.adblockWall ? 'ADBLOCK_WALL_LIMITED' : probe.textCharacters < 100 ? 'SHELL_LIMITED' : probe.consent ? 'PUBLIC_BOOTSTRAP_MODAL_LIMITED' : 'PUBLIC_BOOTSTRAP_OBSERVED';
  if (probe && !probe.challenge && !probe.authGate && !probe.adblockWall) {
   const before = await page.evaluate(() => scrollY); await page.evaluate(() => scrollBy(0, 320)); await wait(100); result.actions.push({ action: 'scroll', moved: await page.evaluate(() => scrollY) !== before }); await page.evaluate(() => scrollTo(0, 0));
   if (site.id === 'canva-templates') {
    const inputSelector = 'input[type=search],input[placeholder*="Search" i]';
    const field = await page.$(inputSelector);
    if (field && await field.isVisible()) { await field.type('presentation', { delay: 20 }); result.actions.push({ action: 'public template search field typing only', submitted: false, typed: await field.evaluate(element => element.value === 'presentation') }); }
    else result.actions.push({ action: 'public template search', status: 'LIMITED_NO_VISIBLE_FIELD' });
   }
   if (site.id.startsWith('youtube-')) {
    const play = await page.$('button.ytp-large-play-button');
    if (play && await play.isVisible()) { await click(page, 'button.ytp-large-play-button').catch(() => {}); await wait(1800); result.actions.push({ action: 'public video play click', observation: await page.$$eval('video', videos => videos.map(video => ({ paused: video.paused, currentTime: video.currentTime, readyState: video.readyState, error: video.error?.code ?? null }))), adObservation: await page.evaluate(() => ({ adClass: Boolean(document.querySelector('.ad-showing,.ad-interrupting')), visibleAdSlots: [...document.querySelectorAll('ytd-ad-slot-renderer,.ytp-ad-player-overlay')].filter(node => node.getBoundingClientRect().height > 0).length })), limitation: 'Short playback observation; no ad opportunity baseline/mid-roll guarantee.' }); await page.$$eval('video', videos => videos.forEach(video => video.pause())); }
   }
   if (site.id === 'egydead-a1') await heavySite(page, result);
  }
  const filename = `${id}--${site.id}.png`;
  await page.screenshot({ path: path.join(out, filename), timeout: 2500 }).then(() => { result.screenshots.push(filename); run.screenshots.push({ file: filename, qualification: 'NOT_MANUALLY_REVIEWED' }); }).catch(error => { result.screenshotError = errorClass(error); });
 } catch (error) { result.status = 'HARNESS_ERROR'; result.error = errorClass(error); }
 finally {
  result.newTargets = result.newTargets.filter(event => event.url && event.url !== 'about:blank');
  currentCase = null; currentPrimaryTarget = null;
  for (const target of browser?.targets() ?? []) if (target.type() === 'page' && target !== primaryTarget && !target.url().startsWith('chrome-extension:')) { const extra = await target.page().catch(() => null); await extra?.close().catch(() => {}); }
  await page.close().catch(() => {}); run.results.push(result); await persist();
 }
}
try {
 server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); if (req.url === '/oauth-result') res.end('<!doctype html><title>Owned OAuth-like return</title><p>No real authentication occurred.</p>'); else if (req.url === '/frame') res.end('<!doctype html><title>Owned frame</title><p id="frame-hide">Frame hide target</p>'); else res.end(fixtureHtml(req.headers.host)); });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
 const bloku = path.join(work, 'bloku-package'); await cp(input, bloku, { recursive: true, filter: source => path.basename(source) !== '_metadata' }); await verifyBloku(bloku);
 const directories = { 'bloku-default': bloku, 'bloku-ar': bloku };
 for (const source of official) if (variantIds.includes(source.id)) { directories[source.id] = path.join(work, source.id); await extract(source, directories[source.id]); }
 const hashes = Object.fromEntries(await Promise.all([...new Set(Object.values(directories))].map(async directory => [directory, await treeHash(directory)])));
 watchdog = setTimeout(() => { stopping = true; run.status = 'BUDGET_REACHED'; void closeBrowser(); }, Math.max(1, deadline - Date.now()));
 if (metaControl && Date.now() < deadline - 20_000) {
  try { await setup('no-extension', undefined); await publicCase('no-extension-meta-control', sites.find(site => site.id === 'meta-business')); }
  catch (error) { run.failures.push({ variant: 'no-extension-meta-control', error: errorClass(error) }); }
  finally { await closeBrowser(); }
 }
 for (const variant of variantIds) {
  if (Date.now() > deadline - 15_000 || stopping) break;
  try {
   const options = await setup(variant, directories[variant]);
   if (Date.now() < deadline - 20_000) await fixtures(variant, options);
   for (const site of sites) { if (Date.now() > deadline - 8_000 || stopping) break; await publicCase(variant, site); console.log(`${variant}/${site.id}: ${run.results.at(-1).status}`); }
  } catch (error) { run.failures.push({ variant, error: errorClass(error), detail: String(error.message).slice(0, 1600) }); }
  finally { currentCase = null; await closeBrowser(); }
 }
 for (const [directory, expected] of Object.entries(hashes)) assert.equal(await treeHash(directory), expected, 'Loaded snapshot package bytes changed');
 await verifyBloku(input);
 run.status = criticalGateFailed ? 'REQUIRED_FIXTURE_FAILED_STOPPED' : stopping || Date.now() >= deadline - 8_000 ? 'BUDGET_REACHED_PARTIAL' : run.failures.length ? 'COMPLETED_WITH_HARNESS_FAILURES' : 'COMPLETE_BOUNDED_OBSERVATIONS';
} catch (error) { run.status = 'HARNESS_FAILED'; run.failures.push({ error: errorClass(error) }); }
finally {
 clearTimeout(watchdog); await closeBrowser();
 if (server) await new Promise(resolve => server.close(resolve));
 await rm(work, { recursive: true, force: true }); run.cleanup.push('Only this run browser/profile/snapshots/server removed; cached inputs unchanged.');
 for (const variant of variantIds) for (const site of sites) if (!run.results.some(result => result.variant === variant && result.site === site.id)) run.unattempted.push({ variant, site: site.id, reason: run.status });
 run.finishedAt = new Date().toISOString(); run.elapsedMs = Date.now() - startedAt; await persist();
 const rows = run.results.map(result => `| ${result.variant} | ${result.site} | ${result.status} | ${result.failedRequests.length} | ${result.newTargets.length} |`).join('\n');
 await writeFile(path.join(out, 'report.md'), `# Bounded extension behavior observations\n\nStatus: ${run.status}. Browser: ${run.browserVersion || 'unavailable'}. Completed ${run.results.length}/${variantIds.length * sites.length + (metaControl ? 1 : 0)} public attempts in ${Math.round(run.elapsedMs / 1000)} seconds. Package fingerprint: ${fingerprint}.\n\nThis run is public, logged-out bootstrap evidence. No authenticated editor/export/dashboard, real OAuth, payments, meetings, native toolbar/context-menu, full-video/mid-roll or universal ad-blocking acceptance is implied. Request failures and closed targets are observations, not verified ads. Screenshots require manual review. Comparator versions are cached byte-verified official archives, not a claim of newest versions. Comparator settings/rulesets are recorded in results.json. BLOKU + Arabic is an explicit separate configuration. No CPU/speed ranking is attempted.\n\n| Variant | Site | Observation | Failed requests | New/changed page targets |\n| --- | --- | --- | --- | --- |\n${rows}\n\nUnattempted: ${run.unattempted.length}. Harness failures: ${run.failures.length}. Local synthetic fixture results and sanitized network/console/target evidence are in results.json. URL queries/fragments and long/token-like path components are omitted; no headers, bodies, cookies or credentials are captured.\n`);
 console.log(JSON.stringify({ status: run.status, results: run.results.length, unattempted: run.unattempted.length, failures: run.failures.length, output: out }));
}
