import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

// This runner never builds or changes dist. Run only after the coordinator grants the browser lane.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extension = process.env.BLOKU_EXTENSION_PATH ? path.resolve(process.env.BLOKU_EXTENSION_PATH) : path.join(root, 'dist');
const packageArchive=process.env.BLOKU_PACKAGE_ARCHIVE?{name:path.basename(process.env.BLOKU_PACKAGE_ARCHIVE),sha256:createHash('sha256').update(await readFile(process.env.BLOKU_PACKAGE_ARCHIVE)).digest('hex')}:null;
const output = path.join(root, 'artifacts/qualification');
const reportPath = path.join(root, '..', 'docs/RUNTIME_QUALIFICATION.md');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const profile = path.join(root, 'engine/.cache', `runtime-profile-${runId}`);
const manifestBytes = await readFile(path.join(extension, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const checksumBytes = await readFile(path.join(extension, 'checksums.json'));
const packageChecksums = JSON.parse(checksumBytes);
const english=JSON.parse(await readFile(path.join(extension,'locales/en.json'),'utf8'));
for (const [file, expected] of Object.entries(packageChecksums)) {
  const actual = createHash('sha256').update(await readFile(path.join(extension, file))).digest('hex');
  assert.equal(actual, expected, `Actual dist differs from packaged checksum: ${file}`);
}
assert.equal(manifest.version, '2.0.0', 'Runtime gate requires the actual 2.0.0 dist package');
await mkdir(output, { recursive: true });
const cache = path.join(root, 'engine/.cache/browser/chrome');
const builds = process.env.BLOKU_CHROME_PATH ? [] : (await readdir(cache)).sort();
const executablePath = process.env.BLOKU_CHROME_PATH || path.join(cache, builds.at(-1), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const results = [], errors = [], outbound = [], screenshots = [], fixtureRequests = [];
const instrumented = new Map();
const workerInspectionSessions=[];let restartingWorker=false;
let browser, extensionId, options, fixture, popup, port, browserVersion, currentPhase = 'startup';
const server = http.createServer((req, res) => {
  fixtureRequests.push({ host: req.headers.host, path: req.url });
  if(req.url?.startsWith('/consent')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><title>Owned consent fixture</title><div id="cbPopupWrap" class="cb-popup--open" style="padding:30px"><p>Owned test consent dialog</p><button id="cbRefuseTrigger">Reject optional</button><button id="cbAcceptTrigger">Accept optional</button></div><div id="unsupported-banner">Unsupported dialog remains usable</div><script>document.querySelector('#cbRefuseTrigger').onclick=()=>{document.documentElement.dataset.consentDecision='reject';document.querySelector('#cbPopupWrap').remove();};document.querySelector('#cbAcceptTrigger').onclick=()=>document.documentElement.dataset.consentDecision='accept';</script>`);return;}
  if (req.url?.startsWith('/fixture.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end('window.fixtureScriptLoaded=(window.fixtureScriptLoaded||0)+1;'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Bloku local runtime fixture</title></head><body style="font:18px system-ui;padding:50px"><h1>Owned local fixture</h1><p id="fixture-hide">This element can be hidden while ads are paused.</p><button id="pick-me" style="margin:30px;padding:25px">Pick this element</button><button id="spa">Navigate within this page</button><p><a id="plain" href="/landing?utm_source=fixture&fbclid=fixture&keep=yes">Ordinary tracked link</a></p><p><a id="signed" href="/landing?utm_source=fixture&signature=owned-test-signature&keep=yes">Signed link</a></p><script>document.querySelector('#spa').onclick=()=>history.pushState({},'', '?view=spa');document.querySelectorAll('a').forEach(a=>a.addEventListener('click',event=>event.preventDefault()));</script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
port = server.address().port;
const fixtureUrl = `http://site.bloku.test:${port}/`;
const host = 'site.bloku.test';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(task, message, timeout = 15000) { const started = Date.now(); let last; while (Date.now() - started < timeout) { try { const value = await task(); if (value) return value; } catch (error) { last = error; } await wait(100); } throw new Error(`${message}${last ? `: ${last.message}` : ''}`); }
class SkippedCheck extends Error{}
async function check(name, task) { currentPhase = name; const started = Date.now(); try { await task(); results.push({ name, pass: true, ms: Date.now() - started }); console.log(`PASS ${name}`); return true; } catch (error) { if(error instanceof SkippedCheck){results.push({name,pass:false,skip:true,reason:error.message,ms:Date.now()-started});console.log(`SKIP ${name}: ${error.message}`);return true;}results.push({ name, pass: false, ms: Date.now() - started, error: String(error), stack: error.stack }); console.error(`FAIL ${name}: ${error.stack || error}`); return false; } }
async function instrument(target) {
  if (instrumented.has(target)) return instrumented.get(target);
  const operation = (async () => {
  if (!['page', 'service_worker'].includes(target.type()) || (restartingWorker&&target.type()==='service_worker')) return;
  try {
    const session = await target.createCDPSession();
    if(target.type()==='service_worker')workerInspectionSessions.push(session);
    await session.send('Network.enable');
    session.on('Fetch.requestPaused', async event => {
      try {
        const url = new URL(event.request.url);
        if (url.hostname.endsWith('.bloku.test') || url.hostname === '127.0.0.1') await session.send('Fetch.continueRequest', { requestId: event.requestId });
        else { outbound.push({ phase: currentPhase, target: target.type(), origin: url.origin, path: url.pathname }); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); }
      } catch { /* Target may close during worker termination. */ }
    });
    await session.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
    session.on('Runtime.exceptionThrown', event => errors.push({ phase: currentPhase, target: target.type(), message: event.exceptionDetails.exception?.description ?? event.exceptionDetails.text }));
    await session.send('Runtime.enable');
  } catch (error) { throw new Error(`Target instrumentation failed: ${error.message}`); }
  })(); instrumented.set(target, operation); return operation;
}
async function page(viewport) { const value = await browser.newPage(); const waitForFunction=value.waitForFunction.bind(value);value.waitForFunction=(fn,options,...args)=>waitForFunction(fn,{polling:100,...options},...args); await instrument(value.target()); if (viewport) await value.setViewport(viewport); value.on('pageerror', error => errors.push({ phase: currentPhase, target: 'page', message: error.message })); value.on('console', message => { if (message.type() === 'error') errors.push({ phase: currentPhase, target: 'console', message: message.text() }); }); return value; }
let readRetries=0;
async function message(action,payload){return options.evaluate(({action,payload})=>Promise.race([chrome.runtime.sendMessage({type:'BLOKU_V2',action,payload}),new Promise(resolve=>setTimeout(()=>resolve({ok:false,error:'runtime-read-timeout'}),10000))]),{action,payload});}
async function request(action, payload) { let reply = await message(action, payload);if(action==='GET_STATE'&&reply?.error==='runtime-read-timeout'){readRetries++;reply=await message(action,payload);} assert.equal(reply?.ok, true, `${action}: ${JSON.stringify(reply)}`); return reply; }
async function getState() { return (await request('GET_STATE')).state; }
async function update(change) { const state = await getState(); change(state); return request('UPDATE_STATE', state); }
async function shot(value, name) { if(process.env.BLOKU_SKIP_SCREENSHOTS==='1')return;const filename = `runtime-${name}.png`; await value.screenshot({ path: path.join(output, filename), fullPage: true }); screenshots.push(filename); }
async function go(value = fixture, url = fixtureUrl) { try { await value.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch (error) { if (!/ERR_BLOCKED_BY_CLIENT|ERR_ABORTED/.test(String(error))) throw error; } }
async function contentMessage(action, payload) {
  const tabId = await options.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(url))?.id, fixtureUrl.split('?')[0]);
  assert.ok(tabId, 'Fixture tab must be present for isolated-world sender test');
  return options.evaluate(async ({ tabId, action, payload }) => {
    const result = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, world: 'ISOLATED', func: (action, payload) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), args: [action, payload] });
    return result[0]?.result;
  }, { tabId, action, payload });
}
async function clickClosedShadowButton(value, label) {
  const session = await value.createCDPSession();
  try {
    
    function text(node) { return (node.nodeValue || '') + (node.children || []).map(text).join(''); }
    function find(node) { if (node.nodeName === 'BUTTON' && text(node).trim() === label) return node; for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) { const match = find(child); if (match) return match; } }
    const node = await until(async()=>{const {root:doc}=await session.send('DOM.getDocument',{depth:-1,pierce:true});return find(doc);},`Actual closed-shadow button not found: ${label}`,5000);
    const { model } = await session.send('DOM.getBoxModel', { nodeId: node.nodeId });
    const quad = model.content; await value.mouse.click((quad[0] + quad[2] + quad[4] + quad[6]) / 4, (quad[1] + quad[3] + quad[5] + quad[7]) / 4);
  } finally { await session.detach(); }
}
async function click(value,selector){const point=await value.$eval(selector,node=>{node.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=node.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});await value.mouse.click(point.x,point.y);}
async function clickText(value,selector,label){const point=await value.$$eval(selector,(nodes,label)=>{const node=nodes.find(node=>node.textContent===label);if(!node)throw new Error(`Control not found: ${label}`);node.scrollIntoView({block:'center',inline:'center',behavior:'instant'});const r=node.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},label);await value.mouse.click(point.x,point.y);}
async function openOptionsSection(label){await options.bringToFront();await clickText(options,'nav button',label);await options.waitForFunction(label=>document.querySelector('main h1')?.textContent===label,{polling:100},label);}
async function refreshPopup(){await fixture.bringToFront();await popup.reload({waitUntil:'domcontentloaded'});await popup.waitForSelector('#app h1');}
async function loadScript() { return fixture.evaluate(url => new Promise(resolve => { const script = document.createElement('script'); script.src = `${url}?probe=${Date.now()}`; script.onload = () => resolve(true); script.onerror = () => resolve(false); document.body.append(script); setTimeout(() => resolve('timeout'), 5000); }), `http://ads.bloku.test:${port}/fixture.js`); }

