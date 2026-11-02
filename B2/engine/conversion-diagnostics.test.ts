import test from 'node:test';
import assert from 'node:assert/strict';
import { Filter, FilterConverter, Rule, RuleDeclarativeValidator, UnsupportedModifierError } from '@adguard/dnr-converter';
import { Engine, FilterList, Request, RequestType } from '@adguard/tsurlfilter';
import { fatalDynamicConversionErrors, isRuntimePopupDiagnostic } from './conversion-diagnostics';

const USER_FILTER_ID = 0; // SDK 6.0.1's exported USER_FILTER_ID.
const popupMessage = 'Network rule with explicitly enabled $popup modifier is not supported';

function popupError(text: string, offset = 0, filterId = USER_FILTER_ID): UnsupportedModifierError {
  const [rule] = Rule.createFromText(filterId, offset, text);
  try { RuleDeclarativeValidator.shouldConvertRule(rule); } catch (error) {
    assert.ok(error instanceof UnsupportedModifierError);
    return error;
  }
  assert.fail('Expected the actual converter popup diagnostic');
}

test('real structured converter diagnostics match the local source offset and rule', async () => {
  const content = '||ordinary.test^\n||ads.test^$popup,domain=publisher.test';
  const [result] = await new FilterConverter().convert([new Filter(USER_FILTER_ID, content)], { withSourceMap: true });
  assert.equal(result.errors.length, 1);
  const error = result.errors[0];
  assert.ok(error instanceof UnsupportedModifierError);
  assert.equal(error.rule.index, content.indexOf('||ads.test'));
  assert.equal(content.slice(0, error.rule.index).split('\n').length, 2);
  assert.equal(error.rule.getText(), '||ads.test^$popup,domain=publisher.test');
  assert.equal(isRuntimePopupDiagnostic(error, content, USER_FILTER_ID), true);
  assert.deepEqual(fatalDynamicConversionErrors(result.errors, content, USER_FILTER_ID), []);
  assert.equal((await result.ruleset.getDeclarativeRules()).length, 1, 'Ordinary DNR rules remain present');
  assert.deepEqual(result.limitations, []);
});

test('popup rules remain in SDK content and its runtime matching engine', () => {
  const rule = '||ads.test^$popup,domain=publisher.test';
  const filter = new FilterList(rule, USER_FILTER_ID);
  assert.deepEqual(filter.getConversionErrors(), []);
  assert.equal(filter.getContent(), rule);
  const engine = Engine.createSync({ filters: [{ id: USER_FILTER_ID, content: filter }] });
  assert.ok(engine.matchRequest(new Request('https://ads.test/popup', 'https://publisher.test/', RequestType.Document)).getPopupRule());
  assert.equal(engine.matchRequest(new Request('https://ads.test/popup', 'https://unrelated.test/', RequestType.Document)).getPopupRule(), null);
});

test('only popup plus supported runtime scope modifiers qualify', () => {
  for (const text of ['||ads.test^$popup', '||ads.test^$popup,third-party', '@@||ads.test^$popup,domain=publisher.test', '||ads.test^$popup,important,to=ads.test']) {
    assert.equal(isRuntimePopupDiagnostic(popupError(text), text, USER_FILTER_ID), true, text);
  }
  for (const text of ['||ads.test^$popup,script', '||ads.test^$popup,redirect=noopjs', '||ads.test^$popup,csp=script-src none']) {
    assert.equal(isRuntimePopupDiagnostic(popupError(text), text, USER_FILTER_ID), false, text);
  }
  assert.throws(
    () => Rule.createFromText(USER_FILTER_ID, 0, '||ads.test^$popup,removeparam=secret'),
    /Cannot create Rule.*\$removeparam is not compatible with \$popup/,
  );
});

test('messages alone, foreign filters, wrong offsets and changed source cannot qualify', () => {
  const text = '||ads.test^$popup';
  const error = popupError(text);
  assert.equal(isRuntimePopupDiagnostic(new Error(popupMessage), text, USER_FILTER_ID), false);
  assert.equal(isRuntimePopupDiagnostic({ name: 'UnsupportedModifierError', message: popupMessage, rule: error.rule }, text, USER_FILTER_ID), false);
  assert.equal(isRuntimePopupDiagnostic(popupError(text, 0, 100), text, USER_FILTER_ID), false);
  assert.equal(isRuntimePopupDiagnostic(popupError(text, 1), `x${text}`, USER_FILTER_ID), false);
  assert.equal(isRuntimePopupDiagnostic(error, '||other.test^$popup', USER_FILTER_ID), false);
  assert.equal(isRuntimePopupDiagnostic(error, '', USER_FILTER_ID), false);
});

test('quota, malformed, other unsupported modifiers and focus-rule failures stay fatal', () => {
  const popup = '||ads.test^$popup';
  const [focus] = Rule.createFromText(USER_FILTER_ID, 0, '||focus.test^$document,important');
  const failures = [
    new Error('Quota exceeded'),
    new SyntaxError('Malformed rule'),
    new UnsupportedModifierError('Network rule with $redirect-rule modifier is not supported', Rule.createFromText(USER_FILTER_ID, 0, '||ads.test^$redirect-rule=noopjs')[0]),
    new UnsupportedModifierError(popupMessage, focus),
  ];
  assert.deepEqual(fatalDynamicConversionErrors([popupError(popup), ...failures], popup, USER_FILTER_ID), failures);
});
