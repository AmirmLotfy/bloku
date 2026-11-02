import { request, element, button, setTheme, showError } from './ui/api';
import { loadMessages, applyLanguage } from './ui/i18n';
import { effectiveFocus } from './focus';
import { domainMatches, normalizeDomain } from './model';

async function render() {
  const { state } = await request('GET_STATE');
  if (!state) throw new Error('Settings could not be loaded.');
  const text = await loadMessages(state.preferences.locale);
  applyLanguage(state.preferences.locale); setTheme(state.preferences.theme);
  const app = document.querySelector<HTMLElement>('#app')!;
  const url = new URL(location.href).searchParams.get('url');
  const host = normalizeDomain(url);
  app.replaceChildren();
  const reasons = effectiveFocus(state).filter(reason => host && reason.domains.some(domain => domainMatches(host, domain)));
  const title = element('h1', reasons.length ? text.focusActive : text.protection);
  app.append(title, element('p', host ?? text.protection), element('p', reasons.length ? text.blockedHelp : text.rulesHelp));
  for (const reason of reasons) app.append(element('p', `${reason.name}${reason.endsAt ? ` · ${new Date(reason.endsAt).toLocaleTimeString()}` : ''}`));
  for (const session of state.focusSessions.filter(session => reasons.some(reason => reason.profileId === session.profileId))) {
    app.append(button(text.break, async () => { await request('BREAK_FOCUS', { sessionId: session.id }); await render(); }), button(text.endFocus, async () => { await request('END_FOCUS', { sessionId: session.id }); await render(); }));
  }
  if (!reasons.length && url) {
    const destination = new URL(url);
    if (['http:', 'https:'].includes(destination.protocol)) app.append(button(text.resume, () => { location.href = destination.href; }, 'primary'));
  }
  app.append(button(text.return, () => { history.back(); }), button(text.settings, () => chrome.runtime.openOptionsPage()));
  const status = element('p'); status.setAttribute('role', 'status'); app.append(status);
}
void render().catch(showError);