try {
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--host-resolver-rules=MAP *.bloku.test 127.0.0.1'] });
  browser.on('targetcreated', target => { void instrument(target).catch(error => errors.push({ phase: currentPhase, target: target.type(), message: error.message })); });
  for (const target of browser.targets()) await instrument(target);
  const workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'), { timeout: 30000 });
  extensionId = new URL(workerTarget.url()).host;
  browserVersion = await browser.version();
  options = await page({ width: 1440, height: 1100 });
  await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });
  const initialReply = await request('GET_STATE');
  assert.ok(initialReply.state, `Production state unavailable: ${JSON.stringify(initialReply)}`);
  assert.equal(initialReply.engine?.ok, true, `Production worker initialization failed: ${JSON.stringify({ error: initialReply.error, engine: initialReply.engine })}`);
  fixture = await page({ width: 1280, height: 900 });
  await go();

  await check('actual dist English options and popup render without errors', async () => {
    const initial = await getState();
    assert.equal(initial.preferences.rejectConsent, false); assert.equal(initial.preferences.cleanUrls, false); assert.equal(initial.preferences.gpc, false); assert.equal(initial.preferences.activityEnabled, false);
    for (const key of ['licenseKey', 'userEmail', 'deviceId', 'subscriptionId', 'polarSubscriptionId']) assert.equal(key in initial, false);
    await options.waitForSelector('main h1'); assert.equal(await options.$eval('html', node => node.lang), 'en');
    await shot(options, 'options-en');
    popup = await page({ width: 420, height: 800 }); await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' }); await popup.waitForSelector('#app h1'); await shot(popup, 'popup-en');
    assert.deepEqual(errors, [], 'UI/runtime errors during fresh default startup'); assert.deepEqual(outbound, [], 'Unexpected default outbound network attempt');
  });

  await check('configured local focus activity accrues from real browser observations', async () => {
    await update(state => { state.preferences.activityEnabled = true; state.focusProfiles = [{ id: 'runtime-focus', name: 'Runtime focus', domains: [host], enabled: false, schedules: [], dailyAllowanceMinutes: null }]; });
    const idle=await options.evaluate(()=>chrome.idle.queryState(60));if(idle!=='active')throw new SkippedCheck(`Host system is ${idle}; browser-generated input does not establish real user activity.`);
    await fixture.bringToFront(); await fixture.reload({ waitUntil: 'domcontentloaded' }); await wait(1200); await fixture.reload({ waitUntil: 'domcontentloaded' });
    await until(async () => (await getState()).activity.some(day => (day.domainSeconds[host] ?? 0) > 0), 'Foreground fixture usage did not create positive observed activity');
  });

  await check('popup shows inherited ad pauses and global off state accurately',async()=>{
    await request('SITE_PAUSE',{domain:'bloku.test',paused:true,minutes:10});const deadline=(await getState()).sitePolicies.find(policy=>policy.domain==='bloku.test').adsPausedUntil;await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main>label textarea');await options.$eval('main>label textarea',node=>{node.value+='\nunused.bloku.test';node.dispatchEvent(new Event('input',{bubbles:true}));});await click(options,'main>button.primary');await until(async()=>(await getState()).sitePolicies.some(policy=>policy.domain==='unused.bloku.test'),'Edited pause list was not saved');assert.equal((await getState()).sitePolicies.find(policy=>policy.domain==='bloku.test').adsPausedUntil,deadline,'Editing another site converted a timed pause to permanent');await refreshPopup();
    await popup.waitForFunction(label=>document.body.innerText.includes(label),{polling:100},english.adsPaused);
    assert.ok(await popup.evaluate(label=>document.body.innerText.includes(label),english.inheritedPause.replace('{domain}','bloku.test')));
    assert.equal(await popup.$$eval('button',(nodes,label)=>nodes.some(node=>node.textContent===label),english.resume),false,'A child must not silently remove a parent pause');
    await update(state=>{state.preferences.adsEnabled=false;});await refreshPopup();await popup.waitForFunction(label=>document.body.innerText.includes(label),{polling:100},english.adsOff);
    await update(state=>{state.preferences.adsEnabled=true;});await request('SITE_PAUSE',{domain:'bloku.test',paused:false,minutes:null});await request('SITE_PAUSE',{domain:'unused.bloku.test',paused:false,minutes:null});
  });

  let stale, activeId, pausedPolicies;
  await check('starting focus blocks an already-open local SPA despite ad pause', async () => {
    await request('SITE_PAUSE', { domain: host, paused: true, minutes: null });
    await update(state => { state.userRulesText = '||ads.bloku.test^$script'; });
    await go(); await click(fixture,'#spa'); await fixture.waitForFunction(()=>location.search.includes('view=spa'),{timeout:5000}); assert.match(fixture.url(), /view=spa/);
    stale = await getState(); pausedPolicies = structuredClone(stale.sitePolicies);
    const reply = await request('START_FOCUS', { profileId: 'runtime-focus', minutes: 25 }); activeId = reply.state.focusSessions.at(-1).id;
    await fixture.waitForFunction(id => location.href.startsWith(`chrome-extension://${id}/blocked.html`), { timeout: 15000 }, extensionId); await fixture.waitForSelector('h1'); await shot(fixture, 'blocked');
    assert.deepEqual((await getState()).sitePolicies, pausedPolicies);
  });

  await check('stale full settings snapshot preserves live focus and activity', async () => {
    assert.ok(stale && activeId, 'Prior real session setup must pass');
    const before = await getState(); stale.preferences.theme = 'dark'; const reply = await request('UPDATE_STATE', stale);
    assert.ok(reply.state.focusSessions.some(session => session.id === activeId), 'Stale theme save erased active session');
    assert.deepEqual(reply.state.activity, before.activity, 'Stale theme save erased observed activity');
    assert.deepEqual(reply.state.sitePolicies, pausedPolicies);
  });

  await check('five-minute break and ending focus preserve the ad pause', async () => {
    assert.ok(activeId, 'Prior session setup must pass');
    const before = Date.now(); let reply = await request('BREAK_FOCUS', { sessionId: activeId }); const session = reply.state.focusSessions.find(item => item.id === activeId);
    assert.ok(session.breakUntil >= before + 299000 && session.breakUntil <= Date.now() + 300000);
    assert.deepEqual(reply.state.sitePolicies, pausedPolicies);
    await go(); assert.match(fixture.url(), /^http:/); assert.equal(await loadScript(), true, 'Paused site should permit fixture ad script during break');
    reply = await request('END_FOCUS', { sessionId: activeId }); assert.equal(reply.state.focusSessions.some(item => item.id === activeId), false); assert.deepEqual(reply.state.sitePolicies, pausedPolicies);
    assert.equal(await loadScript(), true, 'Ending focus must not remove ad pause');
  });

  await check('saved content hide toggles while network ads remain paused', async () => {
    await update(state => { state.distractionRules[host] = ['#fixture-hide']; });
    await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#fixture-hide')).display === 'none');
    assert.equal(await loadScript(), true);
    await update(state => { state.distractionRules[host] = []; });
    await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#fixture-hide')).display !== 'none');
  });

  await check('actual picker preview, same-host persistence, reload and undo', async () => {
    await fixture.bringToFront();
    const tabId = await options.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(url))?.id, fixtureUrl);
    await request('PICK_ELEMENT', { tabId }); await wait(250); await click(fixture,'#pick-me');
    assert.equal(await fixture.$eval('#pick-me', node => getComputedStyle(node).display), 'none', 'Picker must preview actual hide');
    await clickClosedShadowButton(fixture, 'Hide this element');
    await until(async () => (await getState()).distractionRules[host]?.includes('#pick-me'), 'Picker selector was not persisted');
    await clickClosedShadowButton(fixture, 'Undo last hide');
    await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#pick-me')).display !== 'none');
    assert.equal((await getState()).distractionRules[host].includes('#pick-me'), false, 'Undo did not remove persisted selector');
    // Save a second time and verify the actual stored rule is re-applied after reload.
    await request('PICK_ELEMENT', { tabId }); await wait(200); await click(fixture,'#pick-me'); await clickClosedShadowButton(fixture, 'Hide this element');
    await until(async () => (await getState()).distractionRules[host]?.includes('#pick-me'), 'Second picker save failed'); await fixture.reload({ waitUntil: 'domcontentloaded' }); await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#pick-me')).display === 'none');
    await update(state => { state.distractionRules[host] = []; });
  });

  await check('saved selector editing and deletion change real page content through settings',async()=>{
    await update(state=>{state.distractionRules[host]=['#fixture-hide'];});await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');await openOptionsSection(english.distractions);
    await options.waitForSelector('main .rule-item input');await options.$eval('main .rule-item input',node=>{node.value='#pick-me';node.dispatchEvent(new Event('input',{bubbles:true}));});
    await click(options,'main>button.primary');await until(async()=>(await getState()).distractionRules[host]?.includes('#pick-me'),'Edited selector was not saved');
    await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#pick-me')).display==='none'&&getComputedStyle(document.querySelector('#fixture-hide')).display!=='none',{polling:100});
    await click(options,'main .rule-item button');await click(options,'main>button.primary');await until(async()=>(await getState()).distractionRules[host]?.length===0,'Selector deletion was not saved');await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#pick-me')).display!=='none',{polling:100});
  });

  await check('real settings file import uses explicit validated action and never replays timers',async()=>{
    const before=await getState(),imported=structuredClone(before);imported.preferences.theme=before.preferences.theme==='dark'?'light':'dark';imported.focusSessions=[];
    const file=path.join(output,'runtime-import-fixture.json');await writeFile(file,JSON.stringify({format:'bloku-settings',version:2,state:imported}));
    await openOptionsSection(english.rules);await options.evaluate(()=>{globalThis.__blokuObservedActions=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(message,...args)=>{globalThis.__blokuObservedActions.push(message.action);return original(message,...args);};});
    await (await options.$('main input[type=file]')).uploadFile(file);await options.waitForFunction(label=>document.querySelector('[role=status]')?.textContent===label,{polling:100},english.importReady);
    assert.equal((await getState()).preferences.theme,before.preferences.theme,'Import preview applied before Save');await click(options,'main>button.primary');await until(async()=>(await getState()).preferences.theme===imported.preferences.theme,'Import Save did not commit');
    assert.equal(await options.evaluate(()=>globalThis.__blokuObservedActions.includes('IMPORT_STATE')),true,'UI bypassed explicit import validation');assert.deepEqual((await getState()).activity,before.activity);
    const replay=await getState();replay.focusSessions=[{id:'hostile-replayed-timer',profileId:'runtime-focus',startedAt:Date.now(),endsAt:Date.now()+1_500_000,breakUntil:null}];const reply=await message('IMPORT_STATE',replay);assert.equal(reply.ok,false);assert.match(reply.error,/Active sessions are not imported/);assert.equal((await getState()).focusSessions.length,0);
  });

  await check('popup reports recurring focus and settings expose seven weekday controls',async()=>{
    await update(state=>{state.focusProfiles.push({id:'schedule-status',name:'Schedule status fixture',domains:['scheduled.bloku.test'],enabled:true,schedules:[{days:[0,1,2,3,4,5,6],start:'00:00',end:'00:00'}],dailyAllowanceMinutes:null});});
    await refreshPopup();await popup.waitForFunction(label=>document.body.innerText.includes(label),{polling:100},english.focusActive);
    assert.ok(await popup.evaluate(label=>document.body.innerText.includes(label),english.schedules));
    await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');await openOptionsSection(english.focus);assert.equal(await options.$$eval('.weekdays input[type=checkbox]',nodes=>nodes.length),7);
    await update(state=>{state.focusProfiles=state.focusProfiles.filter(profile=>profile.id!=='schedule-status');});
  });

  await check('content-origin forged state update and cross-host picker writes are denied', async () => {
    await go(); const before = await getState(); const forged = structuredClone(before); forged.preferences.adsEnabled = !before.preferences.adsEnabled;
    const stateReply = await contentMessage('UPDATE_STATE', forged); assert.equal(stateReply?.ok, false); assert.match(stateReply.error, /only available from BLOKU settings/);
    const pickerReply = await contentMessage('SAVE_PICKER_RULE', { domain: 'other.bloku.test', selector: '#pick-me' }); assert.equal(pickerReply?.ok, false); assert.match(pickerReply.error, /Invalid element-hiding request/);
    const after = await getState(); assert.equal(after.preferences.adsEnabled, before.preferences.adsEnabled); assert.equal(after.distractionRules['other.bloku.test'], undefined);
  });

  await check('limited DOM privacy preference becomes true and original off state is restored', async () => {
    await go(); const before = await fixture.evaluate(() => ({ value: navigator.globalPrivacyControl, own: Object.prototype.hasOwnProperty.call(navigator, 'globalPrivacyControl') }));
    await update(state => { state.preferences.gpc = true; }); await fixture.waitForFunction(() => navigator.globalPrivacyControl === true);
    await update(state => { state.preferences.gpc = false; });
    await until(async () => { const after = await fixture.evaluate(() => ({ value: navigator.globalPrivacyControl, own: Object.prototype.hasOwnProperty.call(navigator, 'globalPrivacyControl') })); return JSON.stringify(after) === JSON.stringify(before); }, 'GPC off did not restore original navigator property');
  });

  await check('opt-in clicked-link cleanup removes trackers but preserves signed links', async () => {
    await update(state => { state.preferences.cleanUrls = true; }); await go();
    await fixture.waitForFunction(() => document.readyState !== 'loading'); await wait(250);
    const signed = await fixture.$eval('#signed', node => node.href); await click(fixture,'#signed'); assert.equal(await fixture.$eval('#signed', node => node.href), signed, 'Signed link changed');
    await click(fixture,'#plain'); const plain = new URL(await fixture.$eval('#plain', node => node.href)); assert.equal(plain.searchParams.has('utm_source'), false); assert.equal(plain.searchParams.has('fbclid'), false); assert.equal(plain.searchParams.get('keep'), 'yes');
    await update(state => { state.preferences.cleanUrls = false; });
  });

  await check('opt-in packaged consent rejects supported fixture without accepting or hiding unsupported dialogs',async()=>{
    await update(state=>{state.preferences.rejectConsent=false;});await go(fixture,fixtureUrl+'consent');await wait(500);assert.equal(await fixture.evaluate(()=>document.documentElement.dataset.consentDecision),undefined);
    await update(state=>{state.preferences.rejectConsent=true;});await fixture.waitForFunction(()=>document.documentElement.dataset.consentDecision==='reject',{timeout:15000});assert.equal(await fixture.$eval('#unsupported-banner',node=>getComputedStyle(node).display!=='none'),true);
    await update(state=>{state.preferences.rejectConsent=false;});await go();
  });

  await check('Arabic settings and popup render RTL without fallback errors', async () => {
    await update(state => { state.preferences.locale = 'ar'; }); await options.reload({ waitUntil: 'domcontentloaded' }); await options.waitForFunction(() => document.documentElement.dir === 'rtl' && document.querySelector('main h1')?.textContent?.includes('الحماية'));
    await shot(options, 'options-ar'); await popup.reload({ waitUntil: 'domcontentloaded' }); await popup.waitForFunction(() => document.documentElement.dir === 'rtl'); await shot(popup, 'popup-ar');
    await update(state => { state.preferences.locale = 'en'; });
  });

  await check('actual worker termination and UI wake preserve committed settings, usage and focus', async () => {
    await update(state => { state.distractionRules[host] = []; });
    const started = await request('START_FOCUS', { profileId: 'runtime-focus', minutes: 25 }); const session = started.state.focusSessions.at(-1); const before = await getState();
    const sessionCDP = await options.createCDPSession(); const versions = new Map(); sessionCDP.on('ServiceWorker.workerVersionUpdated', event => { for (const value of event.versions) versions.set(value.versionId, value); }); await sessionCDP.send('ServiceWorker.enable');
    const version = await until(() => [...versions.values()].find(value => value.scriptURL.startsWith(`chrome-extension://${extensionId}/`) && value.runningStatus === 'running'), 'Running production service worker version not found');
    restartingWorker=true;await Promise.allSettled(workerInspectionSessions.map(session=>session.detach()));
    await sessionCDP.send('ServiceWorker.stopWorker', { versionId: version.versionId }); await until(() => versions.get(version.versionId)?.runningStatus === 'stopped', 'CDP did not confirm actual worker stop');
    const reply = await Promise.race([request('GET_STATE'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Worker failed to wake within 20 seconds after explicit stop')),20000))]); restartingWorker=false;for(const target of browser.targets().filter(t=>t.type()==='service_worker')){instrumented.delete(target);await instrument(target);} assert.equal(reply.engine?.ok, true); assert.ok(reply.state.focusSessions.some(value => value.id === session.id && value.endsAt === session.endsAt)); assert.deepEqual(reply.state.sitePolicies, before.sitePolicies); assert.deepEqual(reply.state.activity, before.activity); assert.equal(reply.state.preferences.theme, before.preferences.theme);
    await go(); await fixture.waitForFunction(id => location.href.startsWith(`chrome-extension://${id}/blocked.html`), {}, extensionId); await sessionCDP.detach();
  });

  await check('instrumented runtime made no outbound billing or telemetry requests', async () => { assert.deepEqual(outbound, [], 'Nonfixture outbound attempt recorded and blocked'); });
  await check('completed UI and content flows emitted no console/runtime errors', async () => { assert.deepEqual(errors, [], 'Actual UI/content/worker runtime emitted errors'); });
  await check(process.env.BLOKU_SKIP_SCREENSHOTS==='1'?'website desktop and mobile English/Arabic layouts checked without screenshot capture':'website desktop and mobile English/Arabic screenshots captured from local preview', async () => {
    const website = await page({ width: 1280, height: 800 });
    for (const [locale, suffix] of [['en', '/'], ['ar', '/ar']]) {
      await website.setViewport({ width: 1280, height: 800 }); await website.goto(`http://127.0.0.1:4173${suffix}`, { waitUntil: 'networkidle0', timeout: 20000 }); await shot(website, `website-${locale}-desktop`);
      await website.setViewport({ width: 390, height: 844 }); await website.reload({ waitUntil: 'networkidle0' }); await shot(website, `website-${locale}-mobile`);
      assert.ok(await website.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${locale} website overflows mobile viewport`);
    }
    await website.close();
  });
} catch (error) {
  if (options && !options.isClosed()) await shot(options, 'failure-options').catch(() => undefined);
  results.push({ name: 'runner setup or unrecoverable failure', pass: false, error: String(error), stack: error.stack }); console.error(error.stack || error);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  const checksums = await readFile(path.join(extension, 'checksums.json'), 'utf8').catch(() => null);
  if (checksums !== checksumBytes.toString('utf8')) results.push({ name: 'package remained unchanged during runtime check', pass: false, error: 'dist checksums changed during the run' });
  const report = { status: results.length > 0 && results.every(result => result.pass||result.skip) ? 'PASS — BOUNDED LOCAL RUNTIME CHECK' : 'FAIL — NOT QUALIFIED', observedAt: new Date().toISOString(), browser: browserVersion, manifestVersion: manifest.version, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), checksumsManifestSha256: checksums ? createHash('sha256').update(checksums).digest('hex') : null, extensionDirectory: extension, packageArchive, results, errors, blockedNonfixtureOutboundAttempts: outbound, screenshots, readRetries, screenshotsSkipped:process.env.BLOKU_SKIP_SCREENSHOTS==='1', limits: ['Only the actual local dist and owned HTTP fixtures were exercised.', 'The popup document was opened at popup dimensions in a tab; native toolbar popup interaction was not tested.', 'Network monitoring begins after browser target instrumentation; the first launch milliseconds are not observed.', 'No live public video/social website, real customer data, billing, donation, deployment or store submission was used.', 'The gate does not establish every supported-site preset, consent vendor, schedule/DST boundary, or 90-day real-time retention behavior.'] };
  await writeFile(path.join(output, 'runtime-results.json'), JSON.stringify(report, null, 2)+'\n');
  const rows = results.map(result => `| ${result.skip?'SKIP':result.pass ? 'PASS' : 'FAIL'} | ${result.name.replaceAll('|', '\\|')} | ${result.skip ? result.reason.replaceAll('|', '\\|') : result.error ? result.error.replaceAll('|', '\\|').replaceAll('\n', ' ') : `${result.ms} ms`} |`).join('\n');
  await writeFile(reportPath, `# Runtime qualification: ${report.status}\n\nObserved: ${report.observedAt}. Browser: ${browserVersion ?? 'not launched'}. Actual package: \`${extension}\`, version \`${manifest.version}\`. Manifest SHA-256: \`${report.manifestSha256}\`. Packaged checksums manifest SHA-256: \`${report.checksumsManifestSha256}\`. ${packageArchive?`Archive: ${packageArchive.name}, SHA-256: ${packageArchive.sha256}.`:''}\n\n| Result | Actual check | Evidence |\n| --- | --- | --- |\n${rows}\n\nDetailed machine evidence: \`B2/artifacts/qualification/runtime-results.json\`. Screenshots: ${screenshots.map(file => `\`B2/artifacts/qualification/${file}\``).join(', ') || 'none'}.\n\n${report.limits.map(limit => `- ${limit}`).join('\n')}\n\nAll browser/server processes and the isolated temporary profile are task-owned and closed/removed by the runner. A bounded pass is not an unconditional production/store qualification. Failures remain explicit and must be resolved by the source owners before a new final package is accepted.\n`);
  console.log(JSON.stringify({ status: report.status, passed: results.filter(result => result.pass).length, failed: results.filter(result => !result.pass&&!result.skip).length,skipped:results.filter(result=>result.skip).length, output: path.join(output, 'runtime-results.json') }));
  if (results.some(result => !result.pass&&!result.skip)) process.exitCode = 1;
}
