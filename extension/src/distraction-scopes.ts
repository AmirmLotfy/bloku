import { domainMatches, normalizeDomain, type StateV2 } from './model';

// Consumer presets must not spill into ad managers, creator studios or players.
const consumerHosts: Record<string, string[]> = {
  'youtube.com': ['youtube.com', 'm.youtube.com'],
  'x.com': ['x.com', 'mobile.x.com'],
  'twitter.com': ['twitter.com', 'mobile.twitter.com'],
  'facebook.com': ['facebook.com', 'm.facebook.com', 'web.facebook.com'],
  'reddit.com': ['reddit.com', 'old.reddit.com', 'new.reddit.com', 'sh.reddit.com', 'm.reddit.com'],
  'linkedin.com': ['linkedin.com'],
  'instagram.com': ['instagram.com'],
  'twitch.tv': ['twitch.tv', 'm.twitch.tv'],
  'tiktok.com': ['tiktok.com', 'm.tiktok.com'],
};

export function presetSiteFor(host: string): string | undefined {
  return Object.keys(consumerHosts).find(site => consumerHosts[site].includes(host));
}

/** Select consumer presets by document URL, keeping tools on shared hosts outside their scope. */
export function presetSiteForUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const host = normalizeDomain(url.href);
    const site = host ? presetSiteFor(host) : undefined;
    if (!site) return undefined;
    // Decode once; malformed escapes fail closed. Queries never determine route scope.
    const pathname = decodeURIComponent(url.pathname).replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
    if (site === 'youtube.com' && /^\/embed(?:\/|$)/.test(pathname)) return undefined;
    if (site === 'facebook.com' && /^\/(?:adsmanager|business|ads|commerce_manager|events_manager|professional_dashboard)(?:\/|$)/.test(pathname)) return undefined;
    if (site === 'linkedin.com' && (/^\/(?:campaignmanager|talent|sales|learning)(?:\/|$)/.test(pathname) || /^\/company\/[^/]+\/admin(?:\/|$)/.test(pathname))) return undefined;
    if ((site === 'x.com' || site === 'twitter.com') && /^\/(?:settings|i\/(?:ads|monetization|professional))(?:\/|$)/.test(pathname)) return undefined;
    return site;
  } catch { return undefined; }
}

export function supportsPageControls(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname !== 'chromewebstore.google.com' && !(url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'));
  } catch { return false; }
}

export function elementSelectors(state: StateV2, site: string, frame: string, isTop: boolean): string[] {
  if (isTop) return [...new Set(Object.entries(state.distractionRules).filter(([domain]) => domainMatches(site, domain)).flatMap(([, selectors]) => selectors))];
  return [...new Set((state.embeddedHides ?? []).filter(rule => rule.site === site && rule.frame === frame).flatMap(rule => rule.selectors))];
}

export function changeElementHide(state: StateV2, site: string, frame: string, isTop: boolean, selector: string, remove: boolean): StateV2 {
  const update = (previous: string[]) => remove ? previous.filter(value => value !== selector) : [...new Set([...previous, selector])];
  if (isTop) return { ...state, distractionRules: { ...state.distractionRules, [site]: update(state.distractionRules[site] ?? []) } };
  const previous = (state.embeddedHides ?? []).find(rule => rule.site === site && rule.frame === frame)?.selectors ?? [];
  const selectors = update(previous);
  return { ...state, embeddedHides: [...(state.embeddedHides ?? []).filter(rule => rule.site !== site || rule.frame !== frame), ...(selectors.length ? [{ site, frame, selectors }] : [])] };
}

export function restoreSiteHides(state: StateV2, site: string): StateV2 {
  const rules = { ...state.distractionRules };
  delete rules[site];
  return { ...state, distractionRules: rules, embeddedHides: (state.embeddedHides ?? []).filter(rule => rule.site !== site) };
}
