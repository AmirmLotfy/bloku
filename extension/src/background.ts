import { createBlokuEngine, PACKAGED_LISTS, ENGINE_BUILD_INFO, type EngineInput, type EngineStatus } from '../engine/adapter';
import { createRepository } from './repository';
import { validateState, V2_STORAGE_KEY } from './migration';
import { LOCALES, domainMatches, normalizeDomain, type StateV2 } from './model';
import { activeFocusDomains, addObservedActivity, observedSeconds, reconcileSessions, startFocus, type ActivityObservation } from './focus';
import { lifecycleUrl, openWelcomeOnce } from './lifecycle';
import { presetSiteForUrl, elementSelectors, changeElementHide, restoreSiteHides } from './distraction-scopes';
import presetDefinitions from '../data/presets.json';
import { editableSettingsKey } from './settings-key';

const repository = createRepository(chrome.storage.local);
const engine = createBlokuEngine({ documentBlockingPageUrl: chrome.runtime.getURL('blocked.html') });
const trustedPages = new Set(['popup.html', 'options.html', 'blocked.html']);
const navigationStarts = new Map<number, number>();
let lastObservation: ActivityObservation | null = null;
let queue: Promise<unknown> = Promise.resolve();
let engineInputKey = '';
// SDK configuration replaces document-bound DNR allowances. Existing paused
// documents need a new committed navigation before their full pause is effective.
const pauseReloadTabs = new Map<number, number>();

async function markPausedDocumentsForReload(state: StateV2): Promise<void> {
  const tabs = await chrome.tabs.query({});
  pauseReloadTabs.clear();
  if (state.preferences.adsEnabled) for (const tab of tabs) {
    const host = normalizeDomain(tab.url);
    if (tab.id !== undefined && host && state.sitePolicies.some(policy => domainMatches(host, policy.domain) && (policy.adsPausedUntil === null || policy.adsPausedUntil > Date.now()))) pauseReloadTabs.set(tab.id, Date.now());
  }
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

function inputFor(state: StateV2, now = Date.now()): EngineInput {
  return {
    adsEnabled: state.preferences.adsEnabled,
    siteExceptions: state.sitePolicies.filter(policy => policy.adsPausedUntil === null || policy.adsPausedUntil > now).map(policy => policy.domain),
    focusDomains: activeFocusDomains(state, now),
    userRules: state.userRulesText,
    enabledLists: state.preferences.listIds,
  };
}

async function applyEngine(state: StateV2, force = false): Promise<EngineStatus> {
  const input = inputFor(state);
  const key = JSON.stringify(input);
  if (!force && key === engineInputKey && engine.getStatus().ok) return engine.getStatus();
  const result = await engine.apply(input);
  // Failed applications can also reconfigure the SDK while restoring rules.
  // Conservatively require reload for paused documents in either outcome.
  await markPausedDocumentsForReload(result.ok ? state : await repository.get());
  if (result.ok) engineInputKey = key;
  return result;
}

async function refreshAlarms(state: StateV2): Promise<void> {
  const now = Date.now();
  const deadlines = [
    ...state.focusSessions.flatMap(session => [session.endsAt, session.breakUntil ?? 0]),
    ...state.sitePolicies.map(policy => policy.adsPausedUntil ?? 0),
  ].filter(value => value > now);
  const needsClock = state.focusProfiles.some(profile => profile.enabled && (profile.schedules.length > 0 || profile.dailyAllowanceMinutes !== null)) || state.focusSessions.length > 0 || deadlines.length > 0 || state.preferences.activityEnabled;
  if (needsClock) await chrome.alarms.create('bloku:reconcile', { periodInMinutes: 0.5 });
  else await chrome.alarms.clear('bloku:reconcile');
  if (deadlines.length) await chrome.alarms.create('bloku:deadline', { when: Math.min(...deadlines) });
  else await chrome.alarms.clear('bloku:deadline');
}

async function notifyPages(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(tab => tab.id !== undefined && /^https?:/.test(tab.url ?? '')).map(tab => chrome.tabs.sendMessage(tab.id!, { action: 'BLOKU_REFRESH_CONFIG' })));
}

