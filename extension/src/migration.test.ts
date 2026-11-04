import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacy, migrateStorage, exportSettings, importSettings, RETIRED_KEYS, V2_STORAGE_KEY } from './migration';
import { defaultState, normalizeDomain } from './model';
test('fresh installation is free, with optional features opt-in', () => {
  const state = migrateLegacy({}, 1000);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.preferences.adsEnabled, true);
  assert.equal(state.preferences.rejectConsent, false);
  assert.equal(state.preferences.activityEnabled, false);
});
test('legacy choices, saved hides and all user exceptions survive expired subscriptions', () => {
  const input = { settings: { blockingEnabled: false, theme: 'dark', whitelistedDomains: ['https://www.Example.com/path','news.example.com','not valid'] }, licenseKey: 'expired', expiresAt: '2020-01-01', distractionRules: {'example.com':['.ad-slot','#promo']}, distractionPresets: {'youtube.com':['shorts','comments']}, stats: {adsBlocked: 200, dataSaved: 10000} };
  const state = migrateLegacy(input, 1000);
  assert.equal(state.preferences.adsEnabled, false);
  assert.equal(state.preferences.theme, 'dark');
  assert.deepEqual(state.sitePolicies.map(p => p.domain), ['example.com','news.example.com']);
  assert.deepEqual(state.distractionRules['example.com'], ['.ad-slot','#promo']);
  assert.deepEqual(state.distractionPresets['youtube.com'], ['shorts','comments']);
  assert.equal(state.legacyEstimates?.label, 'Legacy v1 estimates');
  assert.equal(JSON.stringify(state).includes('expired'), false);
});
test('migrations are idempotent and do not mutate legacy inputs', () => {
  const storage = {settings:{whitelistedDomains:['example.com']}};
  const before = structuredClone(storage);
  const state = migrateLegacy(storage, 100);
  assert.deepEqual(migrateLegacy({[V2_STORAGE_KEY]:state}, 500), state);
  assert.deepEqual(storage, before);
});
test('malformed v2 data blocks cleanup instead of losing user choices', () => {
  assert.throws(() => migrateLegacy({[V2_STORAGE_KEY]:{schemaVersion:2}}));
});
test('identities are removed only after verified settings write', async () => {
  const data:Record<string,unknown> = {settings:{theme:'light'},licenseKey:'secret',deviceId:'private'};
  const removed:string[] = [];
  const storage = {async get(keys:any) { return keys === null ? structuredClone(data) : {[V2_STORAGE_KEY]:data[V2_STORAGE_KEY]}; }, async set(items:any){Object.assign(data,items);}, async remove(keys:string[]){removed.push(...keys);keys.forEach(k=>delete data[k]);}};
  const state = await migrateStorage(storage, 10);
  assert.equal(state.preferences.theme,'light');
  assert.deepEqual(removed,RETIRED_KEYS);
  assert.equal(data.licenseKey,undefined);
  assert.ok(data.settings);
});
test('failed persistence preserves all payment identifiers and original preferences', async () => {
  let cleaned = false;
  const storage = {async get(){return {licenseKey:'keep', settings:{theme:'dark'}};},async set(){},async remove(){cleaned=true;}};
  await assert.rejects(migrateStorage(storage));
  assert.equal(cleaned,false);
});
test('settings roundtrip is versioned; invalid imports cannot activate', () => {
  const state = defaultState(100);
  assert.deepEqual(importSettings(exportSettings(state)),state);
  assert.throws(()=>importSettings('{"format":"other","version":2}'));
  const bad = structuredClone(state);
  bad.sitePolicies=[{domain:'javascript:alert(1)',adsPausedUntil:null}];
  assert.throws(()=>importSettings(JSON.stringify({format:'bloku-settings',version:2,state:bad})));
});
test('normalization handles IDNs and boundary checks without accepting credentials', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path'),'example.com');
  assert.equal(normalizeDomain('https://user:pass@example.com'),null);
  assert.equal(normalizeDomain('*.example.com'),null);
  assert.equal(normalizeDomain('evil example.com'),null);
  assert.ok(normalizeDomain('مثال.مصر')?.startsWith('xn--'));
});

