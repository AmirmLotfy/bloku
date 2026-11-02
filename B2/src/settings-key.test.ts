import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from './model';
import { editableSettingsKey } from './settings-key';

test('background activity and session observations do not invalidate an editable draft', () => {
  const state = defaultState(), changed = structuredClone(state);
  changed.activity = [{ date: '2026-11-02', domainSeconds: { 'example.test': 30 }, focusSeconds: 0 }];
  changed.focusSessions = [{ id: 'new', profileId: 'test', startedAt: 1, endsAt: 2, breakUntil: null }];
  assert.equal(editableSettingsKey(state), editableSettingsKey(changed));
});
test('concurrent site pauses, element hides and protection changes invalidate a stale draft', () => {
  const initial = defaultState();
  for (const change of [(state: typeof initial) => state.sitePolicies.push({ domain: 'example.test', adsPausedUntil: 1000 }), (state: typeof initial) => state.distractionRules['example.test'] = ['#saved'], (state: typeof initial) => state.preferences.adsEnabled = false, (state: typeof initial) => state.embeddedHides = [{ site: 'example.test', frame: 'widget.test', selectors: ['#saved'] }]]) {
    const changed = structuredClone(initial); change(changed); assert.notEqual(editableSettingsKey(initial), editableSettingsKey(changed));
  }
});
test('Chrome object key reordering and an optional empty frame collection are semantically equivalent', () => {
  const state = defaultState(), reordered = structuredClone(state);
  reordered.preferences = Object.fromEntries(Object.entries(state.preferences).reverse()) as typeof state.preferences;
  reordered.embeddedHides = [];
  assert.equal(editableSettingsKey(state), editableSettingsKey(reordered));
});