async function enforceOpenFocusTabs(state: StateV2): Promise<void> {
  const domains = activeFocusDomains(state);
  if (!domains.length) return;
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(tab => tab.id !== undefined && /^https?:/.test(tab.url ?? '') && domains.some(domain => {
    const host = normalizeDomain(tab.url); return host !== null && domainMatches(host, domain);
  })).map(tab => {
    const blocked = new URL(chrome.runtime.getURL('blocked.html'));
    blocked.searchParams.set('url', tab.url!);
    return chrome.tabs.update(tab.id!, { url: blocked.href });
  }));
}

async function updateState(change: (previous: StateV2) => StateV2 | Promise<StateV2>): Promise<StateV2> {
  const previous = await repository.get();
  const next = reconcileSessions(await change(structuredClone(previous)));
  validateState(next);
  const result = await applyEngine(next);
  if (!result.ok) throw new Error(result.errors[0]?.message ?? 'Filtering could not be confirmed.');
  let saved: StateV2;
  try {
    await refreshAlarms(next);
    saved = await repository.update(() => next);
  } catch (error) {
    await applyEngine(previous, true);
    await refreshAlarms(previous).catch(() => undefined);
    throw new Error(`Settings could not be saved. ${error instanceof Error ? error.message : ''}`);
  }
  // Notification failures do not undo an already committed configuration.
  await notifyPages().catch(() => undefined);
  await enforceOpenFocusTabs(saved);
  if (saved.preferences.locale !== previous.preferences.locale) await chrome.runtime.setUninstallURL(lifecycleUrl(saved.preferences.locale, 'bye')).catch(() => undefined);
  return saved;
}

async function observeActivity(state: StateV2): Promise<StateV2> {
  const needsUsage = state.preferences.activityEnabled || state.focusProfiles.some(profile => profile.enabled && profile.dailyAllowanceMinutes !== null);
  if (!needsUsage) { lastObservation = null; await chrome.storage.session.remove('blokuActivityObservation'); return state; }
  const [window, idle] = await Promise.all([chrome.windows.getLastFocused(), chrome.idle.queryState(60)]);
  const [tab] = window.id !== undefined ? await chrome.tabs.query({ active: true, windowId: window.id }) : [];
  const domain = normalizeDomain(tab?.url);
  const host = domain && state.focusProfiles.some(profile => (state.preferences.activityEnabled || (profile.enabled && profile.dailyAllowanceMinutes !== null)) && profile.domains.some(value => domainMatches(domain, value))) ? domain : null;
  const observation = { at: Date.now(), host, focused: Boolean(window.focused), active: idle === 'active' };
  const seconds = observedSeconds(lastObservation, observation);
  lastObservation = observation;
  await chrome.storage.session.set({ blokuActivityObservation: observation });
  return host && seconds > 0 ? addObservedActivity(state, host, seconds, observation.at) : state;
}

async function reconcile(): Promise<void> {
  await ready;
  const previous = await repository.get();
  const next = reconcileSessions(await observeActivity(previous));
  if (JSON.stringify(next) !== JSON.stringify(previous)) await updateState(() => next);
  else { const result = await applyEngine(next); await refreshAlarms(next); if (result.ok) await enforceOpenFocusTabs(next); }
}

