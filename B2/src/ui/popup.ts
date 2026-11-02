import {request,element,button,showError,setTheme} from './api';
import {loadMessages,applyLanguage,type Messages} from './i18n';
import {normalizeDomain,domainMatches,type StateV2} from '../model';
import {effectiveFocus} from '../focus';
import presets from '../../data/presets.json';
let state:StateV2;let text:Messages;let tab:chrome.tabs.Tab|undefined;
const app=document.querySelector<HTMLElement>('#app')!;
async function refresh(){
 const response=await request('GET_STATE');state=response.state!;text=await loadMessages(state.preferences.locale);applyLanguage(state.preferences.locale);setTheme(state.preferences.theme);
 tab=(await request('GET_TAB')).tab;render(response.engine);
}
async function save(){await request('UPDATE_STATE',state);await refresh();}
function render(engine:any){
 app.replaceChildren();const header=element('header',undefined,'row');const brand=element('div','BLOKU','brand');const image=element('img');image.src='icons/icon-48.png';image.alt='';brand.prepend(image);header.append(brand,element('span',text.free,'badge'));app.append(header);
 const host=normalizeDomain(tab?.url),pauses=host?state.sitePolicies.filter(p=>domainMatches(host,p.domain)&&(p.adsPausedUntil===null||p.adsPausedUntil>Date.now())):[],parentPause=pauses.find(p=>p.domain!==host),paused=pauses.length>0,card=element('section',undefined,'card stack');card.append(element('small',text.currentSite),element('h1',host||text.noPage));
 const toggle=element('label',text.adsEnabled);const check=element('input');check.type='checkbox';check.checked=state.preferences.adsEnabled;check.addEventListener('change',()=>{state.preferences.adsEnabled=check.checked;void save().catch(showError);});toggle.append(check);card.append(toggle);
 card.append(element('p',`${text.engineHealth}: ${engine?.ok?text.confirmed:text.needsAttention}`,'muted'));
 const effective=!engine?.ok?text.needsAttention:!state.preferences.adsEnabled?text.adsOff:paused?text.adsPaused:text.adsActive;card.append(element('p',effective,!engine?.ok||paused?'warning':!state.preferences.adsEnabled?'muted':'success'));
 if(host){
 if(parentPause)card.append(element('p',text.inheritedPause.replace('{domain}',parentPause.domain),'muted'),button(text.options,()=>chrome.runtime.openOptionsPage()));
 else{const temporary=button(paused?text.resume:text.pause10,async()=>{await request('SITE_PAUSE',{domain:host,paused:!paused,minutes:10});await refresh();}),persistent=button(text.pauseAlways,async()=>{await request('SITE_PAUSE',{domain:host,paused:true,minutes:null});await refresh();});temporary.disabled=persistent.disabled=!state.preferences.adsEnabled;card.append(temporary,persistent);}
 card.append(button(text.picker,async()=>{await request('PICK_ELEMENT',{tabId:tab!.id});window.close();}));
 const site=Object.keys(presets).find(d=>host===d||host.endsWith(`.${d}`));if(site){const section=element('div',undefined,'stack');section.append(element('h2',text.distractions));for(const group of presets[site as keyof typeof presets].groups){const label=element('label',text[group.id as keyof Messages]||group.label);const input=element('input');input.type='checkbox';input.checked=(state.distractionPresets[site]||[]).includes(group.id);input.addEventListener('change',()=>{const enabled=new Set(state.distractionPresets[site]||[]);input.checked?enabled.add(group.id):enabled.delete(group.id);state.distractionPresets[site]=[...enabled];if(site==='x.com'||site==='twitter.com'){state.distractionPresets['x.com']=[...enabled];state.distractionPresets['twitter.com']=[...enabled];}void save().catch(showError);});label.append(input);section.append(label);}card.append(section);}
 const counts=element('p',text.countsHelp,'muted');card.append(button(text.inspect,async()=>{const reply=await request('GET_MATCHES',{tabId:tab!.id});counts.textContent=`${text.matches}: ${reply.matches??0}. ${text.countsHelp}`;}),counts);
 }
 app.append(card);const focus=element('section',undefined,'card stack');focus.style.marginTop='12px';focus.append(element('h2',text.focus));
 for(const reason of effectiveFocus(state).filter(reason=>reason.reason!=='session'))focus.append(element('p',`${text.focusActive} · ${reason.name} · ${reason.reason==='schedule'?text.schedules:text.allowance}`));
 const sessions=state.focusSessions.filter(s=>s.endsAt>Date.now());for(const session of sessions){const name=state.focusProfiles.find(p=>p.id===session.profileId)?.name||text.focus;focus.append(element('p',`${name} · ${Math.ceil((session.endsAt-Date.now())/60000)} ${text.minutes}${session.breakUntil&&session.breakUntil>Date.now()?` · ${text.breakActive}`:''}`),button(text.break,async()=>{await request('BREAK_FOCUS',{sessionId:session.id});await refresh();}),button(text.endFocus,async()=>{await request('END_FOCUS',{sessionId:session.id});await refresh();}));}
 if(!sessions.length&&state.focusProfiles.length){const select=element('select');select.setAttribute('aria-label',text.profileName);state.focusProfiles.forEach(p=>{const option=element('option',p.name);option.value=p.id;select.append(option);});focus.append(select,button(text.startFocus,async()=>{await request('START_FOCUS',{profileId:select.value,minutes:25});await refresh();},'primary'));}else if(!sessions.length)focus.append(element('p',text.profileRequired,'muted'));
 app.append(focus);const footer=element('footer',undefined,'row');footer.append(button(text.options,()=>chrome.runtime.openOptionsPage(),'link'));app.append(footer);
}
refresh().catch(showError);
