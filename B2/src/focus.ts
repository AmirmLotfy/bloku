import { domainMatches, type StateV2, type FocusSchedule, type DayActivity } from './model';
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function minute(text: string): number { const [h,m]=text.split(':').map(Number);return h*60+m; }
/** Calendar-local time deliberately follows the operating system timezone, including DST. */
export function scheduleActive(schedule: FocusSchedule, date: Date): boolean {
  const day=date.getDay(), time=date.getHours()*60+date.getMinutes(), start=minute(schedule.start), end=minute(schedule.end);
  if (start===end) return schedule.days.includes(day);
  if (start<end) return schedule.days.includes(day) && time>=start && time<end;
  return (schedule.days.includes(day) && time>=start) || (schedule.days.includes((day+6)%7) && time<end);
}
export interface FocusReason {profileId:string; name:string; domains:string[]; reason:'session'|'schedule'|'allowance'; endsAt:number|null;}
export function effectiveFocus(state: StateV2, now=Date.now()): FocusReason[] {
  const date=new Date(now), today=state.activity.find(d=>d.date===localDayKey(date));
  const result:FocusReason[]=[];
  for (const profile of state.focusProfiles) {
    const sessions=state.focusSessions.filter(s=>s.profileId===profile.id && s.startedAt<=now && s.endsAt>now && (!s.breakUntil || s.breakUntil<=now));
    if (sessions.length) result.push({profileId:profile.id,name:profile.name,domains:profile.domains,reason:'session',endsAt:Math.max(...sessions.map(s=>s.endsAt))});
    if (!profile.enabled) continue;
    if (profile.schedules.some(s=>scheduleActive(s,date))) result.push({profileId:profile.id,name:profile.name,domains:profile.domains,reason:'schedule',endsAt:null});
    const used=Object.entries(today?.domainSeconds??{}).filter(([host])=>profile.domains.some(d=>domainMatches(host,d))).reduce((sum,[,seconds])=>sum+seconds,0);
    if (profile.dailyAllowanceMinutes!==null && used>=profile.dailyAllowanceMinutes*60) result.push({profileId:profile.id,name:profile.name,domains:profile.domains,reason:'allowance',endsAt:null});
  }
  return result;
}
export function activeFocusDomains(state:StateV2,now=Date.now()):string[] { return [...new Set(effectiveFocus(state,now).flatMap(r=>r.domains))].sort(); }
export function reconcileSessions(state:StateV2,now=Date.now()):StateV2 {
  return {...state,focusSessions:state.focusSessions.filter(s=>s.endsAt>now),activity:state.activity.filter(d=>{
    if(!state.preferences.activityEnabled)return d.date===localDayKey(new Date(now));
    const then=new Date(`${d.date}T12:00:00`);const age=(now-then.getTime())/86400000;
    return Number.isFinite(age)&&age<90&&age>=-1;
  })};
}
export interface ActivityObservation { at:number; host:string|null; focused:boolean; active:boolean; }
/** Count observed foreground intervals only; long gaps (sleep/suspension) contribute zero. */
export function observedSeconds(previous:ActivityObservation|null,current:ActivityObservation):number {
  if (!previous || !current.host || current.host!==previous.host || !previous.focused || !current.focused || !previous.active || !current.active) return 0;
  const elapsed=(current.at-previous.at)/1000;
  return elapsed>0&&elapsed<=45?elapsed:0;
}
export function addObservedActivity(state:StateV2,host:string,seconds:number,now=Date.now()):StateV2 {
  if (!Number.isFinite(seconds)||seconds<=0||seconds>45) return state;
  // Budget accounting is local and limited to domains explicitly configured by the user.
  if (!state.focusProfiles.some(p=>p.domains.some(d=>domainMatches(host,d)))) return state;
  const date=localDayKey(new Date(now));
  const activity=structuredClone(state.activity);
  let today=activity.find(d=>d.date===date);
  if (!today) {today={date,domainSeconds:{},focusSeconds:0};activity.push(today);}
  today.domainSeconds[host]=(today.domainSeconds[host]??0)+seconds;
  return reconcileSessions({...state,activity:state.preferences.activityEnabled?activity:activity.filter(d=>d.date===date)},now);
}
export function startFocus(state:StateV2,profileId:string,minutes=25,now=Date.now(),id:string=crypto.randomUUID()):StateV2 {
  if (!state.focusProfiles.some(p=>p.id===profileId&&p.domains.length>0)) throw new Error('Choose a focus profile');
  if (!Number.isFinite(minutes)||minutes<1||minutes>1440) throw new Error('Session duration must be between 1 and 1440 minutes');
  return {...state,focusSessions:[...state.focusSessions,{id,profileId,startedAt:now,endsAt:now+minutes*60000,breakUntil:null}]};
}