const ready = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const before = await chrome.storage.local.get([V2_STORAGE_KEY, 'settings']);
  let state = await repository.get();
  const reconciledAtStartup = reconcileSessions(state);
  if(JSON.stringify(reconciledAtStartup)!==JSON.stringify(state)) state=await repository.update(()=>reconciledAtStartup);
  if (!before[V2_STORAGE_KEY] && !before.settings) {
    const language = chrome.i18n.getUILanguage().replace('-', '_');
    const locale = LOCALES.find(value => value === language) ?? LOCALES.find(value => value === language.split('_')[0]);
    if (locale && locale !== state.preferences.locale) state = await repository.update(value => ({ ...value, preferences: { ...value.preferences, locale } }));
  }
  const savedStarts = (await chrome.storage.session.get('blokuNavigationStarts')).blokuNavigationStarts;
  if (savedStarts && typeof savedStarts === 'object') for (const [id, value] of Object.entries(savedStarts)) if (Number.isSafeInteger(Number(id)) && typeof value === 'number') navigationStarts.set(Number(id), value);
  const observed = (await chrome.storage.session.get('blokuActivityObservation')).blokuActivityObservation;
  if (observed && typeof observed === 'object') {
    const value = observed as Partial<ActivityObservation>;
    if (typeof value.at === 'number' && Number.isFinite(value.at) && (value.host === null || normalizeDomain(value.host) === value.host) && typeof value.focused === 'boolean' && typeof value.active === 'boolean') lastObservation = value as ActivityObservation;
  }
  const result = await engine.initialize(inputFor(state));
  await markPausedDocumentsForReload(state);
  if (result.ok) engineInputKey = JSON.stringify(inputFor(state));
  await refreshAlarms(state);
  if (result.ok) await enforceOpenFocusTabs(state);
  await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'bloku-hide-element', title: chrome.i18n.getMessage('hideElement') || 'Hide an element with BLOKU', contexts: ['page', 'selection', 'image', 'link', 'video'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  chrome.contextMenus.create({ id: 'bloku-restore-elements', title: chrome.i18n.getMessage('restoreElements') || 'Restore this site’s saved element hides', contexts: ['page', 'selection', 'image', 'link', 'video'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  await chrome.runtime.setUninstallURL(lifecycleUrl(state.preferences.locale, 'bye')).catch(() => undefined);
})();
// Retain the error for UI recovery rather than an unhandled worker rejection.
void ready.catch(() => undefined);

function isTrustedPage(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || !sender.url) return false;
  try { const url = new URL(sender.url); return url.protocol === 'chrome-extension:' && url.hostname === chrome.runtime.id && trustedPages.has(url.pathname.slice(1)); } catch { return false; }
}

function contentHost(sender: chrome.runtime.MessageSender): string | null {
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || !sender.url || !/^https?:/.test(sender.url)) return null;
  return normalizeDomain(sender.url);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request payload.');
  return value as Record<string, unknown>;
}

