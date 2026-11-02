import { TsWebExtension, FilterList, USER_FILTER_ID, type Configuration, type ConfigurationResult } from '@adguard/tswebextension/mv3';
import { LogLevel } from '@adguard/logger';
import catalogJson from './generated/catalog.json';
import buildInfoJson from './generated/build-info.json';
import { localScriptRules } from './generated/local-script-rules.js';
import { compilePolicy, EnginePolicyError } from './policy';
import { EngineTransaction, type EngineDriver } from './transaction';
import { fatalDynamicConversionErrors } from './conversion-diagnostics';
import type { BlokuEngine, EngineInput, EngineOptions, PackagedList } from './types';

export type { BlokuEngine, EngineInput, EngineOptions, EngineStatus, EngineIssue, EngineStorage } from './types';
export const PACKAGED_LISTS: PackagedList[] = catalogJson;
export const ENGINE_BUILD_INFO = buildInfoJson;

let created = false;

/** The only owner of extension-wide DNR mutations. Instantiate once in the worker. */
export function createBlokuEngine(options: EngineOptions = {}): BlokuEngine {
  if (created) throw new Error('Only one Bloku engine may own DNR in this worker.');
  created = true;
  const sdk = new TsWebExtension('/engine/war/redirects');
  TsWebExtension.setLocalScriptRules(localScriptRules);
  let started = false;
  const messageHandler = sdk.getMessageHandler();
  // Do not let arbitrary extension messages reach the SDK's message router.
  // The SDK itself validates the message type and permitted sender context.
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message || message.handlerName !== 'tsWebExtension' || sender.id !== chrome.runtime.id) return false;
    Promise.resolve(messageHandler(message as never, sender as never)).then(respond, () => respond(undefined));
    return true;
  });
  sdk.onAssistantCreateRule.subscribe(rule => { void options.onPickerRule?.(rule); });

  function configuration(input: EngineInput): Configuration {
    const compiled = compilePolicy(input, PACKAGED_LISTS);
    const filter = new FilterList(compiled.content);
    if (filter.getConversionErrors().length) throw new EnginePolicyError('conversion-failed', 'A local rule could not be converted.');
    return {
      staticFiltersIds: compiled.filterIds,
      filtersPath: 'engine/filters',
      rulesetsPath: 'engine/rulesets',
      allowlist: [], trustedDomains: [], customFilters: [],
      userrules: { content: filter.getContent(), conversionData: filter.getConversionData() },
      declarativeLogEnabled: false, logLevel: LogLevel.Error,
      settings: {
        allowlistEnabled: false, allowlistInverted: false,
        collectStats: false, debugScriptlets: false, stealthModeEnabled: false,
        filteringEnabled: input.adsEnabled || input.focusDomains.length > 0,
        documentBlockingPageUrl: options.documentBlockingPageUrl ?? chrome.runtime.getURL('blocked.html'),
        assistantUrl: 'engine/assistant.js',
        gpcScriptUrl: 'engine/gpc.js', hideDocumentReferrerScriptUrl: 'engine/hide-document-referrer.js',
        stealth: { selfDestructFirstPartyCookies: false, selfDestructFirstPartyCookiesTime: 0, selfDestructThirdPartyCookies: false, selfDestructThirdPartyCookiesTime: 0, hideReferrer: false, hideSearchQueries: false, blockChromeClientData: false, sendDoNotTrack: false, blockWebRTC: false },
      },
    };
  }

  async function verify(input: EngineInput, result: ConfigurationResult, userContent: string): Promise<void> {
    const errors = [...result.staticFiltersStatus.errors, ...fatalDynamicConversionErrors(result.dynamicRules?.errors ?? [], userContent, USER_FILTER_ID), ...(result.dynamicRules?.limitations ?? [])];
    if (errors.length) throw new EnginePolicyError('conversion-or-quota', errors.map(error => error.message).join('; ').slice(0, 1000));
    const actualIds = (await chrome.declarativeNetRequest.getEnabledRulesets()).sort();
    const expectedIds = input.adsEnabled ? PACKAGED_LISTS.filter(list => input.enabledLists.includes(list.id)).map(list => `ruleset_${list.filterId}`).sort() : [];
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new EnginePolicyError('static-state-mismatch', 'The requested packaged lists were not fully enabled.');
    const actualDynamic = await chrome.declarativeNetRequest.getDynamicRules();
    const expectedDynamic = await result.dynamicRules?.ruleset.getDeclarativeRules() ?? [];
    if (actualDynamic.length !== expectedDynamic.length) throw new EnginePolicyError('dynamic-state-mismatch', 'Local network rules were not fully applied.');
    for (const rulesetId of expectedIds) {
      const actualDisabled = (await chrome.declarativeNetRequest.getDisabledRuleIds({ rulesetId })).sort((a, b) => a - b);
      // Several source rules can map to one merged DNR rule. Chrome returns
      // unique IDs, while the converter's cancellation list can repeat them.
      const expectedDisabled = [...new Set(result.dynamicRules?.declarativeRulesToCancel.find(item => item.rulesetId === rulesetId)?.disableRuleIds ?? [])].sort((a, b) => a - b);
      if (JSON.stringify(actualDisabled) !== JSON.stringify(expectedDisabled)) throw new EnginePolicyError('exception-state-mismatch', `The focus exception state could not be verified (${rulesetId}: ${actualDisabled.length}/${expectedDisabled.length}).`);
    }
  }

  const driver: EngineDriver = {
    initialize: () => sdk.initStorage(),
    async preflight(input) {
      // Parse before the SDK performs any mutation, including paused local rules.
      compilePolicy(input, PACKAGED_LISTS);
      const available = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
      const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
      const currentlyOwned = PACKAGED_LISTS.filter(list => enabled.includes(`ruleset_${list.filterId}`)).reduce((sum, list) => sum + list.ruleCount, 0);
      const wanted = input.adsEnabled ? PACKAGED_LISTS.filter(list => input.enabledLists.includes(list.id)).reduce((sum, list) => sum + list.ruleCount, 0) : 0;
      if (wanted > available + currentlyOwned) throw new EnginePolicyError('static-quota', 'Chrome has insufficient capacity for the selected complete lists. Disable an optional list and retry; your previous settings remain active.');
    },
    async configure(input) {
      const config = configuration(input);
      const result = started ? await sdk.configure(config) : await sdk.start(config);
      started = true;
      await verify(input, result, config.userrules.content);
    },
  };
  const storage = options.storage ?? {
    async get(key: string) { return (await chrome.storage.local.get(key))[key]; },
    async set(key: string, value: unknown) { await chrome.storage.local.set({ [key]: value }); },
  };
  const controller = new EngineTransaction(driver, PACKAGED_LISTS, storage);
  return {
    initialize: input => controller.apply(input),
    apply: input => controller.apply(input),
    getStatus: () => controller.getStatus(),
    async openPicker(tabId) { await sdk.openAssistant(tabId); },
  };
}
