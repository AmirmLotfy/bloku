import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, type FocusProfile } from './model';
import { scheduleActive, effectiveFocus, activeFocusDomains, observedSeconds, addObservedActivity, startFocus, reconcileSessions, localDayKey } from './focus';
const profile:FocusProfile={id:'work',name:'Work',domains:['example.com'],enabled:true,schedules:[],dailyAllowanceMinutes:null};
test('weekly intervals are start-inclusive/end-exclusive with overnight carry',()=>{
  const schedule={days:[1],start:'22:00',end:'06:00'};
  assert.equal(scheduleActive(schedule,new Date(2026,10,2,22)),true);
  assert.equal(scheduleActive(schedule,new Date(2026,10,3,5,59)),true);
  assert.equal(scheduleActive(schedule,new Date(2026,10,3,6)),false);
  assert.equal(scheduleActive(schedule,new Date(2026,10,4,1)),false);
});
test('overlapping sessions combine domains independent of ad pause',()=>{
  let s=defaultState(0);s.preferences.adsEnabled=false;s.sitePolicies=[{domain:'example.com',adsPausedUntil:null}];
  s.focusProfiles=[profile,{...profile,id:'other',domains:['other.test']}];
  s=startFocus(startFocus(s,'work',25,1000,'a'),'other',50,1000,'b');
  assert.deepEqual(activeFocusDomains(s,2000),['example.com','other.test']);
  assert.deepEqual(activeFocusDomains(s,1000+25*60000),['other.test']);
});
test('break expires at absolute time and expired sessions reconcile after wake',()=>{
  let s=defaultState(0);s.focusProfiles=[profile];s=startFocus(s,'work',25,1000,'a');s.focusSessions[0].breakUntil=301000;
  assert.equal(effectiveFocus(s,300000).length,0);assert.equal(effectiveFocus(s,301000).length,1);
  assert.equal(reconcileSessions(s,2_000_000).focusSessions.length,0);
});
test('allowance combines subdomain usage but not lookalike domains',()=>{
  const s=defaultState();s.focusProfiles=[{...profile,dailyAllowanceMinutes:1}];
  const now=new Date(2026,10,2,13).getTime();s.activity=[{date:localDayKey(new Date(now)),domainSeconds:{'a.example.com':30,'example.com':30,'badexample.com':300},focusSeconds:0}];
  assert.equal(effectiveFocus(s,now)[0].reason,'allowance');
  s.activity[0].domainSeconds['example.com']=0;assert.equal(effectiveFocus(s,now).length,0);
});
test('activity never counts hidden windows, idle users, cross-host intervals or sleep',()=>{
  const a={at:1000,host:'example.com',focused:true,active:true};
  assert.equal(observedSeconds(a,{...a,at:31000}),30);
  for(const current of [{...a,at:31000,focused:false},{...a,at:31000,active:false},{...a,at:31000,host:'other.test'},{...a,at:100000}]) assert.equal(observedSeconds(a,current),0);
});
test('budget observations are limited to configured domains and prune old dates',()=>{
  const now=new Date(2026,10,2,13).getTime();let s=defaultState(now);s.focusProfiles=[profile];
  assert.deepEqual(addObservedActivity(s,'unrelated.test',30,now),s);
  s.activity=[{date:'2020-01-01',domainSeconds:{},focusSeconds:0}];
  s=addObservedActivity(s,'example.com',30,now);assert.equal(s.activity.length,1);assert.equal(s.activity[0].domainSeconds['example.com'],30);
});

test('history opt-out retains only today for daily allowances',()=>{
  const now=new Date(2026,10,2,13).getTime();const s=defaultState(now);s.focusProfiles=[profile];
  s.activity=[{date:'2026-11-01',domainSeconds:{'example.com':10},focusSeconds:0}];
  assert.equal(addObservedActivity(s,'example.com',30,now).activity.length,1);
  s.preferences.activityEnabled=true;assert.equal(addObservedActivity(s,'example.com',30,now).activity.length,2);
});

test('disabling history prunes old domains immediately without another usage sample',()=>{
 const now=new Date(2026,10,2,13).getTime();const s=defaultState(now);s.activity=[{date:'2026-11-01',domainSeconds:{'example.com':50},focusSeconds:0},{date:localDayKey(new Date(now)),domainSeconds:{'example.com':30},focusSeconds:0}];
 assert.deepEqual(reconcileSessions(s,now).activity.map(d=>d.date),['2026-11-02']);
});


test('schedules follow device timezone and repeated or skipped DST clock hours',()=>{
 const original=process.env.TZ;
 try{
  process.env.TZ='America/New_York';
  const sunday={days:[0],start:'01:00',end:'02:00'};
  assert.equal(scheduleActive(sunday,new Date('2026-11-01T05:30:00Z')),true);
  assert.equal(scheduleActive(sunday,new Date('2026-11-01T06:30:00Z')),true);
  assert.equal(scheduleActive(sunday,new Date('2026-11-01T07:00:00Z')),false);
  const spring={days:[0],start:'01:30',end:'03:30'};
  assert.equal(scheduleActive(spring,new Date('2026-03-08T06:45:00Z')),true);
  assert.equal(scheduleActive(spring,new Date('2026-03-08T07:15:00Z')),true);
  assert.equal(scheduleActive(spring,new Date('2026-03-08T07:30:00Z')),false);
  const work={days:[1],start:'09:00',end:'10:00'},instant=new Date('2026-11-02T07:30:00Z');
  process.env.TZ='Africa/Cairo';assert.equal(scheduleActive(work,instant),true);
  process.env.TZ='America/Los_Angeles';assert.equal(scheduleActive(work,instant),false);
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