async function pageConfig(sender: chrome.runtime.MessageSender) {
  const host = contentHost(sender);
  if (!host) throw new Error('This request must come from a normal website.');
  const state = await repository.get();
  const site = sender.frameId === 0 ? host : normalizeDomain(sender.tab?.url);
  if (!site) throw new Error('Open a normal website before using page controls.');
  const isTop = sender.frameId === 0;
  const presetSite = isTop ? presetSiteForUrl(sender.url) : undefined;
  const { rejectConsent, cleanUrls, gpc, disableAutoplay, adsEnabled } = state.preferences;
  await chrome.scripting.executeScript({
    target: sender.documentId ? { tabId: sender.tab!.id!, documentIds: [sender.documentId] } : { tabId: sender.tab!.id!, frameIds: [sender.frameId ?? 0] },
    world: 'MAIN',
    func: (enabled: boolean) => {
      const page = globalThis as unknown as Record<symbol, { original?: PropertyDescriptor; getter: () => boolean }>;
      const key = Symbol.for('bloku.gpc.v2');
      const saved = page[key];
      try {
        if (enabled && !saved && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true) {
          const getter = () => true;
          page[key] = { original: Object.getOwnPropertyDescriptor(navigator, 'globalPrivacyControl'), getter };
          Object.defineProperty(navigator, 'globalPrivacyControl', { get: getter, configurable: true });
        } else if (!enabled && saved) {
          if (Object.getOwnPropertyDescriptor(navigator, 'globalPrivacyControl')?.get === saved.getter) {
            if (saved.original) Object.defineProperty(navigator, 'globalPrivacyControl', saved.original);
            else delete (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
          }
          delete page[key];
        }
      } catch { /* A native nonconfigurable preference always wins. */ }
    },
    args: [gpc],
  }).catch(() => undefined);
  return { ok: true, host, site, preferences: { rejectConsent, cleanUrls, gpc, disableAutoplay: disableAutoplay && isTop && presetSite === 'youtube.com' }, presets: presetSite ? state.distractionPresets[presetSite] ?? [] : [], selectors: elementSelectors(state, site, host, isTop), locale: state.preferences.locale, adsEnabled };
}

async function activeTab() { const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return tab; }

async function handle(action: string, payload: unknown, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (isTrustedPage(sender) && action === 'EXPORT_RECOVERY') {
    const data = await chrome.storage.local.get([V2_STORAGE_KEY, 'settings', 'distractionRules', 'distractionPresets', 'stats', 'dailyHistory']);
    return { ok: true, recovery: JSON.stringify({ format: 'bloku-recovery', version: 2, data }, null, 2) };
  }
  try { await ready; } catch (error) {
    if (isTrustedPage(sender) && action === 'GET_STATE') {
      let state: StateV2 | null = null;
      try { state = await repository.get(); } catch { /* Invalid data remains intact for recovery export. */ }
      return { ok: true, state, engine: engine.getStatus(), recoveryAvailable: true, error: error instanceof Error ? error.message : 'Settings need recovery.' };
    }
    throw new Error('BLOKU could not initialize. Open settings to export recovery data.');
  }
  if (action === 'GET_PAGE_CONFIG') return pageConfig(sender);
  if (action === 'SAVE_PICKER_RULE' || action === 'REMOVE_PICKER_RULE') {
    const host = contentHost(sender);
    const data = record(payload);
    const site = sender.frameId === 0 ? host : normalizeDomain(sender.tab?.url);
    if (!host || !site || !Number.isSafeInteger(sender.frameId) || sender.frameId! < 0 || data.domain !== host || typeof data.selector !== 'string' || !data.selector.trim() || data.selector.length > 4096 || /[{}\x00-\x1f]|\/\*|url\s*\(/i.test(data.selector)) throw new Error('Invalid element-hiding request.');
    if (action === 'SAVE_PICKER_RULE') {
      const validation = await chrome.scripting.executeScript({ target: { tabId: sender.tab!.id!, frameIds: [sender.frameId!] }, func: (selector: string) => { try { document.querySelector(selector); return true; } catch { return false; } }, args: [data.selector] });
      if (!validation[0]?.result) throw new Error('Invalid CSS selector.');
    }
    const selector = data.selector;
    await updateState(state => changeElementHide(state, site, host, sender.frameId === 0, selector, action === 'REMOVE_PICKER_RULE'));
    return pageConfig(sender);
  }
  if (!isTrustedPage(sender)) throw new Error('This action is only available from BLOKU settings.');
  if (action === 'GET_STATE') return { ok: true, state: await repository.get(), engine: engine.getStatus(), buildInfo: ENGINE_BUILD_INFO, lists: PACKAGED_LISTS.map(({ id, name, ruleCount, version, updatedAt }) => ({ id, name, ruleCount, version, updatedAt })) };
  if (action === 'GET_TAB') { const tab = await activeTab(); return { ok: true, tab, pauseReloadRequired: tab?.id !== undefined && pauseReloadTabs.has(tab.id) }; }
  if (action === 'GET_MATCHES') {
    const data = record(payload);
    const tab = await activeTab();
    if (!tab?.id || data.tabId !== tab.id) throw new Error('Inspect the currently active website.');
    const since = navigationStarts.get(tab.id);
    if (!since) throw new Error('Reload this page before inspecting its current-page count.');
    const matches = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id, minTimeStamp: since });
    return { ok: true, matches: matches.rulesMatchedInfo.length };
  }
  if (action === 'PICK_ELEMENT') {
    const data = record(payload);
    const tab = await activeTab();
    if (!tab?.id || data.tabId !== tab.id || !normalizeDomain(tab.url)) throw new Error('Open a normal website to hide an element.');
    await openPicker(tab.id, 0);
    return { ok: true, state: await repository.get(), engine: engine.getStatus() };
  }
  if (action === 'RELOAD_PAGE') {
    const data = record(payload), tab = await activeTab();
    if (!tab?.id || data.tabId !== tab.id || !normalizeDomain(tab.url)) throw new Error('Reload the current website only.');
    await chrome.tabs.reload(tab.id);
    return { ok: true };
  }
  let expectedSettings: string | undefined;
  if (action === 'SAVE_SETTINGS' || action === 'SAVE_IMPORT') {
    const data = record(payload);
    if (typeof data.base !== 'string' || data.base.length > 2_000_000) throw new Error('Invalid settings revision.');
    expectedSettings = data.base;
    payload = data.state;
    if (action === 'SAVE_IMPORT') action = 'IMPORT_STATE';
  }
  let state: StateV2;
  if (action === 'SET_ADS_ENABLED') {
    const data = record(payload);
    if (typeof data.enabled !== 'boolean') throw new Error('Invalid protection setting.');
    state = await updateState(previous => ({ ...previous, preferences: { ...previous.preferences, adsEnabled: data.enabled as boolean } }));
  } else if (action === 'SET_THEME') {
    const data = record(payload);
    if (data.theme !== 'light' && data.theme !== 'dark' && data.theme !== 'system') throw new Error('Invalid appearance setting.');
    const theme = data.theme;
    state = await updateState(previous => ({ ...previous, preferences: { ...previous.preferences, theme } }));
  } else if (action === 'SET_SITE_PRESET') {
    const data = record(payload);
    if (typeof data.site !== 'string' || !Object.hasOwn(presetDefinitions, data.site) || typeof data.group !== 'string' || typeof data.enabled !== 'boolean') throw new Error('Invalid distraction setting.');
    const site = data.site as keyof typeof presetDefinitions, group = data.group;
    if (!presetDefinitions[site].groups.some(item => item.id === group)) throw new Error('Unsupported distraction setting.');
    state = await updateState(previous => {
      const choices = new Set(previous.distractionPresets[site] ?? []);
      data.enabled ? choices.add(group) : choices.delete(group);
      const next = { ...previous.distractionPresets, [site]: [...choices] };
      if (site === 'x.com' || site === 'twitter.com') { next['x.com'] = [...choices]; next['twitter.com'] = [...choices]; }
      return { ...previous, distractionPresets: next };
    });
  } else if (action === 'REMOVE_SAVED_HIDE') {
    const data = record(payload), site = normalizeDomain(data.domain), frame = data.frame === undefined ? null : normalizeDomain(data.frame);
    if (!site || data.domain !== site || (data.frame !== undefined && (!frame || data.frame !== frame)) || typeof data.selector !== 'string' || data.selector.length > 4096) throw new Error('Invalid saved element hide.');
    state = await updateState(previous => changeElementHide(previous, site, frame ?? site, frame === null, data.selector as string, true));
  } else if (action === 'RESTORE_ALL_HIDES') {
    state = await updateState(previous => ({ ...previous, distractionRules: {}, embeddedHides: [] }));
  } else if (action === 'UPDATE_STATE' || action === 'IMPORT_STATE' || action === 'SAVE_SETTINGS') {
    if (JSON.stringify(payload).length > 2_000_000) throw new Error('Settings are too large.');
    validateState(payload);
    if (action === 'IMPORT_STATE' && payload.focusSessions.some(session => session.endsAt > Date.now())) throw new Error('End timed sessions before importing this settings file. Active sessions are not imported.');
    state = await updateState(previous => {
      if (expectedSettings !== undefined && editableSettingsKey(previous) !== expectedSettings) throw new Error('SETTINGS_CONFLICT');
      return ({
      ...previous,
      preferences: structuredClone(payload.preferences),
      sitePolicies: structuredClone(payload.sitePolicies),
      distractionPresets: structuredClone(payload.distractionPresets),
      distractionRules: structuredClone(payload.distractionRules),
      embeddedHides: structuredClone(payload.embeddedHides ?? []),
      userRulesText: payload.userRulesText,
      focusProfiles: structuredClone(payload.focusProfiles),
      focusSessions: previous.focusSessions.filter(session => payload.focusProfiles.some(profile => profile.id === session.profileId)),
    }); });
  } else if (action === 'RESTORE_SITE_HIDES') {
    const data = record(payload), tab = await activeTab(), site = normalizeDomain(tab?.url);
    if (!site || data.domain !== site || data.tabId !== tab?.id) throw new Error('Restore hides for the current website only.');
    state = await updateState(previous => restoreSiteHides(previous, site));
  } else if (action === 'CLEAR_ACTIVITY') {
    state = await updateState(previous => ({ ...previous, activity: [] }));
  } else if (action === 'START_FOCUS') {
    const data = record(payload);
    if (typeof data.profileId !== 'string' || typeof data.minutes !== 'number') throw new Error('Choose a profile and session duration.');
    state = await updateState(previous => startFocus(previous, data.profileId as string, data.minutes as number));
  } else if (action === 'END_FOCUS' || action === 'BREAK_FOCUS') {
    const data = record(payload);
    if (typeof data.sessionId !== 'string') throw new Error('Choose an active session.');
    state = await updateState(previous => {
      if (!previous.focusSessions.some(session => session.id === data.sessionId)) throw new Error('This session has already ended.');
      return { ...previous, focusSessions: action === 'END_FOCUS' ? previous.focusSessions.filter(session => session.id !== data.sessionId) : previous.focusSessions.map(session => session.id === data.sessionId ? { ...session, breakUntil: Math.min(Date.now() + 5 * 60_000, session.endsAt) } : session) };
    });
  } else if (action === 'SITE_PAUSE') {
    const data = record(payload);
    const domain = normalizeDomain(data.domain);
    if (!domain || data.domain !== domain || typeof data.paused !== 'boolean' || (data.minutes !== null && (typeof data.minutes !== 'number' || !Number.isFinite(data.minutes) || data.minutes < 1 || data.minutes > 1440))) throw new Error('Invalid site pause.');
    state = await updateState(previous => ({ ...previous, sitePolicies: [...previous.sitePolicies.filter(policy => policy.domain !== domain), ...(data.paused ? [{ domain, adsPausedUntil: data.minutes === null ? null : Date.now() + Number(data.minutes) * 60_000 }] : [])] }));
  } else throw new Error('Unknown BLOKU action.');
  return { ok: true, state, engine: engine.getStatus() };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'BLOKU_V2') return false;
  if (typeof message.action !== 'string') { respond({ ok: false, error: 'Invalid action.' }); return false; }
  void serialize(() => handle(message.action, message.payload, sender)).then(respond, error => respond({ ok: false, error: error instanceof Error ? error.message : 'The operation failed.', engine: engine.getStatus() }));
  return true;
});

