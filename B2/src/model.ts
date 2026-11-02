export const SCHEMA_VERSION = 2 as const;
export const LOCALES = ['en', 'ar', 'es', 'pt_BR', 'fr', 'de', 'ja', 'hi'] as const;
export type Locale = typeof LOCALES[number];
export type Theme = 'light' | 'dark' | 'system';
export type Presets = Record<string, string[]>;
export interface SitePolicy { domain: string; adsPausedUntil: number | null; }
export interface FocusSchedule { days: number[]; start: string; end: string; }
export interface FocusProfile { id: string; name: string; domains: string[]; enabled: boolean; schedules: FocusSchedule[]; dailyAllowanceMinutes: number | null; }
export interface FocusSession { id: string; profileId: string; startedAt: number; endsAt: number; breakUntil: number | null; }
export interface DayActivity { date: string; domainSeconds: Record<string, number>; focusSeconds: number; }
export interface StateV2 {
  schemaVersion: 2;
  preferences: { adsEnabled: boolean; theme: Theme; locale: Locale; listIds: string[]; rejectConsent: boolean; cleanUrls: boolean; gpc: boolean; activityEnabled: boolean; disableAutoplay: boolean; };
  sitePolicies: SitePolicy[];
  distractionPresets: Presets;
  distractionRules: Presets;
  userRulesText: string;
  focusProfiles: FocusProfile[];
  focusSessions: FocusSession[];
  activity: DayActivity[];
  legacyEstimates: { label: 'Legacy v1 estimates'; stats: Record<string, number>; dailyHistory: Record<string, unknown>; } | null;
  migration: { migratedAt: number; sourceVersion: 1 | 2; warnings: string[]; };
}
export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || /[\s\x00-\x1f]/.test(value.trim())) return null;
  try {
    const text = value.trim();
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
    if (!host || host.includes('*') || !/^[a-z0-9.-]+$/.test(host) || host.includes('..') || host.split('.').some(p => !p || p.startsWith('-') || p.endsWith('-'))) return null;
    return host;
  } catch { return null; }
}
export function domainMatches(host: string, domain: string): boolean { return host === domain || host.endsWith(`.${domain}`); }
export function domainsOverlap(a: string, b: string): boolean { return domainMatches(a, b) || domainMatches(b, a); }
export function uniqueDomains(values: unknown): string[] { return Array.isArray(values) ? [...new Set(values.map(normalizeDomain).filter((x): x is string => x !== null))].sort() : []; }
export function defaultState(now = Date.now()): StateV2 {
  return { schemaVersion: 2, preferences: { adsEnabled: true, theme: 'system', locale: 'en', listIds: ['base', 'privacy'], rejectConsent: false, cleanUrls: false, gpc: false, activityEnabled: false, disableAutoplay: false }, sitePolicies: [], distractionPresets: {}, distractionRules: {}, userRulesText: '', focusProfiles: [], focusSessions: [], activity: [], legacyEstimates: null, migration: { migratedAt: now, sourceVersion: 2, warnings: [] } };
}
