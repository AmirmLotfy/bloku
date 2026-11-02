import {loadMessages,type Messages} from './ui/i18n';
import presets from '../data/presets.json';
type PageConfig={ok:boolean;host:string;preferences:{rejectConsent:boolean;cleanUrls:boolean;gpc:boolean;disableAutoplay:boolean};presets:string[];selectors:string[];locale:string;adsEnabled:boolean};
let config:PageConfig|null=null;let messages:Messages;let style:HTMLStyleElement|null=null;let stopPicker:(()=>void)|null=null;let currentCss='';
const STYLE='bloku-v2-distractions';
function validSelector(value:string){if(value.length>4096||/[{}\x00]/.test(value))return false;try{document.querySelector(value);return true;}catch{return false;}}
function prepareStyle(){
 if(!config)return;const groups=Object.entries(presets).filter(([domain])=>config!.host===domain||config!.host.endsWith(`.${domain}`)).flatMap(([,entry])=>entry.groups.filter(g=>config!.presets.includes(g.id)).flatMap(g=>g.selectors));
 const selectors=[...new Set([...groups,...config.selectors])].filter(validSelector);
 if(!selectors.length){style?.remove();style=null;return;}
 if(!document.documentElement)return;
 if(!style){style=document.createElement('style');style.id=STYLE;}
 currentCss=`${selectors.join(',\n')} {display:none!important}`;if(style.textContent!==currentCss)style.textContent=currentCss;
 if(!style.isConnected)(document.head||document.documentElement).append(style);
}
async function refresh(){
 try{const next=await chrome.runtime.sendMessage({type:'BLOKU_V2',action:'GET_PAGE_CONFIG'}) as PageConfig;if(!next?.ok)return;config=next;messages=await loadMessages(next.locale);prepareStyle();if(next.preferences.rejectConsent)await enableConsent();else stopConsent();}catch{/* Extension updates invalidate old content contexts. */}
}
let consentStarted=false;let consentCleanup:(()=>void)|undefined;
async function enableConsent(){
 if(consentStarted)return;consentStarted=true;
 try{const {startConsent}=await import(chrome.runtime.getURL('consent.js'));const cleanup=await startConsent();if(config?.preferences.rejectConsent)consentCleanup=cleanup;else cleanup();}catch{consentStarted=false;}
}
function stopConsent(){consentCleanup?.();consentCleanup=undefined;consentStarted=false;}
function selectorFor(node:Element):string|null{
 if(node.id){const selector=`#${CSS.escape(node.id)}`;if(document.querySelectorAll(selector).length===1)return selector;}
 const parts:string[]=[];let cursor:Element|null=node;
 while(cursor&&cursor!==document.body&&parts.length<7){
  let part=cursor.tagName.toLowerCase();const classes=[...cursor.classList].filter(s=>s.length<70&&!/\d{5}/.test(s)).slice(0,2);if(classes.length)part+=classes.map(s=>`.${CSS.escape(s)}`).join('');
  const parent:Element|null=cursor.parentElement;if(parent){const siblings=[...parent.children].filter(e=>e.tagName===cursor!.tagName);if(siblings.length>1)part+=`:nth-of-type(${siblings.indexOf(cursor)+1})`;}
  parts.unshift(part);const selector=parts.join(' > ');if(document.querySelectorAll(selector).length===1)return selector;cursor=parent;
 }
 return null;
}
async function startPicker(){
 if(window!==window.top||!config)return;if(!messages)await refresh();stopPicker?.();
 const host=document.createElement('div');host.style.cssText='position:fixed;inset:auto 16px 16px 16px;z-index:2147483647;pointer-events:auto';const shadow=host.attachShadow({mode:'closed'});
 const panel=document.createElement('div');panel.style.cssText='font:14px/1.5 system-ui;background:#fff;color:#171318;border:2px solid #8b1230;border-radius:12px;padding:16px;box-shadow:0 8px 36px #0004;max-width:600px;margin:auto';
 const instruction=document.createElement('p');instruction.textContent=messages.hidePreview;const selectedText=document.createElement('code');selectedText.style.cssText='display:block;overflow-wrap:anywhere;margin-block:8px';const save=document.createElement('button');save.textContent=messages.confirmHide;save.disabled=true;const cancel=document.createElement('button');cancel.textContent=messages.cancel;for(const b of [save,cancel])b.style.cssText='font:inherit;padding:10px 16px;margin-inline-end:8px;cursor:pointer';panel.append(instruction,selectedText,save,cancel);shadow.append(panel);document.documentElement.append(host);
 let hovered:HTMLElement|null=null;let oldOutline='';let selected:Element|null=null;let selector:string|null=null;let previousDisplay='';let previousPriority='';
 function resetOutline(){if(hovered)hovered.style.outline=oldOutline;hovered=null;}
 function cleanup(){resetOutline();if(selected instanceof HTMLElement)selected.style.setProperty('display',previousDisplay,previousPriority);host.remove();document.removeEventListener('pointerover',over,true);document.removeEventListener('click',choose,true);document.removeEventListener('keydown',key,true);stopPicker=null;}
 function over(event:PointerEvent){if(event.composedPath().includes(host)||selected)return;const node=event.target;if(!(node instanceof HTMLElement)||[document.body,document.documentElement].includes(node))return;resetOutline();hovered=node;oldOutline=node.style.outline;node.style.outline='2px solid #8b1230';}
 function choose(event:MouseEvent){if(event.composedPath().includes(host))return;event.preventDefault();event.stopImmediatePropagation();const node=event.target;if(!(node instanceof HTMLElement)||[document.body,document.documentElement].includes(node))return;if(selected instanceof HTMLElement)selected.style.setProperty('display',previousDisplay,previousPriority);resetOutline();selector=selectorFor(node);if(!selector)return;selected=node;previousDisplay=node.style.display;previousPriority=node.style.getPropertyPriority('display');node.style.setProperty('display','none','important');selectedText.textContent=selector;save.disabled=false;save.focus();}
 function key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();cleanup();}}
 cancel.addEventListener('click',cleanup);save.addEventListener('click',async()=>{if(!selector)return;save.disabled=true;try{const reply=await chrome.runtime.sendMessage({type:'BLOKU_V2',action:'SAVE_PICKER_RULE',payload:{domain:config!.host,selector}});if(!reply?.ok)throw new Error(reply?.error||messages.error);const savedSelector=selector;cleanup();await refresh();showUndo(savedSelector);}catch(e){instruction.textContent=e instanceof Error?e.message:messages.error;save.disabled=false;}});
 stopPicker=cleanup;document.addEventListener('pointerover',over,true);document.addEventListener('click',choose,true);document.addEventListener('keydown',key,true);
}
chrome.runtime.onMessage.addListener((message,sender)=>{if(sender.id!==chrome.runtime.id)return false;if(message?.action==='BLOKU_PICKER_START'){void startPicker();}if(message?.action==='BLOKU_REFRESH_CONFIG'){void refresh();}return false;});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.blokuV2)void refresh();});
// Link cleanup is limited to deliberate clicks, known tracking parameters, and unsigned HTTP(S) links.
document.addEventListener('click',event=>{
 if(!config?.preferences.cleanUrls)return;const target=event.target instanceof Element?event.target.closest('a[href]'):null;if(!(target instanceof HTMLAnchorElement))return;
 try{const url=new URL(target.href);if(!['https:','http:'].includes(url.protocol)||[...url.searchParams.keys()].some(k=>/^(sig|signature|token|x-amz-)/i.test(k)))return;for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid','dclid','mc_cid','mc_eid'].includes(key.toLowerCase()))url.searchParams.delete(key);target.href=url.href;}catch{}
},true);
function autoplayControl(){if(!config?.preferences.disableAutoplay||!/(^|\.)youtube\.com$/.test(location.hostname))return;const control=document.querySelector<HTMLElement>('.ytp-autonav-toggle-button[aria-checked="true"]');control?.click();}
let observer:MutationObserver|null=null;
function start(){void refresh();if(!document.documentElement)return;let scheduled=false;observer=new MutationObserver(()=>{const repair=style&&!style.isConnected;const autoplay=config?.preferences.disableAutoplay&&/(^|\.)youtube\.com$/.test(location.hostname)&&!document.hidden;if(scheduled||(!repair&&!autoplay))return;scheduled=true;setTimeout(()=>{scheduled=false;if(style&&!style.isConnected)document.documentElement.append(style);if(autoplay)autoplayControl();},150);});observer.observe(document.documentElement,{childList:true,subtree:true});}
if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.addEventListener('pagehide',()=>{stopPicker?.();stopConsent();observer?.disconnect();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted){observer?.observe(document.documentElement,{childList:true,subtree:true});void refresh();}});

function showUndo(selector:string){
 const host=document.createElement('div');host.style.cssText='position:fixed;inset:auto 16px 16px auto;z-index:2147483647';
 const shadow=host.attachShadow({mode:'closed'}),button=document.createElement('button');button.textContent=messages.undo;button.style.cssText='font:14px system-ui;padding:12px 20px;background:#8b1230;color:white;border:0;border-radius:10px;cursor:pointer';
 button.addEventListener('click',async()=>{const reply=await chrome.runtime.sendMessage({type:'BLOKU_V2',action:'REMOVE_PICKER_RULE',payload:{domain:config!.host,selector}});if(reply?.ok){host.remove();await refresh();}});shadow.append(button);document.documentElement.append(host);setTimeout(()=>host.remove(),10000);
}
