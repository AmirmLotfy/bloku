import type { StateV2 } from './model';

/** Editable settings only: background activity/session updates must not invalidate a draft. */
export function editableSettingsKey(state: StateV2): string {
  const value = { preferences: state.preferences, sitePolicies: state.sitePolicies, distractionPresets: state.distractionPresets, distractionRules: state.distractionRules, embeddedHides: state.embeddedHides ?? [], userRulesText: state.userRulesText, focusProfiles: state.focusProfiles };
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
