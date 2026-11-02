import puppeteer from 'puppeteer-core';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.env.BLOKU_BROWSER_LANE_GRANTED!=='1')throw Error('Explicit browser lane grant required');
const id=new Date().toISOString().replace(/[:.]/g,'-'),profile=path.join(root,'engine/.cache',`native-audit-profile-${id}`),output=path.join(root,'artifacts/native-audit',id);await mkdir(output,{recursive:true});
const extension=process.env.BLOKU_EXTENSION_PATH??path.join(root,'dist'),bytes=await readFile(path.join(extension,'checksums.json')),sha=x=>createHash('sha256').update(x).digest('hex');for(const[file,digest]of Object.entries(JSON.parse(bytes)))if(sha(await readFile(path.join(extension,file)))!==digest)throw Error('Package byte mismatch');
const frame=`<!doctype html><meta charset="utf-8"><title>Owned widget frame</title><style>body{font:18px system-ui;padding:15px;background:#fbf8f5}.hide-me{background:#f0ccd6;border:2px solid #8b1230;padding:22px;margin-bottom:18px;outline:1px solid green!important}button{font:inherit;padding:12px}</style><div id="widget-promotion" class="hide-me">Owned embedded promotion — right-click here</div><button id="widget-action">Widget action</button><output id="widget-count">0</output><script>document.querySelector('button').onclick=()=>document.querySelector('output').textContent=Number(document.querySelector('output').textContent)+1;</script>`;
let port,browser,options,server,closed=false;
const popupTarget=()=>`http://popup-target.bloku.test:${port}/popup-target`;
const oauthTarget=()=>`http://auth.bloku.test:${port}/oauth-popup`;
function popupFixture(kind){return `<!doctype html><meta charset="utf-8"><title>Owned ${kind} popup fixture</title><style>body{font:19px/1.6 system-ui;margin:30px}button{font:inherit;padding:12px}</style><h1>Owned ${kind} popup fixture</h1><p>Harmless local test page. No account, credentials, payment or authentication is performed.</p><button id="close-owned-popup">Close this test window</button><script>document.querySelector('button').onclick=()=>window.close();</script>`;}
server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');
  if(req.url==='/frame'){res.end(frame);return;}
  if(req.url==='/popup-target'){res.end(popupFixture('designated ad-target'));return;}
  if(req.url==='/oauth-popup'){res.end(popupFixture('ordinary OAuth-like'));return;}
  res.end(`<!doctype html><meta charset="utf-8"><title>BLOKU owned UI audit — ${req.headers.host}</title><style>body{font:19px/1.6 system-ui;margin:30px;max-width:950px}iframe{width:900px;max-width:95%;height:290px;border:2px solid #555}button,a,input{font:inherit;margin:8px;padding:10px}.top-ad{background:#ecd5dd;padding:18px}#popup-status{display:block;white-space:pre-wrap;border:1px solid #777;padding:14px}</style><h1>BLOKU owned UI audit</h1><p>Disposable test data. Same widget, separate top-site scopes.</p><div class="top-ad" id="top-promotion">Owned top-page promotion</div><p><a href="http://app.bloku.test:${port}/">Primary site</a><a href="http://other.bloku.test:${port}/">Other site using the same widget</a></p><iframe title="Owned cross-origin widget" src="http://widget.bloku.test:${port}/frame"></iframe><p><label>Normal form <input id="normal-input"></label><button id="normal-action">Normal action</button><output id="normal-count">0</output></p><section><h2>Real popup controls — local fixtures only</h2><p>Click these controls yourself. First verify both windows remain open without a test rule; then compare the designated target with a source-sensitive popup rule. The ordinary OAuth-like fixture is a positive control, not a real sign-in.</p><button id="ordinary-popup">Open ordinary OAuth-like window</button><button id="designated-popup">Open designated ad-popup window</button><p><a id="designated-popup-anchor" href="${popupTarget()}" target="_blank" rel="noopener">Open designated ad target with a normal new-tab link</a></p><output id="popup-status" aria-live="polite">No popup control has been clicked.</output></section><script>
document.querySelector('#normal-action').onclick=()=>document.querySelector('#normal-count').textContent=Number(document.querySelector('#normal-count').textContent)+1;
const references=new Map();let lastStatus='No popup control has been clicked.';let rendered='';
function showPopupStatus(){const rows=[lastStatus];for(const [kind,entry]of references){let status;try{status=entry.ref===null?'window.open returned null (no usable reference)':entry.ref.closed?'closed':'open';}catch(error){status='reference state unavailable: '+error.name;}rows.push(kind+': '+status+'; requested '+entry.at);}const text=rows.join('\\n');if(text!==rendered){document.querySelector('#popup-status').textContent=text;rendered=text;}}
function openOwnedPopup(kind,url,name){const at=new Date().toISOString();const ref=window.open(url,name,'popup,width=560,height=480');references.set(kind,{ref,at});lastStatus=kind+' requested by your click at '+at;showPopupStatus();}
document.querySelector('#ordinary-popup').onclick=()=>openOwnedPopup('ordinary OAuth-like','${oauthTarget()}','bloku-owned-oauth');
document.querySelector('#designated-popup').onclick=()=>openOwnedPopup('designated ad target','${popupTarget()}','bloku-owned-ad');
document.querySelector('#designated-popup-anchor').addEventListener('click',()=>{lastStatus='Normal new-tab link clicked at '+new Date().toISOString()+'; native link navigation has no retained Window reference. Use the event trace for its lifetime.';showPopupStatus();});
setInterval(showPopupStatus,400);
</script>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
async function finish(){
  if(closed)return;closed=true;
  const trace=await options?.evaluate(()=>{globalThis.__blokuNativeAuditDispose?.();return globalThis.__blokuNativeAuditEvents??null;}).catch(()=>null);
  if(trace)await writeFileSafe('events-final.json',trace);
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  await rm(profile,{recursive:true,force:true});
  await writeFileSafe('cleanup.json',{observedAt:new Date().toISOString(),browserClosed:true,ownedServerClosed:true,ownedProfileRemoved:true,profile:path.basename(profile)});
  console.log('CLEANUP_COMPLETE');process.exit(process.exitCode??0);
}
process.on('uncaughtException',error=>{process.exitCode=1;console.error(String(error));void finish();});process.on('unhandledRejection',error=>{process.exitCode=1;console.error(String(error));void finish();});
process.on('SIGTERM',()=>void finish());process.on('SIGINT',()=>void finish());
browser=await puppeteer.launch({headless:false,executablePath:process.env.BLOKU_CHROME_PATH??path.join(root,'engine/.cache/browser/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),userDataDir:profile,enableExtensions:[extension],args:['--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--no-proxy-server',`--host-resolver-rules=MAP *.bloku.test 127.0.0.1, MAP bloku.app ~NOTFOUND`]});
const target=await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith('chrome-extension:'),{timeout:30000}),extensionId=new URL(target.url()).hostname;
options=await browser.newPage();await options.goto(`chrome-extension://${extensionId}/options.html`);await options.waitForSelector('nav button');const state=await options.evaluate(()=>chrome.runtime.sendMessage({type:'BLOKU_V2',action:'GET_STATE'}));if(!state.ok||!state.engine.ok)throw Error('Engine initialization failed');
// Observe the existing extension APIs from this trusted test options context.
// No production listener, permission, blocking response, cookies or headers are added.
await options.evaluate(async()=>{
  globalThis.__blokuNativeAuditDispose?.();
  const trace={startedAt:new Date().toISOString(),scope:'Owned HTTP .bloku.test main-frame targets only; pending blank tabs only when opened by an owned fixture. No headers, cookies, body or unrelated URLs.',events:[],dropped:0};
  globalThis.__blokuNativeAuditEvents=trace;
  const ownedTabs=new Set();
  function ownedURL(value){try{const u=new URL(value);return u.protocol==='http:'&&u.hostname.endsWith('.bloku.test')?u.origin+u.pathname:null;}catch{return null;}}
  function add(type,data){if(trace.events.length>=2000){trace.events.shift();trace.dropped++;}trace.events.push({sequence:trace.events.length+trace.dropped,observedAt:Date.now(),type,...data});}
  for(const tab of await chrome.tabs.query({url:['http://*.bloku.test/*']}))ownedTabs.add(tab.id);
  const created=tab=>{const url=ownedURL(tab.pendingUrl||tab.url),ownedOpener=ownedTabs.has(tab.openerTabId);if(!url&&!ownedOpener)return;ownedTabs.add(tab.id);add('tabs.onCreated',{tabId:tab.id,openerTabId:tab.openerTabId??null,url,pendingOwnedOpener:!url&&ownedOpener,status:tab.status??null});};
  const updated=(tabId,change,tab)=>{const url=ownedURL(change.url||tab.pendingUrl||tab.url);if(!url&&!ownedTabs.has(tabId))return;add('tabs.onUpdated',{tabId,url,status:change.status??null,urlChanged:typeof change.url==='string'});if(url)ownedTabs.add(tabId);};
  const removed=(tabId,info)=>{if(!ownedTabs.has(tabId))return;add('tabs.onRemoved',{tabId,windowId:info.windowId,isWindowClosing:info.isWindowClosing});ownedTabs.delete(tabId);};
  const navigation=details=>{const url=ownedURL(details.url);if(!url&&!ownedTabs.has(details.sourceTabId))return;ownedTabs.add(details.tabId);add('webNavigation.onCreatedNavigationTarget',{tabId:details.tabId,sourceTabId:details.sourceTabId,sourceFrameId:details.sourceFrameId,url,timeStamp:details.timeStamp});};
  const request=type=>details=>{const url=ownedURL(details.url);if(!url)return;add(type,{requestId:details.requestId,tabId:details.tabId,frameId:details.frameId,parentFrameId:details.parentFrameId,url,method:details.method,timeStamp:details.timeStamp,statusCode:details.statusCode??null,error:details.error??null,redirectUrl:ownedURL(details.redirectUrl)});};
  const before=request('webRequest.onBeforeRequest'),redirect=request('webRequest.onBeforeRedirect'),completed=request('webRequest.onCompleted'),failed=request('webRequest.onErrorOccurred');
  const filter={urls:['http://*.bloku.test/*'],types:['main_frame']};
  chrome.tabs.onCreated.addListener(created);chrome.tabs.onUpdated.addListener(updated);chrome.tabs.onRemoved.addListener(removed);
  chrome.webNavigation.onCreatedNavigationTarget.addListener(navigation);
  chrome.webRequest.onBeforeRequest.addListener(before,filter);chrome.webRequest.onBeforeRedirect.addListener(redirect,filter);chrome.webRequest.onCompleted.addListener(completed,filter);chrome.webRequest.onErrorOccurred.addListener(failed,filter);
  globalThis.__blokuNativeAuditDispose=()=>{
    chrome.tabs.onCreated.removeListener(created);chrome.tabs.onUpdated.removeListener(updated);chrome.tabs.onRemoved.removeListener(removed);
    chrome.webNavigation.onCreatedNavigationTarget.removeListener(navigation);
    chrome.webRequest.onBeforeRequest.removeListener(before);chrome.webRequest.onBeforeRedirect.removeListener(redirect);chrome.webRequest.onCompleted.removeListener(completed);chrome.webRequest.onErrorOccurred.removeListener(failed);
    trace.stoppedAt=new Date().toISOString();
  };
});
for(const p of await browser.pages())if(p!==options)await p.close();const page=await browser.newPage();await page.setViewport(null);await page.goto(`http://app.bloku.test:${port}/`);await page.bringToFront();
await writeFileSafe('setup.json',{id,browser:await browser.version(),packageChecksumsSha256:sha(bytes),runnerSha256:sha(await readFile(fileURLToPath(import.meta.url))),extensionId,port,profile:path.basename(profile),scope:'Owned disposable native UI fixtures; no personal profile or account. Welcome URL DNS-blocked, not live-website qualification. Actual popup capture never opens popup.html in a tab. Trace is observe-only and excludes headers/cookies/query strings. Popup fixture controls require real user clicks; no automatic clicks or fake extension UI.'});
console.log(JSON.stringify({ready:true,id,output,port,extensionId,primary:`http://app.bloku.test:${port}/`,other:`http://other.bloku.test:${port}/`,ordinaryPopup:oauthTarget(),designatedPopup:popupTarget(),options:`chrome-extension://${extensionId}/options.html`,commands:['state','popup','events','stop']}));
async function writeFileSafe(name,value){const{writeFile}=await import('node:fs/promises');await writeFile(path.join(output,name),JSON.stringify(value,null,2)+'\n');}
async function capturePopup(){
  const expected=`chrome-extension://${extensionId}/popup.html`;
  const matches=browser.targets().filter(target=>target.url()===expected);
  const evidence={observedAt:new Date().toISOString(),present:matches.length>0,provenance:'Existing targets only; harness never opens popup.html, clicks the toolbar or creates replacement UI. Target type is reported without assuming a tab equals a native popover.',targets:[]};
  if(!matches.length)evidence.reason='No existing popup target; no surface was opened.';
  for(const target of matches){
    const result={type:target.type(),url:target.url()};let session;
    try{
      session=await target.createCDPSession();
      const response=await session.send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{const root=document.documentElement,body=document.body,active=document.activeElement;const metrics=element=>element?{clientWidth:element.clientWidth,scrollWidth:element.scrollWidth,clientHeight:element.clientHeight,scrollHeight:element.scrollHeight,width:getComputedStyle(element).width,minWidth:getComputedStyle(element).minWidth,maxWidth:getComputedStyle(element).maxWidth,color:getComputedStyle(element).color,backgroundColor:getComputedStyle(element).backgroundColor}:null;return{innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,root:metrics(root),body:metrics(body),theme:root.dataset.theme,lang:root.lang,dir:root.dir,host:document.querySelector('h1')?.textContent??null,activeElement:active?{tag:active.tagName,id:active.id,role:active.getAttribute('role'),text:active.matches('input,textarea')?null:active.textContent?.slice(0,120)}:null};})()`});
      if(response.exceptionDetails)throw Error(response.exceptionDetails.text);
      result.metrics=response.result.value;
    }catch(error){result.error=String(error.message||error);}
    finally{if(session){try{await session.detach();result.detached=true;}catch(error){result.detached=false;result.detachError=String(error.message||error);}}}
    evidence.targets.push(result);
  }
  await writeFileSafe(`popup-${Date.now()}.json`,evidence);console.log(JSON.stringify(evidence));
}
let commandQueue=Promise.resolve();
const lines=readline.createInterface({input:process.stdin});
lines.on('line',line=>{commandQueue=commandQueue.then(async()=>{
  const command=line.trim();
  if(command==='stop'){await finish();return;}
  if(command==='popup'){await capturePopup();return;}
  if(command==='events'){const evidence=await options.evaluate(()=>globalThis.__blokuNativeAuditEvents??{absent:true,reason:'Observer context was reloaded or closed; no events are fabricated.'});await writeFileSafe(`events-${Date.now()}.json`,evidence);console.log(JSON.stringify(evidence));return;}
  if(command==='state'){const reply=await options.evaluate(()=>chrome.runtime.sendMessage({type:'BLOKU_V2',action:'GET_STATE'}));const state=reply.state,current=await options.evaluate(()=>chrome.runtime.sendMessage({type:'BLOKU_V2',action:'GET_TAB'}));let ownedHost=null;try{const url=new URL(current.tab?.url);if(url.hostname.endsWith('.bloku.test'))ownedHost=url.hostname;}catch{}const evidence={engine:reply.engine,distractionRules:state?.distractionRules,embeddedHides:state?.embeddedHides??[],focusSessions:state?.focusSessions,sitePolicies:state?.sitePolicies,activeOwnedPage:ownedHost?{host:ownedHost,pauseReloadRequired:current.pauseReloadRequired}:null};await writeFileSafe(`state-${Date.now()}.json`,evidence);console.log(JSON.stringify(evidence));}
}).catch(error=>console.log(String(error)));});
