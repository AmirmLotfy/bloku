import AutoConsent from '@duckduckgo/autoconsent';
import {autoconsent} from '@duckduckgo/autoconsent/rules/rules.json';
/** Packaged DOM-only opt-out rules. No rule or browsing context is sent to a server. */
export async function startConsent():Promise<()=>void>{
 let active=true;let consent:AutoConsent;
 consent=new AutoConsent(async message=>{
  // The integration intentionally has no generic privileged eval bridge.
  if(message.type==='eval')queueMicrotask(()=>{void consent.receiveMessageCallback({type:'evalResp',id:message.id,result:false});});
 },{enabled:true,autoAction:'optOut',enablePrehide:false,enableCosmeticRules:false,enableGeneratedRules:false,enableHeuristicDetection:false,detectRetries:3,isMainWorld:false,logs:{detectionsteps:false,waits:false,lifecycle:false,rulesteps:false,evals:false,errors:false,messages:false}},{autoconsent});
 const original=consent.doOptOut.bind(consent);
 consent.doOptOut=()=>active?original():Promise.resolve(false);
 return ()=>{active=false;consent.config.autoAction=null;consent.config.enabled=false;consent.rules=[];consent.undoPrehide();};
}
