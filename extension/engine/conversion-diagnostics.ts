import { Rule, UnsupportedModifierError } from '@adguard/dnr-converter';

const POPUP_DIAGNOSTIC = 'Network rule with explicitly enabled $popup modifier is not supported';
const RUNTIME_POPUP_MODIFIERS = new Set(['popup', 'domain', 'to', 'third-party', 'match-case', 'important']);

/**
 * The pinned SDK handles explicit popup rules through its TSUrlFilter/tab-close
 * path, rather than DNR. Accept only that converter diagnostic, tied to the
 * exact local filter source; all other conversion failures remain fatal.
 */
export function isRuntimePopupDiagnostic(error: unknown, content: string, userFilterId: number): boolean {
  if (!(error instanceof UnsupportedModifierError) || error.message !== POPUP_DIAGNOSTIC) return false;
  const rule = error.rule;
  if (!(rule instanceof Rule) || rule.filterListId !== userFilterId) return false;
  const offset = rule.index; // Converter indexes are character offsets, not line numbers.
  if (!Number.isInteger(offset) || offset < 0 || offset >= content.length || (offset > 0 && content[offset - 1] !== '\n')) return false;
  const source = content.slice(offset).split(/\r?\n/, 1)[0];
  const modifiers = rule.node.modifiers?.children ?? [];
  if (!modifiers.some(modifier => modifier.name.value === 'popup' && !modifier.exception)) return false;
  // Reject mixed resource/response modifiers: the converter may stop at popup
  // before reporting another unsupported capability in the same rule.
  if (modifiers.some(modifier => !RUNTIME_POPUP_MODIFIERS.has(modifier.name.value))) return false;
  try {
    const parsed = Rule.createFromText(userFilterId, offset, source);
    return parsed.length === 1 && parsed[0].getText() === rule.getText();
  } catch {
    return false;
  }
}

export function fatalDynamicConversionErrors(errors: readonly Error[], content: string, userFilterId: number): Error[] {
  return errors.filter(error => !isRuntimePopupDiagnostic(error, content, userFilterId));
}