function scheduleObservation() { void serialize(reconcile).catch(() => undefined); }
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name.startsWith('bloku:')) scheduleObservation(); });
chrome.tabs.onActivated.addListener(scheduleObservation);
chrome.tabs.onUpdated.addListener((_tabId, info) => { if (info.url || info.status === 'complete') scheduleObservation(); });
chrome.windows.onFocusChanged.addListener(scheduleObservation);
chrome.idle.onStateChanged.addListener(scheduleObservation);
// Recompute consumer-route controls on real SPA transitions without patching page history.
chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
  if (details.frameId !== 0 || !normalizeDomain(details.url)) return;
  void ready.then(() => chrome.tabs.sendMessage(details.tabId, { action: 'BLOKU_REFRESH_CONFIG' }, { frameId: 0 })).catch(() => undefined);
});
chrome.webNavigation.onCommitted.addListener(details => {
  if (details.frameId !== 0) return;
  navigationStarts.set(details.tabId, Date.now());
  void chrome.storage.session.set({ blokuNavigationStarts: Object.fromEntries(navigationStarts) });
  const committedAt = Date.now();
  void serialize(async () => { await ready; const requiredAt = pauseReloadTabs.get(details.tabId); if (requiredAt !== undefined && committedAt >= requiredAt) pauseReloadTabs.delete(details.tabId); });
});
chrome.tabs.onRemoved.addListener(tabId => { navigationStarts.delete(tabId); pauseReloadTabs.delete(tabId); void chrome.storage.session.set({ blokuNavigationStarts: Object.fromEntries(navigationStarts) }); });
async function openPicker(tabId: number, frameId: number, fromContextMenu = false): Promise<void> {
  const message = { action: 'BLOKU_PICKER_START', fromContextMenu };
  try { await chrome.tabs.sendMessage(tabId, message, { frameId }); }
  catch {
    // Existing pages may not have this version's content script after an update.
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tabId, message, { frameId });
  }
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined) return;
  void serialize(async () => {
    await ready;
    if (info.menuItemId === 'bloku-hide-element') await openPicker(tab.id!, info.frameId ?? 0, true);
    if (info.menuItemId === 'bloku-restore-elements') {
      const site = normalizeDomain(tab.url);
      if (site) await updateState(previous => restoreSiteHides(previous, site));
    }
  }).catch(() => chrome.action.openPopup({ windowId: tab.windowId }).catch(() => undefined));
});
chrome.runtime.onInstalled.addListener(details => {
  void serialize(async () => { await ready; const state = await repository.get(); await openWelcomeOnce(details.reason, state.preferences.locale, chrome.storage.local, url => chrome.tabs.create({ url })); }).catch(() => undefined);
});
chrome.commands.onCommand.addListener(command => { if (command === 'toggle-protection') void serialize(async () => { await ready; await updateState(previous => ({ ...previous, preferences: { ...previous.preferences, adsEnabled: !previous.preferences.adsEnabled } })); }).catch(() => undefined); });
