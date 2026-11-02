import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import puppeteer from 'puppeteer-core';

// This runner never builds or changes dist. Run only after the coordinator grants the browser lane.
const runnerSha256=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
const runtimeEnvironment={nodeVersion:process.version,platform:process.platform,architecture:process.arch};
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
const results = [], errors = [], cleanupErrors = [], casCleanupFailures = [], outbound = [], lifecycleRequests = [], startupWelcomeAttempts = [], networkProbeDiagnostics = [], pauseReloadEvidence = [], spaRefreshEvidence = [], screenshots = [], fixtureRequests = [];
const instrumented = new Map();
const workerInspectionSessions=[];let restartingWorker=false;let closing=false;let checkedErrorCount=0;let welcomeReloadArmed=false;let automaticWelcome=null;
let browser, extensionId, options, fixture, popup, port, browserVersion, currentPhase = 'startup';
function recordRuntimeError(error){if(closing&&/\bthe browser is shutting down\b/i.test(error.message)){cleanupErrors.push({...error,duringOwnedShutdown:true});return;}errors.push(error);}
const server = http.createServer((req, res) => {
  fixtureRequests.push({ host: req.headers.host, path: req.url });
  if(req.url==='/frames'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><title>Owned frame fixture</title><p id="frame-hide">Top document must stay visible</p><iframe src="http://frame.bloku.test:${port}/frame" title="Owned cross-origin frame"></iframe>`);return;}
  if(req.url==='/frame'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>Owned embedded fixture</title><p id="frame-hide">Only this embedded element may be hidden</p>');return;}
  if(req.url?.startsWith('/consent')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><title>Owned consent fixture</title><div id="cbPopupWrap" class="cb-popup--open" style="padding:30px"><p>Owned test consent dialog</p><button id="cbRefuseTrigger">Reject optional</button><button id="cbAcceptTrigger">Accept optional</button></div><div id="unsupported-banner">Unsupported dialog remains usable</div><script>document.querySelector('#cbRefuseTrigger').onclick=()=>{document.documentElement.dataset.consentDecision='reject';document.querySelector('#cbPopupWrap').remove();};document.querySelector('#cbAcceptTrigger').onclick=()=>document.documentElement.dataset.consentDecision='accept';</script>`);return;}
  if (req.url?.startsWith('/fixture.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end('window.fixtureScriptLoaded=(window.fixtureScriptLoaded||0)+1;'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Bloku local runtime fixture</title></head><body style="font:18px system-ui;padding:50px"><h1>Owned local fixture</h1><p id="fixture-hide">This element can be hidden while ads are paused.</p><button id="pick-me" style="margin:30px;padding:25px">Pick this element</button><button id="spa">Navigate within this page</button><button id="spa-settings">Open owned SPA settings</button><button id="spa-home">Return to owned SPA feed</button><p><a id="plain" href="/landing?utm_source=fixture&fbclid=fixture&keep=yes">Ordinary tracked link</a></p><p><a id="signed" href="/landing?utm_source=fixture&signature=owned-test-signature&keep=yes">Signed link</a></p><script>document.querySelector('#spa').onclick=()=>history.pushState({},'', '?view=spa');document.querySelector('#spa-settings').onclick=()=>history.pushState({},'', '/settings');document.querySelector('#spa-home').onclick=()=>history.pushState({},'', '/feed');document.querySelectorAll('a').forEach(a=>a.addEventListener('click',event=>event.preventDefault()));</script></body></html>`);
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
        if(url.href==='https://bloku.app/hey'&&target.type()==='page'&&event.resourceType==='Document'){
          if(welcomeReloadArmed){welcomeReloadArmed=false;lifecycleRequests.push({phase:currentPhase,target:target.type(),url:url.href,kind:'explicit-owned-reload',automaticTabId:automaticWelcome?.tabId});await session.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'}],body:Buffer.from('<!doctype html><title>Owned BLOKU welcome response</title><link rel="icon" href="data:,"><h1>Welcome fixture</h1>').toString('base64')});}
          else{startupWelcomeAttempts.push({phase:currentPhase,target:target.type(),url:url.href,handling:'continued-to-launch-DNS-denial'});await session.send('Fetch.continueRequest',{requestId:event.requestId});}
        }
        else if (url.hostname.endsWith('.bloku.test') || url.hostname === '127.0.0.1') await session.send('Fetch.continueRequest', { requestId: event.requestId });
        else { outbound.push({ phase: currentPhase, target: target.type(), origin: url.origin, path: url.pathname }); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); }
      } catch { /* Target may close during worker termination. */ }
    });
    await session.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
    session.on('Runtime.exceptionThrown', event => recordRuntimeError({ phase: currentPhase, target: target.type(), message: event.exceptionDetails.exception?.description ?? event.exceptionDetails.text }));
    await session.send('Runtime.enable');
  } catch (error) { throw new Error(`Target instrumentation failed: ${error.message}`); }
  })(); instrumented.set(target, operation); return operation;
}
async function page(viewport) { const value = await browser.newPage(); const waitForFunction=value.waitForFunction.bind(value);value.waitForFunction=(fn,options,...args)=>waitForFunction(fn,{polling:100,...options},...args); await instrument(value.target()); if (viewport) await value.setViewport(viewport); value.on('pageerror', error => recordRuntimeError({ phase: currentPhase, target: 'page', message: error.message })); value.on('console', message => { if (message.type() === 'error') recordRuntimeError({ phase: currentPhase, target: 'console', message: message.text() }); }); return value; }
let readRetries=0;
async function message(action,payload,ownedPage=options){return ownedPage.evaluate(({action,payload})=>Promise.race([chrome.runtime.sendMessage({type:'BLOKU_V2',action,payload}),new Promise(resolve=>setTimeout(()=>resolve({ok:false,error:'runtime-read-timeout'}),10000))]),{action,payload});}
async function request(action, payload,ownedPage=options) { let reply = await message(action, payload,ownedPage);if(action==='GET_STATE'&&reply?.error==='runtime-read-timeout'){readRetries++;reply=await message(action,payload,ownedPage);} assert.equal(reply?.ok, true, `${action}: ${JSON.stringify(reply)}`); return reply; }
async function getState() { return (await request('GET_STATE')).state; }
async function getStateFrom(ownedPage) { return (await request('GET_STATE',undefined,ownedPage)).state; }
async function update(change) { const state = await getState(); change(state); return request('UPDATE_STATE', state); }
function settingsKey(state){return JSON.stringify({preferences:state.preferences,sitePolicies:state.sitePolicies,distractionPresets:state.distractionPresets,distractionRules:state.distractionRules,embeddedHides:state.embeddedHides??[],userRulesText:state.userRulesText,focusProfiles:state.focusProfiles},(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);}
async function holdNextReply(ownedPage,action){await ownedPage.evaluate(action=>{const original=chrome.runtime.sendMessage.bind(chrome.runtime);const hold={action,seen:false,pending:false,released:false,original,release:null};globalThis.__blokuHeldReply=hold;chrome.runtime.sendMessage=(message,...args)=>{const reply=original(message,...args);if(message?.type==='BLOKU_V2'&&message.action===hold.action&&!hold.seen){hold.seen=true;return Promise.resolve(reply).then(value=>hold.released?value:new Promise(resolve=>{hold.pending=true;hold.release=()=>{hold.pending=false;resolve(value);};}));}return reply;};},action);}
async function releaseReply(ownedPage){await ownedPage.evaluate(()=>{const hold=globalThis.__blokuHeldReply;if(hold){hold.released=true;hold.release?.();chrome.runtime.sendMessage=hold.original;delete globalThis.__blokuHeldReply;}});}
async function shot(value, name) { if(process.env.BLOKU_SKIP_SCREENSHOTS==='1')return;const filename = `runtime-${name}.png`; await value.screenshot({ path: path.join(output, filename), fullPage: true }); screenshots.push(filename); }
async function go(value = fixture, url = fixtureUrl) { try { await value.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch (error) { if (!/ERR_BLOCKED_BY_CLIENT|ERR_ABORTED/.test(String(error))) throw error; } }
async function contentMessage(action, payload,frameId=0) {
  const tabId = await options.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(url))?.id, fixtureUrl.split('?')[0]);
  assert.ok(tabId, 'Fixture tab must be present for isolated-world sender test');
  return options.evaluate(async ({ tabId, action, payload,frameId }) => {
    const result = await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, world: 'ISOLATED', func: (action, payload) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), args: [action, payload] });
    return result[0]?.result;
  }, { tabId, action, payload,frameId });
}
async function contentConfigProbe(operation) {
  // Test-only instrumentation in the actual content script's ISOLATED world.
  // Every observed reply is produced by the packaged background; nothing is forged.
  const tabId = await options.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(url))?.id, fixtureUrl);
  assert.ok(tabId, 'Owned SPA fixture tab must exist');
  return options.evaluate(async ({tabId,operation}) => {
    const results = await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',args:[operation],func:operation=>{
      const key='__blokuContentConfigProbe';
      if(operation==='install'){
        if(globalThis[key])throw Error('Content configuration probe already installed');
        const state={original:chrome.runtime.sendMessage,entries:[],holdNext:false,released:false,pending:false,release:null,observer:null,watch:null};
        globalThis[key]=state;
        chrome.runtime.sendMessage=function(message,...args){
          const actual=Reflect.apply(state.original,chrome.runtime,[message,...args]);
          if(message?.type!=='BLOKU_V2'||message.action!=='GET_PAGE_CONFIG')return actual;
          const entry={sequence:state.entries.length,path:location.pathname,sentAt:Date.now(),held:false};state.entries.push(entry);
          const shouldHold=state.holdNext;state.holdNext=false;
          const observe=value=>{entry.receivedAt=Date.now();entry.ok=value?.ok===true;entry.selectors=Array.isArray(value?.selectors)?[...value.selectors]:[];return value;};
          if(!shouldHold){Promise.resolve(actual).then(observe,error=>{entry.error=String(error.message||error);});return actual;}
          return Promise.resolve(actual).then(value=>{
            observe(value);entry.held=true;
            if(state.released)return value;
            state.pending=true;
            return new Promise(resolve=>{state.release=()=>{entry.releasedAt=Date.now();state.pending=false;resolve(value);};});
          });
        };
      }
      const state=globalThis[key];
      if(!state)return {absent:true,restored:false};
      if(operation==='arm'){state.holdNext=true;state.released=false;}
      if(operation==='release'||operation==='restore'){state.holdNext=false;state.released=true;state.release?.();state.release=null;}
      if(operation==='watch'){
        state.watch={startedAt:Date.now(),hiddenObservations:[]};
        const sample=()=>{const node=document.querySelector('#fixture-hide');if(node&&getComputedStyle(node).display==='none'&&state.watch.hiddenObservations.length<64)state.watch.hiddenObservations.push({at:Date.now(),display:'none'});};
        state.observer=new MutationObserver(sample);state.observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class']});sample();
      }
      if(operation==='watch-stop'){
        state.observer?.disconnect();state.observer=null;
        const node=document.querySelector('#fixture-hide'),finalDisplay=node?getComputedStyle(node).display:null;
        return {...state.watch,observationMs:Date.now()-state.watch.startedAt,finalDisplay,styleText:document.querySelector('#bloku-v2-distractions')?.textContent??'',entries:state.entries,pending:state.pending};
      }
      if(operation==='restore'){
        state.observer?.disconnect();chrome.runtime.sendMessage=state.original;delete globalThis[key];
        return {restored:chrome.runtime.sendMessage===state.original,pending:state.pending};
      }
      return {entries:state.entries,pending:state.pending,armed:state.holdNext};
    }});
    return results[0]?.result;
  },{tabId,operation});
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
async function loadScript(value=fixture) { return value.evaluate(url => new Promise(resolve => { const script = document.createElement('script'); script.src = `${url}?probe=${Date.now()}`; script.onload = () => resolve(true); script.onerror = () => resolve(false); document.body.append(script); setTimeout(() => resolve('timeout'), 5000); }), `http://ads.bloku.test:${port}/fixture.js`); }
async function currentTab(value=fixture){await value.bringToFront();return request('GET_TAB');}
async function addOwnedFrame(value=fixture){const frameUrl=`http://frame.bloku.test:${port}/frame`;await value.evaluate(url=>{const iframe=document.createElement('iframe');iframe.id='pause-reload-frame';iframe.title='Owned pause reload frame';iframe.src=url;document.body.append(iframe);},frameUrl);const embedded=await until(()=>value.frames().find(frame=>frame.url()===frameUrl),'Owned child frame did not commit');await embedded.waitForSelector('#frame-hide');return embedded;}
async function explicitReload(value,tabId){const navigation=value.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000});await value.bringToFront();await request('RELOAD_PAGE',{tabId});await navigation;await until(async()=>{const reply=await currentTab(value);return reply.tab?.id===tabId&&reply.pauseReloadRequired===false;},'Committed top-document reload did not clear pending pause state');}

