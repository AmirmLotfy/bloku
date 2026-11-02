import { defaultState, LOCALES, uniqueDomains, normalizeDomain, type StateV2, type Presets } from './model';
export const V2_STORAGE_KEY = 'blokuV2';
export const RETIRED_KEYS = ['licenseKey', 'expiresAt', 'plan', 'subscriptionId', 'polarSubscriptionId', 'licenseValidatedAt', 'userEmail', 'deviceId', 'premiumJustActivated', 'premiumDeactivatedReason'];
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function presets(value: unknown): Presets {
  const result: Presets = {};
  for (const [key, items] of Object.entries(record(value))) {
    const domain = normalizeDomain(key);
    if (domain && Array.isArray(items)) result[domain] = [...new Set(items.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length < 4096))];
  }
  return result;
}
function numericRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(record(value)).filter(([, n]) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) as Record<string, number>;
}
export function migrateLegacy(storage: Record<string, unknown>, now = Date.now()): StateV2 {
  const current = storage[V2_STORAGE_KEY];
  if (current && record(current).schemaVersion !== 2) throw new Error('Unknown settings version; existing data has been retained');
  if (current && record(current).schemaVersion === 2) {
    validateState(current);
    return structuredClone(current) as StateV2;
  }
  const state = defaultState(now);
  const settings = record(storage.settings);
  const layers = record(settings.layers);
  const hasLegacy = Object.keys(settings).length > 0 || storage.distractionRules !== undefined || storage.stats !== undefined;
  state.migration.sourceVersion = hasLegacy ? 1 : 2;
  state.preferences.adsEnabled = settings.blockingEnabled !== false && layers.network !== false;
  if (['light', 'dark', 'system'].includes(settings.theme as string)) state.preferences.theme = settings.theme as StateV2['preferences']['theme'];
  state.sitePolicies = uniqueDomains(settings.whitelistedDomains).map(domain => ({domain, adsPausedUntil: null}));
  state.distractionPresets = presets(storage.distractionPresets);
  state.distractionRules = presets(storage.distractionRules);
  if (storage.stats || storage.dailyHistory) state.legacyEstimates = {label: 'Legacy v1 estimates', stats: numericRecord(storage.stats), dailyHistory: structuredClone(record(storage.dailyHistory))};
  if (hasLegacy) state.migration.warnings.push('Privacy extras are opt-in in version 2. Legacy statistics are estimates. Saved rules and site preferences have been preserved.');
  validateState(state);
  return state;
}
export function validateState(value: unknown): asserts value is StateV2 {
  const state = record(value);
  const pref = record(state.preferences);
  if (state.schemaVersion !== 2 || !LOCALES.includes(pref.locale as never) || !['light', 'dark', 'system'].includes(pref.theme as string)) throw new Error('Unsupported settings format');
  for (const key of ['adsEnabled','rejectConsent','cleanUrls','gpc','activityEnabled','disableAutoplay']) if (typeof pref[key] !== 'boolean') throw new Error(`Invalid preference: ${key}`);
  if (!Array.isArray(pref.listIds) || pref.listIds.some(n => typeof n !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(n))) throw new Error('Invalid filter selection');
  if (typeof state.userRulesText !== 'string' || state.userRulesText.length > 1_000_000) throw new Error('Invalid or oversized filter text');
  if (!Array.isArray(state.sitePolicies) || !Array.isArray(state.focusProfiles) || !Array.isArray(state.focusSessions) || !Array.isArray(state.activity)) throw new Error('Invalid settings collections');
  for (const policy of state.sitePolicies) {
    const p = record(policy);
    if (typeof p.domain!=='string' || normalizeDomain(p.domain)!==p.domain || (p.adsPausedUntil !== null && (typeof p.adsPausedUntil !== 'number' || !Number.isFinite(p.adsPausedUntil)))) throw new Error('Invalid site policy');
  }
  for (const profile of state.focusProfiles) {
    const p = record(profile);
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.enabled !== 'boolean' || !Array.isArray(p.domains) || uniqueDomains(p.domains).length !== p.domains.length || p.domains.some(domain=>typeof domain!=='string'||normalizeDomain(domain)!==domain) || !Array.isArray(p.schedules)) throw new Error('Invalid focus profile');
    if (p.dailyAllowanceMinutes !== null && (typeof p.dailyAllowanceMinutes !== 'number' || !Number.isFinite(p.dailyAllowanceMinutes) || p.dailyAllowanceMinutes < 1)) throw new Error('Invalid daily allowance');
    for (const schedule of p.schedules) {
      const s = record(schedule);
      if (!Array.isArray(s.days) || s.days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || typeof s.start !== 'string' || typeof s.end !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)) throw new Error('Invalid focus schedule');
    }
  }
  const profiles=state.focusProfiles as Array<Record<string,unknown>>;
  const ids=profiles.map(p=>p.id);
  if(new Set(ids).size!==ids.length || profiles.some(p=>typeof p.id!=='string'||p.id.length<1||p.id.length>100||typeof p.name!=='string'||p.name.length>120))throw new Error('Invalid or duplicate focus profile');
  for (const session of state.focusSessions) {
    const s = record(session);
    if (typeof s.id !== 'string' || !s.id || typeof s.profileId !== 'string' || !ids.includes(s.profileId) || ![s.startedAt,s.endsAt].every(n => typeof n === 'number' && Number.isFinite(n)) || (s.endsAt as number) <= (s.startedAt as number) || (s.breakUntil !== null && (typeof s.breakUntil !== 'number' || !Number.isFinite(s.breakUntil)))) throw new Error('Invalid focus session');
  }
  const sessionIds=(state.focusSessions as Array<Record<string,unknown>>).map(s=>s.id);
  if(new Set(sessionIds).size!==sessionIds.length)throw new Error('Duplicate focus session');
  const dates=new Set<string>();
  for(const item of state.activity){
    const day=record(item);
    if(typeof day.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day.date)||!Number.isFinite(Date.parse(day.date+'T12:00:00Z'))||new Date(day.date+'T12:00:00Z').toISOString().slice(0,10)!==day.date||dates.has(day.date))throw new Error('Invalid activity date');
    dates.add(day.date);
    if(!day.domainSeconds||typeof day.domainSeconds!=='object'||Array.isArray(day.domainSeconds)||typeof day.focusSeconds!=='number'||!Number.isFinite(day.focusSeconds)||day.focusSeconds<0||day.focusSeconds>90000)throw new Error('Invalid activity summary');
    for(const [domain,seconds] of Object.entries(day.domainSeconds))if(normalizeDomain(domain)!==domain||typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>90000)throw new Error('Invalid activity counter');
  }
  const migration=record(state.migration);
  if(typeof migration.migratedAt!=='number'||!Number.isFinite(migration.migratedAt)||![1,2].includes(migration.sourceVersion as number)||!Array.isArray(migration.warnings)||migration.warnings.some(v=>typeof v!=='string'))throw new Error('Invalid migration metadata');
  if(state.legacyEstimates!==null){
    const legacy=record(state.legacyEstimates);
    if(legacy.label!=='Legacy v1 estimates'||!legacy.stats||typeof legacy.stats!=='object'||Array.isArray(legacy.stats)||!legacy.dailyHistory||typeof legacy.dailyHistory!=='object'||Array.isArray(legacy.dailyHistory)||Object.values(legacy.stats).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw new Error('Invalid legacy estimates');
  }
  for (const key of ['distractionPresets','distractionRules']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) throw new Error('Invalid distraction rules');
    for (const [domain, items] of Object.entries(state[key] as object)) if (normalizeDomain(domain)!==domain || !Array.isArray(items) || items.some(s => typeof s !== 'string' || s.length > 4096)) throw new Error('Invalid distraction rule');
    if(key==='distractionRules')for(const items of Object.values(state[key] as Record<string,string[]>))if(items.some(s=>!s.trim()||/[{}\x00-\x1f]|\/\*|url\s*\(/i.test(s)))throw new Error('Element hides must be CSS selectors, without style declarations or URLs');
  }
}
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
}
export interface LocalStorage { get(keys: null | string | string[]): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void>; remove(keys: string[]): Promise<void>; }
export async function migrateStorage(storage: LocalStorage, now = Date.now()): Promise<StateV2> {
  const state = migrateLegacy(await storage.get(null), now);
  await storage.set({ [V2_STORAGE_KEY]: state });
  const written = (await storage.get(V2_STORAGE_KEY))[V2_STORAGE_KEY];
  validateState(written);
  if (canonicalJson(written) !== canonicalJson(state)) throw new Error('Settings verification failed; legacy data has been retained');
  await storage.remove(RETIRED_KEYS);
  return state;
}
export function exportSettings(state: StateV2): string {
  validateState(state);
  // A settings backup never revives an old timed session on another installation.
  return JSON.stringify({ format: 'bloku-settings', version: 2, state: {...state,focusSessions:[]} }, null, 2);
}
export function importSettings(text: string): StateV2 {
  if (text.length > 2_000_000) throw new Error('Settings file is too large');
  const data = JSON.parse(text);
  if (data.format !== 'bloku-settings' || data.version !== 2) throw new Error('Unsupported settings file');
  validateState(data.state);
  return structuredClone(data.state);
}
