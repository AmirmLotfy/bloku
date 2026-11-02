import { RuleParser } from '@adguard/agtree/parser';
import { RuleGenerator } from '@adguard/agtree/generator';
import type { NetworkRule } from '@adguard/agtree';
import type { EngineInput, PackagedList } from './types';

export class EnginePolicyError extends Error {
  constructor(public code: string, message: string, public line?: number) {
    super(message);
  }
}

export const MAX_USER_RULE_BYTES = 256_000;
export const MAX_USER_RULES = 5_000;
export const MAX_FOCUS_DOMAINS = 200;

function domains(values: string[], max: number): string[] {
  if (!Array.isArray(values) || values.length > max) throw new EnginePolicyError('domain-limit', `At most ${max} domains are supported.`);
  return [...new Set(values.map(value => {
    if (typeof value !== 'string' || value.length > 253 || /[\s/:?#@|,*^$~]/.test(value)) {
      throw new EnginePolicyError('invalid-domain', 'Use a hostname without a scheme, path, port or wildcard.');
    }
    const hostname = new URL(`https://${value}`).hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname || !hostname.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
      throw new EnginePolicyError('invalid-domain', 'A valid hostname is required.');
    }
    return hostname;
  }))].sort();
}

export function normalizeInput(input: EngineInput, lists: PackagedList[]): EngineInput {
  if (!input || typeof input.adsEnabled !== 'boolean' || typeof input.userRules !== 'string') {
    throw new EnginePolicyError('invalid-input', 'Invalid protection settings.');
  }
  if (new TextEncoder().encode(input.userRules).length > MAX_USER_RULE_BYTES || input.userRules.split(/\r?\n/).length > MAX_USER_RULES) {
    throw new EnginePolicyError('user-rule-limit', `User rules exceed the local ${MAX_USER_RULE_BYTES}-byte / ${MAX_USER_RULES}-line safety limit.`);
  }
  if (!Array.isArray(input.enabledLists) || input.enabledLists.some(id => !lists.some(list => list.id === id))) {
    throw new EnginePolicyError('unknown-list', 'An unknown packaged filter list was requested.');
  }
  return { adsEnabled: input.adsEnabled, userRules: input.userRules, siteExceptions: domains(input.siteExceptions, 1_000), focusDomains: domains(input.focusDomains, MAX_FOCUS_DOMAINS), enabledLists: [...new Set(input.enabledLists)] };
}

function excludeFocus(rule: NetworkRule, focusDomains: string[]): string {
  const modifiers = rule.modifiers ?? { type: 'ModifierList', children: [] };
  rule.modifiers = modifiers;
  let to = modifiers.children.find(modifier => modifier.name.value === 'to');
  if (!to) {
    to = { type: 'Modifier', name: { type: 'Value', value: 'to' }, exception: false, value: { type: 'Value', value: '' } };
    modifiers.children.push(to);
  }
  to.value = { type: 'Value', value: [...(to.value?.value ? to.value.value.split('|') : []), ...focusDomains.map(domain => `~${domain}`)].join('|') };
  return RuleGenerator.generate(rule);
}

export function compilePolicy(input: EngineInput, lists: PackagedList[]): { content: string; filterIds: number[] } {
  const lines: string[] = [];
  const focus = input.focusDomains;
  const focusRules = new Set(focus.map(domain => `||${domain}^$document,important`));

  // No original user input is changed in storage. This is only the effective engine configuration.
  for (const [index, raw] of input.userRules.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    let rule;
    try { rule = RuleParser.parse(raw); } catch { throw new EnginePolicyError('invalid-rule', 'Invalid filter syntax.', index + 1); }
    if (rule.category === 'Comment') {
      if (rule.type === 'PreProcessorCommentRule') throw new EnginePolicyError('unsupported-rule', 'Preprocessor directives are only supported in packaged lists.', index + 1);
      continue;
    }
    if (rule.category === 'Cosmetic') {
      if (rule.type !== 'ElementHidingRule') throw new EnginePolicyError('unsupported-rule', 'Local cosmetic rules support CSS element-hiding selectors; executable and style-injection rules are not supported.', index + 1);
    } else if (rule.category === 'Network' && rule.type === 'NetworkRule') {
      if (rule.modifiers?.children.some(modifier => ['cookie', 'jsinject', 'replace', 'jsonprune', 'xmlprune'].includes(modifier.name.value))) {
        throw new EnginePolicyError('unsupported-rule', 'This rule requires an unsupported cookie or response mutation capability.', index + 1);
      }
      const badfilter = rule.modifiers?.children.find(modifier => modifier.name.value === 'badfilter');
      if (badfilter && focus.length) {
        throw new EnginePolicyError('focus-conflict', 'User badfilter overrides cannot be applied while focus is active. Stored rules are preserved.', index + 1);
      }
      const transformsRequest = rule.modifiers?.children.some(modifier => ['redirect', 'redirect-rule', 'removeparam', 'urltransform'].includes(modifier.name.value));
      if ((rule.exception || transformsRequest) && focus.length && !badfilter) {
        if (input.adsEnabled) lines.push(excludeFocus(rule, focus));
        continue;
      }
    } else {
      throw new EnginePolicyError('unsupported-rule', 'This rule type is not supported.', index + 1);
    }
    if (input.adsEnabled) lines.push(raw);
  }

  if (input.adsEnabled) {
    for (const domain of input.siteExceptions) {
      const rule = RuleParser.parse(`@@$document,important,to=${domain}`) as NetworkRule;
      lines.push(focus.length ? excludeFocus(rule, focus) : RuleGenerator.generate(rule));
    }
    if (focus.length) {
      for (const list of lists.filter(list => input.enabledLists.includes(list.id))) {
        for (const text of list.focusOverrideRules) {
          // SDK cross-filter $badfilter disables the original static override.
          // Its replacement still protects every destination outside the active focus set.
          const rule = RuleParser.parse(text) as NetworkRule;
          const badfilter = structuredClone(rule);
          badfilter.modifiers!.children.push({ type: 'Modifier', name: { type: 'Value', value: 'badfilter' }, exception: false });
          lines.push(RuleGenerator.generate(badfilter), excludeFocus(rule, focus));
        }
      }
    }
  }
  lines.push(...focusRules);
  return { content: [...new Set(lines)].join('\n'), filterIds: input.adsEnabled ? lists.filter(list => input.enabledLists.includes(list.id)).map(list => list.filterId) : [] };
}
