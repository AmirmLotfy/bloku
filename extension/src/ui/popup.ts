import {request,element,button,showError,setTheme} from './api';
import {loadMessages,applyLanguage,type Messages} from './i18n';
import {normalizeDomain,domainMatches,type StateV2} from '../model';
import {effectiveFocus} from '../focus';
import presets from '../../data/presets.json';
import {presetSiteForUrl,supportsPageControls} from '../distraction-scopes';
let state:StateV2;let text:Messages;let tab:chrome.tabs.Tab|undefined;let pauseReloadRequired=false;
const app=document.querySelector<HTMLElement>('#app')!;
const expanded=new Map<string,boolean>();
function disclosure(id:string,initial=false){const node=element('details',undefined,'popup-disclosures');node.id=id;node.open=expanded.get(id)??initial;return node;}
function icon(name:string){
 const paths:Record<string,string>={shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',moon:'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3l1-2h4l1 2 2 1 2-.1 2 3-1 2v3l1 2-2 3-2-.1-2 1-1 3h-4l-1-3-2-1-2 .1-2-3 1-2V9L3 7l2-3 2 .1Z',hide:'m13 2-3 8H4l7 5-2 7 11-12h-7l3-8Z',restore:'M3 10a9 9 0 1 1 1 9M3 3v7h7',focus:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',network:'M3 12h18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',reload:'M20 7a9 9 0 1 0 1 9M20 2v6h-6'};
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]||paths.shield);svg.append(path);return svg;
}
function action(label:string,name:string,run:()=>void|Promise<void>,className=''){const node=button(label,run,className);node.prepend(icon(name));return node;}
async function refresh(){
 const response=await request('GET_STATE');state=response.state!;text=await loadMessages(state.preferences.locale);applyLanguage(state.preferences.locale);setTheme(state.preferences.theme);
 const current=await request('GET_TAB');tab=current.tab;pauseReloadRequired=Boolean(current.pauseReloadRequired);const status=document.querySelector<HTMLElement>('[role=status]');if(status){status.textContent='';status.classList.remove('error');}render(response.engine);
}
async function change(action:string,payload:unknown,focusId?:string){const focused=focusId||(document.activeElement as HTMLElement|null)?.id;try{await request(action,payload);await refresh();}catch(error){await refresh().catch(()=>undefined);showError(error);}if(focused)document.getElementById(focused)?.focus({preventScroll:true});}
function render(engine:any){
 for(const node of app.querySelectorAll<HTMLDetailsElement>('details[id]'))expanded.set(node.id,node.open);
 app.replaceChildren();
 const host=normalizeDomain(tab?.url),pauses=host?state.sitePolicies.filter(p=>domainMatches(host,p.domain)&&(p.adsPausedUntil===null||p.adsPausedUntil>Date.now())):[],parentPause=pauses.find(p=>p.domain!==host),paused=pauses.length>0;
 const sessions=state.focusSessions.filter(s=>s.endsAt>Date.now()),focusReasons=effectiveFocus(state),savedCount=host?(state.distractionRules[host]?.length??0)+(state.embeddedHides??[]).filter(rule=>rule.site===host).reduce((sum,rule)=>sum+rule.selectors.length,0):0;
 const header=element('header',undefined,'popup-header'),brand=element('div','BLOKU','brand'),image=element('img');image.src='icons/icon-48.png';image.alt='';brand.prepend(image);
 const headerActions=element('div',undefined,'popup-header-actions'),themes=element('div',undefined,'theme-segment');themes.setAttribute('role','group');themes.setAttribute('aria-label',text.theme);
 for(const choice of ['light','dark'] as const){const node=action('',choice==='light'?'sun':'moon',()=>change('SET_THEME',{theme:choice},`theme-${choice}`),'icon-button');node.id=`theme-${choice}`;node.setAttribute('aria-label',text[choice]);node.title=text[choice];node.setAttribute('aria-pressed',String(state.preferences.theme===choice));themes.append(node);}
 const settings=action('','settings',()=>chrome.runtime.openOptionsPage(),'icon-button');settings.title=text.options;settings.setAttribute('aria-label',text.options);headerActions.append(themes,settings);header.append(brand,headerActions);app.append(header);
 const card=element('section',undefined,'protection-panel');
 const effective=!engine?.ok?text.needsAttention:!state.preferences.adsEnabled?text.adsOff:paused?(pauseReloadRequired?text.pauseReloadStatus:text.adsPaused):text.adsActive;
 const statusRow=element('div',undefined,'site-status'),shield=element('span',undefined,'status-shield');shield.append(icon('shield'));const site=element('div',undefined,'site-identity');site.append(element('p',effective,!engine?.ok||paused?'warning':!state.preferences.adsEnabled?'muted':'success'),element('h1',host||text.noPage));
 const toggle=element('label',undefined,'protection-switch'),check=element('input');check.id='ads-enabled';check.type='checkbox';check.checked=state.preferences.adsEnabled;check.setAttribute('aria-label',text.adsEnabled);check.addEventListener('change',()=>{check.disabled=true;void change('SET_ADS_ENABLED',{enabled:check.checked},check.id);});toggle.title=text.adsEnabled;toggle.append(check,element('span',undefined,'switch-track'));statusRow.append(shield,site,toggle);card.append(statusRow);
 const metrics=element('div',undefined,'popup-metrics'),matches=element('strong','—');
 const network=button('',async()=>{const reply=await request('GET_MATCHES',{tabId:tab!.id});matches.textContent=String(reply.matches??0);network.setAttribute('aria-label',`${text.matches}: ${reply.matches??0}`);},'metric');network.setAttribute('aria-label',text.inspect);network.title=text.inspect;network.disabled=!host;network.append(matches,element('span',text.pageMatches));
 const hidden=element('div',undefined,'metric');hidden.append(element('strong',String(savedCount)),element('span',text.hiddenElements));
 const activeFocus=element('div',undefined,'metric');activeFocus.append(element('strong',String(sessions.length?Math.max(...sessions.map(s=>Math.ceil((s.endsAt-Date.now())/60000))):0)),element('span',text.remainingMinutes));metrics.append(network,hidden,activeFocus);card.append(metrics);
 const tools=element('div',undefined,'popup-tools');
 if(paused&&pauseReloadRequired){const notice=element('div',undefined,'pause-reload-notice');notice.append(element('p',text.pauseReloadHelp,'warning'),action(text.reloadPage,'reload',async()=>{await request('RELOAD_PAGE',{tabId:tab!.id});window.close();},'primary'));tools.append(notice);}
 const picker=action(text.picker,'hide',async()=>{await request('PICK_ELEMENT',{tabId:tab!.id});window.close();},'primary');picker.disabled=!supportsPageControls(tab?.url);tools.append(picker);
 if(savedCount)tools.append(action(text.restoreSite,'restore',async()=>{await request('RESTORE_SITE_HIDES',{domain:host,tabId:tab!.id});await refresh();},'quiet-button'));
 if(host){
  if(parentPause)tools.append(element('p',text.inheritedPause.replace('{domain}',parentPause.domain),'muted'),button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));
  else{const pauses=element('div',undefined,'pause-actions'),temporary=button(paused?text.resume:text.pause10,async()=>{await request('SITE_PAUSE',{domain:host,paused:!paused,minutes:10});await refresh();}),persistent=button(text.pauseAlways,async()=>{await request('SITE_PAUSE',{domain:host,paused:true,minutes:null});await refresh();});temporary.disabled=persistent.disabled=!state.preferences.adsEnabled;pauses.append(temporary,persistent);tools.append(pauses);}
 }else tools.append(element('p',text.noPage,'muted'));
 if(host&&!supportsPageControls(tab?.url))tools.append(element('p',text.protectedPage,'muted'));card.append(tools);
 const supported=presetSiteForUrl(tab?.url),distractions=disclosure('distraction-controls');
 const summary=element('summary',text.distractions);summary.prepend(icon('hide'));distractions.append(summary);
 if(supported){const section=element('div',undefined,'preset-options');for(const group of presets[supported as keyof typeof presets].groups){const label=element('label',text[group.id as keyof Messages]||group.label),input=element('input');input.id=`preset-${group.id}`;input.type='checkbox';input.checked=(state.distractionPresets[supported]||[]).includes(group.id);input.addEventListener('change',()=>{input.disabled=true;void change('SET_SITE_PRESET',{site:supported,group:group.id,enabled:input.checked},input.id);});label.append(input);section.append(label);}distractions.append(section);}
 else distractions.append(element('p',text.presetsHelp,'muted'),button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));
 if(host&&Object.entries(state.distractionRules).some(([domain,rules])=>domain!==host&&rules.length&&domainMatches(host,domain)))distractions.append(element('p',text.inheritedHides,'muted'),button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));
 card.append(distractions);
 const advanced=disclosure('protection-controls'),advancedTitle=element('summary',text.protection);advancedTitle.prepend(icon('network'));advanced.append(advancedTitle,element('p',`${text.engineHealth}: ${engine?.ok?text.confirmed:text.needsAttention}`,engine?.ok?'success':'warning'),element('p',text.countsHelp,'muted'));
 if(host)advanced.append(action(text.reloadPage,'reload',async()=>{await request('RELOAD_PAGE',{tabId:tab!.id});window.close();}),element('p',text.reloadHelp,'muted'));card.append(advanced);app.append(card);
 const focus=element('section',undefined,'focus-panel'),focusDetails=disclosure('focus-controls',focusReasons.length>0);
 const focusTitle=element('summary',text.focus);focusTitle.prepend(icon('focus'));focusDetails.append(focusTitle);
 for(const reason of focusReasons.filter(reason=>reason.reason!=='session'))focusDetails.append(element('p',`${text.focusActive} · ${reason.name} · ${reason.reason==='schedule'?text.schedules:text.allowance}`));
 for(const session of sessions){const name=state.focusProfiles.find(p=>p.id===session.profileId)?.name||text.focus;focusDetails.append(element('p',`${name} · ${Math.ceil((session.endsAt-Date.now())/60000)} ${text.minutes}${session.breakUntil&&session.breakUntil>Date.now()?` · ${text.breakActive}`:''}`),button(text.break,async()=>{await request('BREAK_FOCUS',{sessionId:session.id});await refresh();}),button(text.endFocus,async()=>{await request('END_FOCUS',{sessionId:session.id});await refresh();}));}
 if(!sessions.length&&state.focusProfiles.length){const select=element('select');select.setAttribute('aria-label',text.profileName);state.focusProfiles.forEach(p=>{const option=element('option',p.name);option.value=p.id;select.append(option);});const minutes=element('input');minutes.type='number';minutes.min='1';minutes.max='1440';minutes.value='25';minutes.setAttribute('aria-label',text.sessionMinutes);focusDetails.append(select,minutes,button(text.startFocus,async()=>{await request('START_FOCUS',{profileId:select.value,minutes:Number(minutes.value)});await refresh();},'primary'));}else if(!sessions.length)focusDetails.append(element('p',text.profileRequired,'muted'),button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));
 focus.append(focusDetails);app.append(focus);
 const footer=element('footer',undefined,'popup-footer');footer.append(element('span',text.free,'free-label'),button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));app.append(footer);
}
refresh().catch(showError);