test('a future schema cannot be overwritten by a downgrade', () => {
  assert.throws(() => migrateLegacy({[V2_STORAGE_KEY]:{schemaVersion:3,preciousData:true}}), /Unknown settings version/);
});

test('invalid activity maps and dates are rejected before import can persist them',()=>{
 const state=defaultState(100);
 for(const day of [{date:'2026-11-02',domainSeconds:null,focusSeconds:0},{date:'2026-02-30',domainSeconds:{},focusSeconds:0},{date:'2026-11-02',domainSeconds:{'example.com':-1},focusSeconds:0}]){
  state.activity=[day as never];assert.throws(()=>importSettings(JSON.stringify({format:'bloku-settings',version:2,state})));
 }
});

test('Chrome object-key reordering does not cause a false persistence failure',async()=>{
 const data:Record<string,unknown>={settings:{theme:'dark'}};
 const reorder=(value:any):any=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,reorder(v)])):value;
 const storage={async get(){return reorder(data);},async set(items:Record<string,unknown>){Object.assign(data,reorder(items));},async remove(keys:string[]){keys.forEach(k=>delete data[k]);}};
 assert.equal((await migrateStorage(storage,100)).preferences.theme,'dark');
});


test('free, active Premium and expired Premium migrate to the same free feature contract',()=>{
 const settings={blockingEnabled:false,theme:'dark',whitelistedDomains:['example.com']};
 for(const entitlement of [{},{licenseKey:'valid-format-test-only',plan:'premium',expiresAt:'2030-01-01',deviceId:'test-device'},{licenseKey:'expired-test-only',plan:'annual',expiresAt:'2020-01-01'}]){
  const migrated=migrateLegacy({settings,...entitlement,distractionPresets:{'youtube.com':['shorts']}},100);
  assert.equal(migrated.preferences.adsEnabled,false);assert.equal(migrated.preferences.theme,'dark');
  assert.deepEqual(migrated.distractionPresets['youtube.com'],['shorts']);
  assert.equal(migrated.preferences.rejectConsent,false);assert.equal(migrated.preferences.gpc,false);
  assert.equal(JSON.stringify(migrated).includes('test-only'),false);
 }
});

test('settings export never restarts a timed session and leaves running state untouched',()=>{
 const state=defaultState(100);state.focusProfiles=[{id:'work',name:'Work',domains:['example.com'],enabled:false,schedules:[],dailyAllowanceMinutes:null}];
 state.focusSessions=[{id:'live',profileId:'work',startedAt:100,endsAt:100000,breakUntil:null}];
 const imported=importSettings(exportSettings(state));assert.deepEqual(imported.focusSessions,[]);
 assert.equal(state.focusSessions[0].id,'live');assert.deepEqual(imported.focusProfiles,state.focusProfiles);
});

test('hostile element-hide imports cannot inject style declarations or network resources',()=>{
 for(const selector of ['.ad}body{background:url(https://example.test/leak)}','@import url(https://example.test/style);','/* comment */ .ad','']){
  const state=defaultState(100);state.distractionRules={'example.com':[selector]};
  assert.throws(()=>importSettings(JSON.stringify({format:'bloku-settings',version:2,state})),/CSS selectors/);
 }
 const state=defaultState(100);state.distractionRules={'example.com':['article:has(> .ad), [data-sponsored]']};
 assert.deepEqual(importSettings(exportSettings(state)).distractionRules,state.distractionRules);
});


test('v2 imports require canonical site domains before dormant rules can be activated',()=>{
 const cases=[
  (state:ReturnType<typeof defaultState>)=>{state.sitePolicies=[{domain:'https://example.com/path',adsPausedUntil:null}];},
  (state:ReturnType<typeof defaultState>)=>{state.focusProfiles=[{id:'dormant',name:'Dormant',domains:['https://example.com'],enabled:false,schedules:[],dailyAllowanceMinutes:null}];},
  (state:ReturnType<typeof defaultState>)=>{state.distractionRules={'www.Example.com':['.ad']};},
 ];
 for(const mutate of cases){const state=defaultState(100);mutate(state);assert.throws(()=>importSettings(JSON.stringify({format:'bloku-settings',version:2,state})),/Invalid/);}
});