try {
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--host-resolver-rules=MAP bloku.app ~NOTFOUND, MAP *.bloku.test 127.0.0.1'] });
  browser.on('targetcreated', target => { void instrument(target).catch(error => recordRuntimeError({ phase: currentPhase, target: target.type(), message: error.message })); });
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

  await check('actual dist English UI renders, install records one clean welcome tab, and explicit welcome reload uses owned response', async () => {
    const initial = await getState();
    assert.equal(initial.preferences.rejectConsent, false); assert.equal(initial.preferences.cleanUrls, false); assert.equal(initial.preferences.gpc, false); assert.equal(initial.preferences.activityEnabled, false);
    for (const key of ['licenseKey', 'userEmail', 'deviceId', 'subscriptionId', 'polarSubscriptionId']) assert.equal(key in initial, false);
    await options.waitForSelector('main h1'); assert.equal(await options.$eval('html', node => node.lang), 'en');
    await shot(options, 'options-en');
    popup = await page({ width: 420, height: 800 }); await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' }); await popup.waitForSelector('#app h1'); await shot(popup, 'popup-en');
    assert.deepEqual(await popup.$$eval('details',nodes=>nodes.map(node=>({id:node.id,open:node.open,summary:!!node.querySelector(':scope > summary')}))),[{id:'distraction-controls',open:false,summary:true},{id:'protection-controls',open:false,summary:true},{id:'focus-controls',open:false,summary:true}],'Default popup disclosures must all be collapsed and retain real summary controls');
    const tabs=await until(async()=>{const tabs=await options.evaluate(async()=>(await chrome.tabs.query({})).filter(tab=>tab.url==='https://bloku.app/hey'||tab.pendingUrl==='https://bloku.app/hey'));return tabs.length?tabs:null;},'Fresh install did not open the intentional clean English welcome tab');assert.equal(tabs.length,1,'Install created duplicate welcome tabs');
    const flag=await options.evaluate(async()=>(await chrome.storage.local.get('blokuWelcomeV2')).blokuWelcomeV2);assert.equal(flag,true,'Install did not persist the one-time welcome flag');automaticWelcome={tabId:tabs[0].id,requestedUrl:tabs[0].pendingUrl||tabs[0].url,persistedFlag:flag,observedAt:new Date().toISOString()};
    // Startup navigation is DNS-denied even if it precedes CDP attachment. This reload alone is the owned-response assertion.
    for(const target of browser.targets())await instrument(target);welcomeReloadArmed=true;await options.evaluate(tabId=>chrome.tabs.reload(tabId),automaticWelcome.tabId);
    await until(()=>lifecycleRequests.length===1,'Explicit welcome reload was not fulfilled by owned interception');
    await until(async()=>(await browser.pages()).some(asyncPage=>asyncPage.url()==='https://bloku.app/hey'),'Reloaded welcome page did not reach the clean URL');
    const welcome=(await browser.pages()).find(value=>value.url()==='https://bloku.app/hey');await until(async()=>await welcome.title()==='Owned BLOKU welcome response','Owned welcome reload did not render the script-free response');
    assert.deepEqual(errors, [], 'UI/runtime errors during fresh default startup'); assert.deepEqual(outbound, [], 'Unexpected default outbound network attempt outside the intentional welcome');
  });

  await check('popup theme controls use narrow SET_THEME without replacing other settings',async()=>{
    const before=await getState(),theme=before.preferences.theme==='dark'?'light':'dark';
    await popup.evaluate(()=>{globalThis.__blokuObservedActions=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(message,...args)=>{globalThis.__blokuObservedActions.push(message.action);return original(message,...args);};});
    await click(popup,`#theme-${theme}`);await until(async()=>(await getState()).preferences.theme===theme,'Popup theme change was not committed');
    await popup.waitForFunction(theme=>document.querySelector(`#theme-${theme}`)?.getAttribute('aria-pressed')==='true',{polling:100},theme);
    const after=await getState(),expected=structuredClone(before);expected.preferences.theme=theme;assert.deepEqual(after,expected,'Narrow theme change changed unrelated persisted state');
    const actions=await popup.evaluate(()=>globalThis.__blokuObservedActions);assert.ok(actions.includes('SET_THEME'));assert.equal(actions.includes('UPDATE_STATE'),false);assert.equal(actions.includes('SAVE_SETTINGS'),false);
    const rejected=await message('SET_THEME',{theme:'sepia'});assert.equal(rejected.ok,false);assert.deepEqual(await getState(),after,'Invalid theme mutated state');await request('SET_THEME',{theme:before.preferences.theme});
  });

  await check('exact-dist stale SAVE_SETTINGS and SAVE_IMPORT reject before state or engine mutation',async()=>{
    for(const action of ['SAVE_SETTINGS','SAVE_IMPORT']){
      const stale=await getState(),base=settingsKey(stale);stale.focusSessions=[];stale.preferences.cleanUrls=!stale.preferences.cleanUrls;
      await request('SET_THEME',{theme:stale.preferences.theme==='dark'?'light':'dark'});const before=await request('GET_STATE');
      const rejected=await message(action,{state:stale,base});assert.equal(rejected.ok,false,`${action} accepted a stale settings base`);assert.match(rejected.error,/SETTINGS_CONFLICT/);
      const after=await request('GET_STATE');assert.deepEqual(after.state,before.state,`${action} mutated committed state before rejecting conflict`);assert.equal(after.engine.revision,before.engine.revision,`${action} applied engine configuration before rejecting conflict`);
    }
  });

  await check('configured local focus activity accrues from real browser observations', async () => {
    await update(state => { state.preferences.activityEnabled = true; state.focusProfiles = [{ id: 'runtime-focus', name: 'Runtime focus', domains: [host], enabled: false, schedules: [], dailyAllowanceMinutes: null }]; });
    const idle=await options.evaluate(()=>chrome.idle.queryState(60));if(idle!=='active')throw new SkippedCheck(`Host system is ${idle}; browser-generated input does not establish real user activity.`);
    await fixture.bringToFront(); await fixture.reload({ waitUntil: 'domcontentloaded' }); await wait(1200); await fixture.reload({ waitUntil: 'domcontentloaded' });
    await until(async () => (await getState()).activity.some(day => (day.domainSeconds[host] ?? 0) > 0), 'Foreground fixture usage did not create positive observed activity');
  });

  await check('two options tabs refresh pristine settings and preserve conflicted drafts until explicit discard',async()=>{
    const peer=await page({width:1100,height:900});
    try{
      await peer.goto(`chrome-extension://${extensionId}/options.html`,{waitUntil:'domcontentloaded'});await peer.waitForSelector('main h1');await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main select');
      const before=await getState(),theme=before.preferences.theme==='dark'?'light':'dark';await request('SET_THEME',{theme},peer);
      await options.waitForFunction(theme=>document.querySelector('main select')?.value===theme&&document.documentElement.dataset.theme===theme,{polling:100},theme);
      await openOptionsSection(english.rules);const draft='! owned two-tab unsaved draft';await options.$eval('main textarea',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},draft);
      await request('SET_THEME',{theme:before.preferences.theme},peer);await options.waitForFunction(label=>document.querySelector('[role=status]')?.textContent===label&&document.querySelector('main>button.primary')?.disabled,{polling:100},english.settingsChanged);
      assert.equal(await options.$eval('main textarea',node=>node.value),draft);const committed=await getState();await options.$eval('main>button.primary',node=>node.click());assert.equal(settingsKey(await getState()),settingsKey(committed),'Disabled conflicted Save still committed a draft');
      options.once('dialog',dialog=>dialog.dismiss());await click(options,'header button.link');assert.equal(await options.$eval('main textarea',node=>node.value),draft,'Cancel discard lost the draft');
      options.once('dialog',dialog=>dialog.accept());await click(options,'header button.link');await options.waitForFunction(value=>document.querySelector('main textarea')?.value===value&&!document.querySelector('main>button.primary')?.disabled,{polling:100},committed.userRulesText);
    }finally{await peer.close();}
  });

  await check('edits made during a delayed GET_STATE reply survive automatic external refresh',async()=>{
    const peer=await page({width:1100,height:900});
    try{
      await peer.goto(`chrome-extension://${extensionId}/options.html`,{waitUntil:'domcontentloaded'});await peer.waitForSelector('main h1');await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');await openOptionsSection(english.rules);
      await holdNextReply(options,'GET_STATE');const before=await getStateFrom(peer),theme=before.preferences.theme==='dark'?'light':'dark';await request('SET_THEME',{theme},peer);
      await options.waitForFunction(()=>globalThis.__blokuHeldReply?.pending,{polling:100});const draft='! typed while GET_STATE was pending';await options.$eval('main textarea',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},draft);await releaseReply(options);
      await options.waitForFunction(label=>document.querySelector('[role=status]')?.textContent===label,{polling:100},english.settingsChanged);assert.equal(await options.$eval('main textarea',node=>node.value),draft,'Refresh response discarded newer input');
      options.once('dialog',dialog=>dialog.accept());await click(options,'header button.link');await options.waitForFunction(value=>document.querySelector('main textarea')?.value===value,{polling:100},before.userRulesText);
    }finally{await releaseReply(options);await peer.close();}
  });

  await check('edits made while Save reply is pending stay dirty and can save against the confirmed base',async()=>{
    await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');await openOptionsSection(english.rules);const original=(await getState()).userRulesText;
    try{
      await holdNextReply(options,'SAVE_SETTINGS');const first='! owned first committed snapshot',second='! owned newer unsaved snapshot';
      await options.$eval('main textarea',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},first);await click(options,'main>button.primary');await options.waitForFunction(()=>globalThis.__blokuHeldReply?.pending,{polling:100});
      assert.equal((await getState()).userRulesText,first);await options.$eval('main textarea',(node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},second);await releaseReply(options);
      await options.waitForFunction(()=>!document.querySelector('main>button.primary')?.disabled,{polling:100});assert.equal(await options.$eval('main textarea',node=>node.value),second,'Save completion discarded a newer draft');assert.equal((await getState()).userRulesText,first,'Newer draft was saved without its own action');
      await click(options,'main>button.primary');await until(async()=>(await getState()).userRulesText===second,'Second save did not use the newly confirmed revision');
    }finally{await releaseReply(options);const current=await getState(),base=settingsKey(current);current.userRulesText=original;await request('SAVE_SETTINGS',{state:current,base});await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');}
  });

  await check('popup shows inherited ad pauses and global off state accurately',async()=>{
    await request('SITE_PAUSE',{domain:'bloku.test',paused:true,minutes:10});const deadline=(await getState()).sitePolicies.find(policy=>policy.domain==='bloku.test').adsPausedUntil;await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main>label textarea');await options.$eval('main>label textarea',node=>{node.value+='\nunused.bloku.test';node.dispatchEvent(new Event('input',{bubbles:true}));});await click(options,'main>button.primary');await until(async()=>(await getState()).sitePolicies.some(policy=>policy.domain==='unused.bloku.test'),'Edited pause list was not saved');assert.equal((await getState()).sitePolicies.find(policy=>policy.domain==='bloku.test').adsPausedUntil,deadline,'Editing another site converted a timed pause to permanent');await refreshPopup();
    await popup.waitForFunction(label=>document.querySelector('.site-identity>p')?.textContent===label,{polling:100},english.pauseReloadStatus);
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
    const before = await getState(); stale.preferences.theme = before.preferences.theme==='dark'?'light':'dark'; const reply = await request('UPDATE_STATE', stale);
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

  await check('real operational activity changes do not conflict with revision-checked saves',async()=>{
    const prerequisite=results.find(result=>result.name==='configured local focus activity accrues from real browser observations');
    if(prerequisite?.skip&&/^Host system is (?:idle|locked);/.test(prerequisite.reason))throw new SkippedCheck(`Positive observed-activity prerequisite was explicitly skipped: ${prerequisite.reason}`);
    assert.equal(prerequisite?.pass,true,'Observed-activity prerequisite failed; activity CAS coverage cannot be qualified');
    await options.bringToFront();const stale=await getState(),base=settingsKey(stale);stale.focusSessions=[];
    assert.ok(stale.activity.some(day=>(day.domainSeconds[host]??0)>0),'Activity CAS requires actual positive browser-observed fixture activity');
    await request('CLEAR_ACTIVITY');const operational=await getState();assert.notDeepEqual(operational.activity,stale.activity,'Activity CAS requires an actual activity delta');assert.equal(settingsKey(operational),base,'Activity-only mutation unexpectedly changes editable revision');
    // The same measured snapshot predates the real clear for both actions; no activity is fabricated or restored.
    for(const action of ['SAVE_SETTINGS','SAVE_IMPORT']){const saved=await request(action,{state:stale,base});assert.deepEqual(saved.state.activity,operational.activity,`${action} replayed stale observed activity`);assert.deepEqual(saved.state.focusSessions,operational.focusSessions,`${action} changed live sessions`);assert.equal(settingsKey(saved.state),base,`${action} changed unrelated editable settings`);}
  });

  await check('operational session changes independently preserve live sessions and activity through revision-checked saves',async()=>{
    const profileId='cas-operation',ownedSessionIds=new Set();let originalFailure;
    try{
      await options.bringToFront();await update(state=>{state.focusProfiles.push({id:profileId,name:'CAS operational fixture',domains:['cas.bloku.test'],enabled:false,schedules:[],dailyAllowanceMinutes:null});});
      for(const action of ['SAVE_SETTINGS','SAVE_IMPORT']){
        const stale=await getState(),base=settingsKey(stale);stale.focusSessions=[];
        const started=await request('START_FOCUS',{profileId,minutes:25}),session=started.state.focusSessions.at(-1);ownedSessionIds.add(session.id);
        const operational=await getState();assert.equal(settingsKey(operational),base,'Session-only mutation unexpectedly changes editable revision');
        stale.preferences.theme=stale.preferences.theme==='dark'?'light':'dark';const saved=await request(action,{state:stale,base});
        assert.deepEqual(saved.state.focusSessions,operational.focusSessions,`${action} changed live sessions`);assert.deepEqual(saved.state.activity,operational.activity,`${action} changed current activity`);assert.equal(saved.state.preferences.theme,stale.preferences.theme);
        await request('END_FOCUS',{sessionId:session.id});
      }
    }catch(error){originalFailure=error;throw error;}
    finally{
      const failures=[];
      try{
        const current=await getState();for(const session of current.focusSessions)if(session.profileId===profileId)ownedSessionIds.add(session.id);
        for(const sessionId of ownedSessionIds)if((await getState()).focusSessions.some(session=>session.id===sessionId)){try{await request('END_FOCUS',{sessionId});}catch(error){failures.push(error);}}
        const remaining=(await getState()).focusSessions.filter(session=>session.profileId===profileId||ownedSessionIds.has(session.id));
        if(remaining.length)failures.push(new Error(`Owned CAS sessions remain active; profile retained: ${remaining.map(session=>session.id).join(', ')}`));
        else await update(state=>{state.focusProfiles=state.focusProfiles.filter(profile=>profile.id!==profileId);});
      }catch(error){failures.push(error);}
      if(failures.length){const details=failures.map(error=>String(error));casCleanupFailures.push({phase:currentPhase,errors:details});if(originalFailure instanceof Error)originalFailure.stack=`${originalFailure.stack}\nAdditional CAS fixture cleanup failures: ${details.join('; ')}`;else if(originalFailure===undefined)throw new AggregateError(failures,'CAS fixture cleanup failed');}
    }
  });

  await check('SDK reconfiguration exposes pending pause, preserves it across SPA/frame events, and explicit reload restores top/frame pause with saved cosmetics', async () => {
    const before=await getState();let sessionId;
    assert.ok(before.sitePolicies.some(policy=>policy.domain===host&&policy.adsPausedUntil===null),'Expected the saved permanent pause from the focus checks');
    try{
      await update(state=>{state.distractionRules[host]=['#fixture-hide'];state.focusProfiles.push({id:'pause-reload-focus',name:'Pause reload focus fixture',domains:['reload-focus.bloku.test'],enabled:false,schedules:[],dailyAllowanceMinutes:null});});
      await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display==='none',{polling:100});const token=await fixture.evaluate(()=>globalThis.__blokuDocumentToken=`${Date.now()}-${Math.random()}`);
      sessionId=(await request('START_FOCUS',{profileId:'pause-reload-focus',minutes:25})).state.focusSessions.at(-1).id;
      let tab=await currentTab();assert.equal(tab.pauseReloadRequired,true,'Actual SDK reconfiguration did not mark the existing paused document');const tabId=tab.tab.id;
      assert.deepEqual((await getState()).sitePolicies,before.sitePolicies,'SDK reconfiguration erased the saved pause');assert.equal(await fixture.evaluate(()=>globalThis.__blokuDocumentToken),token,'Configuration automatically reloaded the user document');
      const denied=await contentMessage('RELOAD_PAGE',{tabId});assert.equal(denied?.ok,false);assert.match(denied.error,/only available from BLOKU settings/);assert.equal((await currentTab()).pauseReloadRequired,true,'Denied content action cleared pending pause');
      await click(fixture,'#spa');await fixture.waitForFunction(()=>location.search.includes('view=spa'),{polling:100});assert.equal((await currentTab()).pauseReloadRequired,true,'SPA navigation incorrectly cleared pending pause');assert.equal(await fixture.evaluate(()=>globalThis.__blokuDocumentToken),token);
      const embedded=await addOwnedFrame();await embedded.goto(`http://frame.bloku.test:${port}/frame`,{waitUntil:'domcontentloaded'});assert.equal((await currentTab()).pauseReloadRequired,true,'Child-frame commit incorrectly cleared the top-document pending pause');assert.equal(await fixture.evaluate(()=>globalThis.__blokuDocumentToken),token);
      await refreshPopup();await popup.waitForFunction(label=>document.querySelector('.site-identity>p')?.textContent===label,{polling:100},english.pauseReloadStatus);
      assert.equal(await popup.$eval('.pause-reload-notice p',node=>node.textContent),english.pauseReloadHelp);assert.equal(await popup.$eval('.pause-reload-notice button',node=>node.textContent),english.reloadPage);assert.equal(await popup.$eval('.pause-reload-notice',node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(node).display!=='none';}),true,'Reload remedy must be visible without expanding details');
      await explicitReload(fixture,tabId);assert.equal(await fixture.evaluate(()=>globalThis.__blokuDocumentToken),undefined,'Trusted reload did not create a fresh top document');await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display==='none',{polling:100});
      const topLoaded=await loadScript(),freshFrame=await addOwnedFrame(),frameLoaded=await loadScript(freshFrame);
      if(topLoaded!==true||frameLoaded!==true){const state=await getState(),rules=await options.evaluate(async()=>({dynamic:await chrome.declarativeNetRequest.getDynamicRules(),session:await chrome.declarativeNetRequest.getSessionRules()}));networkProbeDiagnostics.push({phase:currentPhase,stage:'after-explicit-user-reload',pageUrl:fixture.url(),topLoaded,frameLoaded,sitePolicies:state.sitePolicies,focusSessions:state.focusSessions,rules});}
      assert.equal(topLoaded,true,'Explicit user reload did not apply the saved pause to the top document');assert.equal(frameLoaded,true,'Explicit user reload did not permit the owned ad script in a cross-origin child frame');
      const after=await getState();assert.deepEqual(after.sitePolicies,before.sitePolicies);assert.ok(after.focusSessions.some(session=>session.id===sessionId),'Reloading a paused document ended unrelated focus');
      await refreshPopup();assert.equal(await popup.$eval('.site-identity>p',node=>node.textContent),english.adsPaused);assert.equal(await popup.$('.pause-reload-notice'),null,'Completed pause still shows a pending-reload remedy');
      await update(state=>{state.distractionRules[host]=[];});await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display!=='none',{polling:100});assert.equal((await currentTab()).pauseReloadRequired,false,'Cosmetic-only change unnecessarily re-marked the network pause');
      pauseReloadEvidence.push({phase:currentPhase,storedPausePreserved:true,pendingAfterSdkReconfigure:true,noAutomaticReload:true,contentCannotReload:true,spaKeepsPending:true,childCommitKeepsPending:true,popupPendingStatus:english.pauseReloadStatus,manualReloadFreshDocument:true,pendingClearedAfterTopCommit:true,topScriptAllowedAfterReload:topLoaded,childScriptAllowedAfterReload:frameLoaded,savedHideSurvivesReload:true,unrelatedFocusPreserved:true,knownBoundary:'Existing document-bound SDK exemptions require explicit user reload after reconfiguration; pre-reload effectiveness is not claimed or probed again.'});
    }finally{if(sessionId&&(await getState()).focusSessions.some(session=>session.id===sessionId))await request('END_FOCUS',{sessionId});await update(state=>{state.focusProfiles=state.focusProfiles.filter(profile=>profile.id!=='pause-reload-focus');state.distractionRules=before.distractionRules;});}
  });

  await check('cross-origin frame hide RPC stays scoped to its top site and frame host',async()=>{
    await go(fixture,fixtureUrl+'frames');const embedded=await until(()=>fixture.frames().find(frame=>frame.url()===`http://frame.bloku.test:${port}/frame`),'Owned cross-origin frame did not load');await embedded.waitForSelector('#frame-hide');
    const frameId=await options.evaluate(async({url,frameUrl})=>{const tab=(await chrome.tabs.query({})).find(tab=>tab.url===url);const frames=await chrome.webNavigation.getAllFrames({tabId:tab.id});return frames.find(frame=>frame.url===frameUrl)?.frameId;},{url:fixtureUrl+'frames',frameUrl:`http://frame.bloku.test:${port}/frame`});assert.ok(frameId>0,'Expected an actual child-frame sender');
    const before=await getState();
    try{
      const reply=await contentMessage('SAVE_PICKER_RULE',{domain:'frame.bloku.test',selector:'#frame-hide'},frameId);assert.equal(reply?.ok,true,JSON.stringify(reply));
      const saved=await getState();assert.ok(saved.embeddedHides.some(rule=>rule.site===host&&rule.frame==='frame.bloku.test'&&rule.selectors.includes('#frame-hide')));assert.deepEqual(saved.distractionRules,before.distractionRules,'Frame picker wrote a top-level hide');
      await embedded.waitForFunction(()=>getComputedStyle(document.querySelector('#frame-hide')).display==='none',{polling:100});assert.notEqual(await fixture.$eval('#frame-hide',node=>getComputedStyle(node).display),'none','Frame hide leaked into the top document');
      const denied=await contentMessage('SAVE_PICKER_RULE',{domain:'other.bloku.test',selector:'#frame-hide'},frameId);assert.equal(denied?.ok,false);assert.match(denied.error,/Invalid element-hiding request/);
      const removed=await contentMessage('REMOVE_PICKER_RULE',{domain:'frame.bloku.test',selector:'#frame-hide'},frameId);assert.equal(removed?.ok,true);await embedded.waitForFunction(()=>getComputedStyle(document.querySelector('#frame-hide')).display!=='none',{polling:100});assert.equal((await getState()).embeddedHides.some(rule=>rule.site===host&&rule.frame==='frame.bloku.test'&&rule.selectors.includes('#frame-hide')),false);
    }finally{await update(state=>{state.distractionRules=before.distractionRules;state.embeddedHides=before.embeddedHides??[];});await go();}
  });

  await check('restore all saved hides removes top and frame rules while preserving presets and focus',async()=>{
    const original=await getState();let sessionId;
    try{
      await update(state=>{state.distractionPresets['youtube.com']=['comments'];state.distractionRules[host]=['#fixture-hide'];state.embeddedHides=[{site:host,frame:'frame.bloku.test',selectors:['#frame-hide']}];});
      const started=await request('START_FOCUS',{profileId:'runtime-focus',minutes:25}),session=started.state.focusSessions.at(-1);sessionId=session.id;const before=await getState();const restored=await request('RESTORE_ALL_HIDES');
      assert.deepEqual(restored.state.distractionRules,{});assert.deepEqual(restored.state.embeddedHides,[]);assert.deepEqual(restored.state.distractionPresets,before.distractionPresets);assert.deepEqual(restored.state.focusProfiles,before.focusProfiles);assert.deepEqual(restored.state.focusSessions,before.focusSessions);assert.deepEqual(restored.state.sitePolicies,before.sitePolicies);assert.deepEqual(restored.state.preferences,before.preferences);await request('END_FOCUS',{sessionId:session.id});
    }finally{if(sessionId&&(await getState()).focusSessions.some(session=>session.id===sessionId))await request('END_FOCUS',{sessionId});await update(state=>{state.distractionPresets=original.distractionPresets;state.distractionRules=original.distractionRules;state.embeddedHides=original.embeddedHides??[];});await go();}
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
    await click(options,'main>button.primary');await until(async()=>(await getState()).distractionRules[host]?.includes('#pick-me'),'Edited selector was not saved');await options.waitForFunction(()=>document.querySelector('main>button.primary')?.disabled===false,{polling:100});
    await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#pick-me')).display==='none'&&getComputedStyle(document.querySelector('#fixture-hide')).display!=='none',{polling:100});
    await click(options,'main .rule-item button');await until(async()=>(await getState()).distractionRules[host]?.length===0,'Explicit selector restoration was not saved');await options.waitForFunction(()=>document.querySelector('main>button.primary')?.disabled===false,{polling:100});await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#pick-me')).display!=='none',{polling:100});
  });

  await check('real same-document SPA history events refresh content configuration without losing explicit hides',async()=>{
    const before=await getState();
    try{
      await go();await update(state=>{state.distractionRules[host]=[...new Set([...(state.distractionRules[host]??[]),'#fixture-hide'])];});
      await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display==='none',{polling:100});
      const token=await fixture.evaluate(()=>globalThis.__blokuSpaDocumentToken=`${Date.now()}-${Math.random()}`);
      await contentConfigProbe('install');
      await click(fixture,'#spa-settings');await fixture.waitForFunction(()=>location.pathname==='/settings',{polling:100});
      const settings=await until(async()=>{const probe=await contentConfigProbe('snapshot');return probe.entries?.find(entry=>entry.path==='/settings'&&entry.ok)?probe:null;},'Real SPA settings transition did not cause a content-generated configuration RPC');
      assert.ok(settings.entries.some(entry=>entry.path==='/settings'&&entry.selectors.includes('#fixture-hide')));
      assert.equal(await fixture.$eval('#fixture-hide',node=>getComputedStyle(node).display),'none','Explicit user hide disappeared on the owned settings route');
      const afterSettings=settings.entries.length;
      await click(fixture,'#spa-home');await fixture.waitForFunction(()=>location.pathname==='/feed',{polling:100});
      const feed=await until(async()=>{const probe=await contentConfigProbe('snapshot');return probe.entries?.some(entry=>entry.sequence>=afterSettings&&entry.path==='/feed'&&entry.ok)?probe:null;},'Real SPA feed transition did not cause a new content-generated configuration RPC');
      assert.equal(await fixture.$eval('#fixture-hide',node=>getComputedStyle(node).display),'none','Explicit user hide disappeared when returning to feed');
      assert.equal(await fixture.evaluate(()=>globalThis.__blokuSpaDocumentToken),token,'SPA refresh unexpectedly replaced the top document');
      assert.ok((await getState()).distractionRules[host].includes('#fixture-hide'));
      spaRefreshEvidence.push({phase:currentPhase,ownedPaths:['/settings','/feed'],documentPreserved:true,explicitHidePreserved:true,actualContentConfigRequests:feed.entries,boundary:'Own site.bloku.test history integration only. Consumer/business URL classification is unit-tested separately; no authenticated Facebook or business DOM was exercised.'});
    }finally{
      try{const restored=await contentConfigProbe('restore');assert.ok(restored.restored||restored.absent,'Owned content Chrome API was not restored');}finally{await update(state=>{state.distractionRules=before.distractionRules;});assert.deepEqual((await getState()).distractionRules,before.distractionRules,'SPA fixture selector cleanup changed saved rules');await go();}
    }
  });

  await check('a delayed actual content configuration reply cannot restore a removed hide after a newer SPA refresh',async()=>{
    const before=await getState();
    try{
      await go();await update(state=>{state.distractionRules[host]=[...new Set([...(state.distractionRules[host]??[]),'#fixture-hide'])];});
      await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display==='none',{polling:100});
      await contentConfigProbe('install');await contentConfigProbe('arm');
      await click(fixture,'#spa-settings');await fixture.waitForFunction(()=>location.pathname==='/settings',{polling:100});
      const held=await until(async()=>{const probe=await contentConfigProbe('snapshot');return probe.pending&&probe.entries?.some(entry=>entry.held&&entry.path==='/settings'&&entry.ok&&entry.selectors.includes('#fixture-hide'))?probe:null;},'No actual owned-SPA configuration reply containing the hide was held');
      const heldEntry=held.entries.find(entry=>entry.held);
      await update(state=>{state.distractionRules[host]=(state.distractionRules[host]??[]).filter(selector=>selector!=='#fixture-hide');});
      await fixture.waitForFunction(()=>getComputedStyle(document.querySelector('#fixture-hide')).display!=='none',{polling:100});
      const newer=await until(async()=>{const probe=await contentConfigProbe('snapshot');return probe.entries?.some(entry=>entry.sequence>heldEntry.sequence&&entry.ok&&!entry.selectors.includes('#fixture-hide'))?probe:null;},'A newer real configuration reply did not remove the hide');
      await contentConfigProbe('watch');await contentConfigProbe('release');
      // Observe actual rendered CSS after the old Promise is released. A mutation
      // observer also catches transient stale re-hiding before the final read.
      await wait(750);const observation=await contentConfigProbe('watch-stop');
      assert.equal(observation.pending,false,'The held actual reply was not released');
      assert.ok(observation.entries.find(entry=>entry.sequence===heldEntry.sequence)?.releasedAt,'The old real reply lacks release evidence');
      assert.deepEqual(observation.hiddenObservations,[],'Old content reply re-applied stale hiding CSS');
      assert.notEqual(observation.finalDisplay,null,'Owned hidden-element fixture disappeared during the stale-reply observation');
      assert.notEqual(observation.finalDisplay,'none','Removed explicit hide returned after the stale reply');
      assert.equal(observation.styleText.includes('#fixture-hide'),false,'Stale selector remains in the actual content-owned style');
      assert.equal((await getState()).distractionRules[host]?.includes('#fixture-hide'),false);
      spaRefreshEvidence.push({phase:currentPhase,heldActualReply:heldEntry,newerActualReplies:newer.entries.filter(entry=>entry.sequence>heldEntry.sequence),oldReplyReleased:true,observationMs:observation.observationMs,hiddenObservations:observation.hiddenObservations,finalDisplay:observation.finalDisplay,boundary:'One deliberately reordered actual GET_PAGE_CONFIG reply in an owned isolated content world; no configuration response forgery, production test hooks, social-site impersonation or universal race-proof claim.'});
    }finally{
      try{const restored=await contentConfigProbe('restore');assert.ok(restored.restored||restored.absent,'Owned content Chrome API was not restored');}finally{await update(state=>{state.distractionRules=before.distractionRules;});assert.deepEqual((await getState()).distractionRules,before.distractionRules,'Stale-reply fixture selector cleanup changed saved rules');await go();}
    }
  });

  await check('real settings file import uses explicit validated action and never replays timers',async()=>{
    const before=await getState(),imported=structuredClone(before);imported.preferences.theme=before.preferences.theme==='dark'?'light':'dark';imported.focusSessions=[];
    const file=path.join(output,'runtime-import-fixture.json');await writeFile(file,JSON.stringify({format:'bloku-settings',version:2,state:imported}));
    await openOptionsSection(english.rules);await options.evaluate(()=>{globalThis.__blokuObservedActions=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(message,...args)=>{globalThis.__blokuObservedActions.push(message.action);return original(message,...args);};});
    await (await options.$('main input[type=file]')).uploadFile(file);await options.waitForFunction(label=>document.querySelector('[role=status]')?.textContent===label,{polling:100},english.importReady);
    assert.equal((await getState()).preferences.theme,before.preferences.theme,'Import preview applied before Save');await click(options,'main>button.primary');await until(async()=>(await getState()).preferences.theme===imported.preferences.theme,'Import Save did not commit');
    assert.equal(await options.evaluate(()=>globalThis.__blokuObservedActions.includes('SAVE_IMPORT')),true,'UI bypassed revision-checked explicit import validation');assert.equal(await options.evaluate(()=>globalThis.__blokuObservedActions.includes('IMPORT_STATE')),false,'UI used unguarded import action');assert.deepEqual((await getState()).activity,before.activity);
    const replay=await getState(),base=settingsKey(replay);replay.focusSessions=[{id:'hostile-replayed-timer',profileId:'runtime-focus',startedAt:Date.now(),endsAt:Date.now()+1_500_000,breakUntil:null}];const reply=await message('SAVE_IMPORT',{state:replay,base});assert.equal(reply.ok,false);assert.match(reply.error,/Active sessions are not imported/);assert.equal((await getState()).focusSessions.length,0);
  });

  await check('popup reports recurring focus and settings expose seven weekday controls',async()=>{
    await update(state=>{state.focusProfiles.push({id:'schedule-status',name:'Schedule status fixture',domains:['scheduled.bloku.test'],enabled:true,schedules:[{days:[0,1,2,3,4,5,6],start:'00:00',end:'00:00'}],dailyAllowanceMinutes:null});});
    await refreshPopup();await popup.waitForFunction(label=>document.querySelector('#focus-controls')?.open&&document.body.innerText.includes(label),{polling:100},english.focusActive);
    assert.ok(await popup.evaluate(label=>document.body.innerText.includes(label),english.schedules));
    await options.reload({waitUntil:'domcontentloaded'});await options.waitForSelector('main h1');await openOptionsSection(english.focus);assert.equal(await options.$$eval('.weekdays input[type=checkbox]',nodes=>nodes.length),7);
    await update(state=>{state.focusProfiles=state.focusProfiles.filter(profile=>profile.id!=='schedule-status');});
  });

  await check('content-origin forged state update and cross-host picker writes are denied', async () => {
    await go(); const before = await getState(); const forged = structuredClone(before); forged.preferences.adsEnabled = !before.preferences.adsEnabled;
    const stateReply = await contentMessage('UPDATE_STATE', forged); assert.equal(stateReply?.ok, false); assert.match(stateReply.error, /only available from BLOKU settings/);
    for(const [action,payload] of [['SET_THEME',{theme:before.preferences.theme==='dark'?'light':'dark'}],['SAVE_IMPORT',{state:forged,base:settingsKey(before)}]]){const denied=await contentMessage(action,payload);assert.equal(denied?.ok,false,`${action} accepted a content-origin sender`);assert.match(denied.error,/only available from BLOKU settings/);}
    const pickerReply = await contentMessage('SAVE_PICKER_RULE', { domain: 'other.bloku.test', selector: '#pick-me' }); assert.equal(pickerReply?.ok, false); assert.match(pickerReply.error, /Invalid element-hiding request/);
    const after = await getState(); assert.equal(settingsKey(after),settingsKey(before),'Denied content-origin RPC mutated editable settings');assert.deepEqual(after.focusSessions,before.focusSessions);assert.equal(after.distractionRules['other.bloku.test'], undefined);
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

  await check('actual worker restart preserves focus/settings and re-marks a paused document until explicit committed reload', async () => {
    let pausedDocument,sessionCDP;const restartHost='restart.bloku.test';
    try{
      await request('SITE_PAUSE',{domain:restartHost,paused:true,minutes:null});pausedDocument=await page({width:1000,height:800});await go(pausedDocument,`http://${restartHost}:${port}/`);const pausedTab=await currentTab(pausedDocument);assert.equal(pausedTab.pauseReloadRequired,false,'Newly committed paused document starts pending');
      await update(state => { state.distractionRules[host] = []; });
      const started = await request('START_FOCUS', { profileId: 'runtime-focus', minutes: 25 }); const session = started.state.focusSessions.at(-1); const before = await getState();
      // Clear the mark caused by this focus setup, then prove worker startup independently re-marks it.
      await explicitReload(pausedDocument,pausedTab.tab.id);const token=await pausedDocument.evaluate(()=>globalThis.__blokuDocumentToken=`${Date.now()}-${Math.random()}`);assert.equal(await loadScript(pausedDocument),true,'Prepared paused document did not permit owned ad script after explicit reload');
      sessionCDP = await options.createCDPSession(); const versions = new Map(); sessionCDP.on('ServiceWorker.workerVersionUpdated', event => { for (const value of event.versions) versions.set(value.versionId, value); }); await sessionCDP.send('ServiceWorker.enable');
      const version = await until(() => [...versions.values()].find(value => value.scriptURL.startsWith(`chrome-extension://${extensionId}/`) && value.runningStatus === 'running'), 'Running production service worker version not found');
      restartingWorker=true;await Promise.allSettled(workerInspectionSessions.map(session=>session.detach()));
      await sessionCDP.send('ServiceWorker.stopWorker', { versionId: version.versionId }); await until(() => versions.get(version.versionId)?.runningStatus === 'stopped', 'CDP did not confirm actual worker stop');
      const reply = await Promise.race([request('GET_STATE'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Worker failed to wake within 20 seconds after explicit stop')),20000))]); restartingWorker=false;for(const target of browser.targets().filter(t=>t.type()==='service_worker')){instrumented.delete(target);await instrument(target);} assert.equal(reply.engine?.ok, true); assert.ok(reply.state.focusSessions.some(value => value.id === session.id && value.endsAt === session.endsAt)); assert.deepEqual(reply.state.sitePolicies, before.sitePolicies); assert.deepEqual(reply.state.activity, before.activity); assert.equal(reply.state.preferences.theme, before.preferences.theme);
      const pending=await currentTab(pausedDocument);assert.equal(pending.tab.id,pausedTab.tab.id);assert.equal(pending.pauseReloadRequired,true,'Worker startup did not re-mark the existing paused document');assert.equal(await pausedDocument.evaluate(()=>globalThis.__blokuDocumentToken),token,'Worker startup automatically reloaded the user document');
      await explicitReload(pausedDocument,pausedTab.tab.id);assert.equal(await pausedDocument.evaluate(()=>globalThis.__blokuDocumentToken),undefined);assert.equal(await loadScript(pausedDocument),true,'Explicit reload after worker startup did not apply the stored pause');assert.ok((await getState()).focusSessions.some(value=>value.id===session.id),'Pause reload after worker restart ended focus');
      pauseReloadEvidence.push({phase:currentPhase,workerActuallyStopped:true,workerStartupReMarksPausedDocument:true,noAutomaticReload:true,manualReloadCreatesFreshDocument:true,pendingClearsAfterTopCommit:true,pausedScriptAllowedAfterExplicitReload:true,liveFocusPreserved:true});
      await go(); await fixture.waitForFunction(id => location.href.startsWith(`chrome-extension://${id}/blocked.html`), {polling:100}, extensionId);
    }finally{restartingWorker=false;if(sessionCDP)await sessionCDP.detach();if(pausedDocument&&!pausedDocument.isClosed())await pausedDocument.close();await request('SITE_PAUSE',{domain:restartHost,paused:false,minutes:null});}
  });

  await check('worker wake retains one automatic welcome tab and only the explicit owned reload request is fulfilled', async () => { assert.deepEqual(outbound, [], 'Nonfixture outbound attempt outside the exact clean welcome was recorded and blocked');assert.ok(automaticWelcome?.persistedFlag,'Automatic welcome evidence is missing');assert.equal(lifecycleRequests.length,1,'Unexpected extra owned lifecycle request');assert.equal(lifecycleRequests[0].kind,'explicit-owned-reload');assert.equal(lifecycleRequests[0].url,'https://bloku.app/hey');const tabs=await options.evaluate(async()=>(await chrome.tabs.query({})).filter(tab=>tab.url==='https://bloku.app/hey'||tab.pendingUrl==='https://bloku.app/hey'));assert.equal(tabs.length,1,'Worker wake or UI flow opened another welcome tab');assert.equal(tabs[0].id,automaticWelcome.tabId,'The original automatic welcome tab was replaced');assert.equal(await options.evaluate(async()=>(await chrome.storage.local.get('blokuWelcomeV2')).blokuWelcomeV2),true); });
  await check('completed UI and content flows emitted no console/runtime errors', async () => { checkedErrorCount=errors.length;assert.deepEqual(errors, [], 'Actual UI/content/worker runtime emitted errors'); });
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
  closing=true;if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
  const checksums = await readFile(path.join(extension, 'checksums.json'), 'utf8').catch(() => null);
  if (checksums !== checksumBytes.toString('utf8')) results.push({ name: 'package remained unchanged during runtime check', pass: false, error: 'dist checksums changed during the run' });
  if(errors.length>checkedErrorCount)results.push({name:'additional runtime errors after the UI/content error assertion',pass:false,error:JSON.stringify(errors.slice(checkedErrorCount))});
  const report = { status: results.length > 0 && results.every(result => result.pass||result.skip) ? 'PASS — BOUNDED LOCAL RUNTIME CHECK' : 'FAIL — NOT QUALIFIED', observedAt: new Date().toISOString(), browser: browserVersion, runnerSha256, runtimeEnvironment, manifestVersion: manifest.version, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), checksumsManifestSha256: checksums ? createHash('sha256').update(checksums).digest('hex') : null, extensionDirectory: extension, packageArchive, results, errors, cleanupErrors, casCleanupFailures, blockedNonfixtureOutboundAttempts: outbound, automaticWelcome, observedStartupWelcomeAttempts:startupWelcomeAttempts, interceptedLifecycleRequests:lifecycleRequests, networkProbeDiagnostics, pauseReloadEvidence, spaRefreshEvidence, screenshots, readRetries, screenshotsSkipped:process.env.BLOKU_SKIP_SCREENSHOTS==='1', limits: ['Only the actual local dist and owned HTTP fixtures were exercised; one automatic clean welcome tab and persisted flag are checked separately from the explicit owned welcome reload.', 'bloku.app is denied by launch DNS rules before instrumentation; the first automatic navigation and its initial DNS attempt may precede CDP observation. Only the explicit reload response is fulfilled with script-free owned HTML.', 'The popup document was opened at popup dimensions in a tab; native toolbar popup interaction was not tested.', 'Network monitoring begins after browser target instrumentation; the first launch milliseconds are not observed.', 'Only the exact browser-is-shutting-down message received after owned browser closure starts is separated into cleanupErrors; other late errors remain qualification failures.', 'Delayed settings replies were held in an owned options tab. Content-SPA tests additionally observed GET_PAGE_CONFIG in the owned fixture isolated world and held one actual reply unchanged; original Chrome API and selectors are restored in finally. No production hooks or configuration response forgery were added.', 'Owned /settings and /feed transitions qualify history-refresh integration and one reordered content reply only. Consumer/business URL exclusions remain separate pure unit checks; no authenticated business or social DOM was exercised.', 'No live public video/social website, real customer data, billing, donation, deployment or store submission was used.', 'Stock SDK document/frame exemptions are not claimed to survive reconfiguration unchanged. Existing paused pages explicitly require user reload; the reconfiguration-boundary acceptance probes run only after a fresh committed top-document reload. The earlier failing pre-reload run remains archived in .local/audit-20261102/runtime-failed-7b04-20261102T072803Z.', 'Activity CAS is skipped only when its positive-observation prerequisite explicitly reports an idle/locked host; no empty activity delta counts as coverage. Session CAS runs independently, and owned CAS sessions are ended before their profile is removed.', 'The gate does not establish every supported-site preset, consent vendor, schedule/DST boundary, or 90-day real-time retention behavior.'] };
  await writeFile(path.join(output, 'runtime-results.json'), JSON.stringify(report, null, 2)+'\n');
  const rows = results.map(result => `| ${result.skip?'SKIP':result.pass ? 'PASS' : 'FAIL'} | ${result.name.replaceAll('|', '\\|')} | ${result.skip ? result.reason.replaceAll('|', '\\|') : result.error ? result.error.replaceAll('|', '\\|').replaceAll('\n', ' ') : `${result.ms} ms`} |`).join('\n');
  await writeFile(reportPath, `# Runtime qualification: ${report.status}\n\nObserved: ${report.observedAt}. Browser: ${browserVersion ?? 'not launched'}. Runner SHA-256: \`${runnerSha256}\`. Runtime: ${runtimeEnvironment.nodeVersion}, ${runtimeEnvironment.platform}/${runtimeEnvironment.architecture}. Actual package: \`${extension}\`, version \`${manifest.version}\`. Manifest SHA-256: \`${report.manifestSha256}\`. Packaged checksums manifest SHA-256: \`${report.checksumsManifestSha256}\`. ${packageArchive?`Archive: ${packageArchive.name}, SHA-256: ${packageArchive.sha256}.`:''}\n\n| Result | Actual check | Evidence |\n| --- | --- | --- |\n${rows}\n\nDetailed machine evidence: \`B2/artifacts/qualification/runtime-results.json\`. Screenshots: ${screenshots.map(file => `\`B2/artifacts/qualification/${file}\``).join(', ') || 'none'}.\n\n${report.limits.map(limit => `- ${limit}`).join('\n')}\n\nAll browser/server processes and the isolated temporary profile are task-owned and closed/removed by the runner. A bounded pass is not an unconditional production/store qualification. Failures remain explicit and must be resolved by the source owners before a new final package is accepted.\n`);
  console.log(JSON.stringify({ status: report.status, passed: results.filter(result => result.pass).length, failed: results.filter(result => !result.pass&&!result.skip).length,skipped:results.filter(result=>result.skip).length, output: path.join(output, 'runtime-results.json') }));
  if (results.some(result => !result.pass&&!result.skip)) process.exitCode = 1;
}
