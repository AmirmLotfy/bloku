#!/usr/bin/env node
/** Bounded actual-UI accessibility checks. Never builds, patches, or publishes dist. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { validateExtension } from './v2-release-artifacts.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const B2 = path.resolve(path.dirname(SCRIPT), '..');
const ROOT = path.dirname(B2);
const DIST = path.join(B2, 'dist');
const OUTPUT = path.join(ROOT, 'artifacts/accessibility');
const LOCALES = ['en', 'ar', 'es', 'pt_BR', 'fr', 'de', 'ja', 'hi'];
const SECTIONS = ['protection', 'distractions', 'focus', 'rules', 'activity', 'about'];
const POPUP_DISCLOSURES = ['distraction-controls', 'protection-controls', 'focus-controls'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const relative = absolute => path.relative(ROOT, absolute).split(path.sep).join('/');

async function until(read, message, timeout = 10000) {
  const start = Date.now(); let last;
  while (Date.now() - start < timeout) {
    try { const result = await read(); if (result) return result; } catch (error) { last = error; }
    await pause(100);
  }
  throw new Error(`${message}${last ? `: ${last.message}` : ''}`);
}

async function preflight(selected, expected) {
  const packageInfo = await validateExtension(DIST);
  if (expected) assert.equal(packageInfo.checksumsManifestSha256, expected, 'The requested package fingerprint is not the current dist.');
  const locales = {};
  for (const locale of selected) {
    const bytes = await readFile(path.join(DIST, 'locales', `${locale}.json`));
    const messages = JSON.parse(bytes);
    for (const key of [...SECTIONS, 'settings', 'currentSite', 'adsEnabled', 'free', 'profileName']) assert.ok(typeof messages[key] === 'string' && messages[key], `${locale}: missing ${key}`);
    locales[locale] = { messages, sha256: sha256(bytes) };
  }
  return { packageInfo, locales };
}

async function run({ selected, expected, screenshots }) {
  const input = await preflight(selected, expected);
  let executablePath = process.env.BLOKU_CHROME_PATH;
  if (!executablePath) {
    const cache = path.join(B2, 'engine/.cache/browser/chrome');
    const build = (await readdir(cache)).filter(value => /156\./.test(value)).sort().at(-1);
    assert.ok(build, 'Cached Chrome for Testing 156 is required; this runner downloads nothing.');
    executablePath = path.join(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  }
  await mkdir(OUTPUT, { recursive: true });
  const work = await mkdtemp(path.join(OUTPUT, '.run-'));
  const profile = path.join(work, '.browser-profile');
  const report = {
    status: 'RUNNING', startedAt: new Date().toISOString(), version: '2.0.0', locales: selected,
    package: { checksumsManifestSha256: input.packageInfo.checksumsManifestSha256, manifestSha256: input.packageInfo.manifestSha256, filterRevision: input.packageInfo.filterRevision },
    runtimeLocales: Object.fromEntries(selected.map(locale => [locale, input.locales[locale].sha256])),
    runner: { path: relative(SCRIPT), sha256: sha256(await readFile(SCRIPT)) },
    checks: [], screenshots: [], errors: [], cleanupEvents: [], externalRequests: [],
    limits: [
      'Automated Chromium UI checks are not a WCAG conformance certification or a screen-reader usability test.',
      'Popup content is audited collapsed and expanded in an extension tab at its intrinsic 380px width. This does not qualify native toolbar preferred sizing or popover zoom.',
      'Only options-page chrome.tabs.setZoom with observed layout/device-pixel changes counts as the options 200% check. Native toolbar-popup 200% zoom is explicitly SKIP: tab zoom is not a substitute, and DPR 2 can be normal display density.',
      'Focus checks inspect real keyboard navigation, native focus-visible/focus-within state, computed outline, and viewport intersection. They do not prove every indicator pixel is unobscured or establish complete color contrast.',
      'Native file/time/select control text can follow the Chrome/OS locale independently of the extension language.',
      'The fixture is local and synthetic; no public-site behavior, browser extension installation flow, assistive-technology speech, or other browser version is qualified.',
    ],
  };
  let browser, server, options, popup, fixture, extensionId, fixtureUrl, locale = selected[0], interrupted = false, closing = false;
  const instrumentation = new Map();
  const interrupt = () => { interrupted = true; closing = true; if (browser) void browser.close().catch(() => {}); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);

  async function check(surface, mode, name, operation) {
    const result = { locale, surface, mode, name, status: 'PASS' };
    try { const detail = await operation(); if (detail !== undefined) result.detail = detail; }
    catch (error) { result.status = 'FAIL'; result.error = String(error.message || error); }
    report.checks.push(result); return result;
  }
  async function instrument(target) {
    if (instrumentation.has(target)) return instrumentation.get(target);
    const pending = (async () => {
      if (!['page', 'service_worker'].includes(target.type())) return null;
      const session = await target.createCDPSession();
      session.on('Fetch.requestPaused', async event => {
        try {
          const url = new URL(event.request.url);
          if (url.origin === new URL(fixtureUrl).origin || url.origin === `http://127.0.0.1:${server.address().port}`) await session.send('Fetch.continueRequest', { requestId: event.requestId });
          else { report.externalRequests.push({ locale, origin: url.origin, path: url.pathname }); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); }
        } catch { /* A target may close while cleanup runs. */ }
      });
      await session.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
      session.on('Runtime.exceptionThrown', event => (closing ? report.cleanupEvents : report.errors).push({ locale, target: target.type(), message: event.exceptionDetails.exception?.description || event.exceptionDetails.text }));
      await session.send('Runtime.enable');
      if (target.type() === 'page') await session.send('Accessibility.enable');
      return session;
    })(); instrumentation.set(target, pending); return pending;
  }
  async function newPage() {
    const page = await browser.newPage(); await instrument(page.target());
    page.on('pageerror', error => (closing ? report.cleanupEvents : report.errors).push({ locale, target: 'page', message: error.message })); return page;
  }
  async function request(action, payload) {
    const reply = await options.evaluate(({ action, payload }) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), { action, payload });
    assert.equal(reply?.ok, true, `${action}: ${JSON.stringify(reply)}`); return reply;
  }
  async function chooseSection(section) {
    await options.bringToFront();
    const index = SECTIONS.indexOf(section);
    const selector = `nav button:nth-child(${index + 1})`;
    await options.$eval(selector, element => element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }));
    const point = await until(async () => options.$eval(selector, element => {
      const r = element.getBoundingClientRect();
      if (r.width && r.height && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      return null;
    }), `Navigation control not visible: ${section}`);
    await options.mouse.click(point.x, point.y);
    await until(() => options.$eval('main h1', element => element.textContent).then(value => value === input.locales[locale].messages[section]), `Section did not render: ${section}`);
    await options.evaluate(() => scrollTo(0, 0));
  }
  async function semantics(page, surface, section) {
    const dom = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, direction: getComputedStyle(document.body).direction, headings: [...document.querySelectorAll('h1')].map(node => node.textContent), statuses: document.querySelectorAll('[role=status]').length, positiveTabIndexes: [...document.querySelectorAll('[tabindex]')].filter(node => Number(node.getAttribute('tabindex')) > 0).map(node => node.outerHTML.slice(0, 200)), unnamedIconButtons: [...document.querySelectorAll('button')].filter(node => node.querySelector('svg') && !node.textContent.trim() && !node.getAttribute('aria-label')?.trim()).map(node => node.id || node.className) }));
    assert.equal(dom.lang, locale.replace('_', '-')); assert.equal(dom.dir, locale === 'ar' ? 'rtl' : 'ltr'); assert.equal(dom.direction, dom.dir);
    assert.equal(dom.headings.length, 1, 'One primary page heading is expected'); assert.ok(dom.statuses >= 1, 'Status/live region is missing'); assert.deepEqual(dom.positiveTabIndexes, [], 'Positive tabindex changes the native reading order');
    assert.deepEqual(dom.unnamedIconButtons, [], 'Icon-only buttons require explicit accessible labels');
    assert.equal(dom.headings[0], surface === 'options' ? input.locales[locale].messages[section] : 'a11y.bloku.test');
    const session = await instrument(page.target());
    const { nodes } = await session.send('Accessibility.getFullAXTree');
    const roles = new Set(['button', 'checkbox', 'combobox', 'textbox', 'spinbutton', 'link', 'listbox', 'radio', 'switch', 'slider', 'searchbox', 'DisclosureTriangle']);
    const controls = nodes.filter(node => !node.ignored && roles.has(node.role?.value));
    assert.ok(controls.length, 'No interactive controls appeared in the native accessibility tree');
    const missing = controls.filter(node => !String(node.name?.value || '').trim()).map(node => ({ role: node.role?.value, backendDOMNodeId: node.backendDOMNodeId }));
    assert.deepEqual(missing, [], 'Interactive native accessibility-tree controls need accessible names');
    return { ...dom, controls: controls.map(node => ({ role: node.role.value, name: node.name.value })) };
  }
  async function overflow(page) {
    const measurement = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const offenders = [...document.querySelectorAll('main,section,button,label,input,select,textarea,code,p,h1,h2')].map(node => ({ node, r: node.getBoundingClientRect() })).filter(({ node, r }) => r.width && (r.left < -1 || r.right > width + 1) && !node.closest('nav')).slice(0, 12).map(({ node, r }) => ({ tag: node.tagName, text: node.textContent?.trim().slice(0, 80), left: r.left, right: r.right }));
      return { viewportWidth: innerWidth, layoutWidth: width, scrollWidth, devicePixelRatio, offenders };
    });
    assert.ok(measurement.scrollWidth <= measurement.layoutWidth + 1, `Horizontal document overflow: ${JSON.stringify(measurement)}`);
    return measurement;
  }
  async function shot(page, name) {
    if (!screenshots || !['en', 'ar'].includes(locale)) return;
    const filename = `${locale}-${name}.png`;
    if (report.screenshots.some(item => item.path === filename)) return;
    const bytes = await page.screenshot({ path: path.join(work, filename), type: 'png', fullPage: false, omitBackground: false });
    report.screenshots.push({ path: filename, sha256: sha256(bytes) });
  }
  async function keyboard(page, surface, section, limit = 40) {
    await page.bringToFront();
    const count = await page.evaluate(() => {
      scrollTo(0, 0);
      return [...document.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter(node => {
        const closed = node.closest('details:not([open])');
        return !node.disabled && node.tabIndex >= 0 && (!closed || node === closed.querySelector(':scope > summary')) && node.checkVisibility() && getComputedStyle(node).visibility !== 'hidden' && node.getClientRects().length;
      }).length;
    });
    // A real click in the page's empty top corner resets the sequential focus start.
    // Native time controls can use several Tab stops inside one input; retain these
    // observations instead of misclassifying the repeated host element as a trap.
    await page.mouse.click(2, 2); await pause(100);
    assert.ok(count > 0, 'No tabbable controls'); const visited = [], unique = new Set(); let browserBoundaryStops = 0;
    const targetCount = Math.min(count, limit);
    for (let step = 0; step < targetCount * 4 + 4 && unique.size < targetCount; step++) {
      await page.keyboard.press('Tab');
      await pause(100);
      const focus = await page.evaluate(() => {
        const node = document.activeElement;
        const all = [...document.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')];
        const index = all.indexOf(node); if (index < 0) return null;
        const r = node.getBoundingClientRect(), style = getComputedStyle(node);
        return { index, tag: node.tagName, type: node.getAttribute('type'), disclosureId: node.closest('details')?.id || null, text: (node.getAttribute('aria-label') || node.closest('label')?.textContent || node.textContent || '').trim().slice(0, 130), focusVisible: node.matches(':focus-visible'), focusWithin: node.matches(':focus-within'), outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), outlineColor: style.outlineColor, inViewport: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
      });
      if (!focus) { browserBoundaryStops++; continue; }
      if (focus.type === 'time') await shot(page, `${surface}-${section}-time-input-focus`);
      assert.ok(focus.focusVisible || focus.focusWithin, `Keyboard focus is not exposed on the control or its native descendants: ${JSON.stringify(focus)}`);
      assert.ok(focus.outlineWidth >= 2 && !['none', 'hidden'].includes(focus.outlineStyle) && !['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.outlineColor), `Keyboard outline is not visible: ${JSON.stringify(focus)}`);
      assert.ok(focus.inViewport, `Focused control is outside the viewport: ${JSON.stringify(focus)}`);
      visited.push(focus); unique.add(focus.index);
      if (visited.length === 1 && ['protection', 'popup'].includes(section)) await shot(page, `${surface}-keyboard`);
    }
    assert.equal(unique.size, targetCount, `Tab did not reach all ${targetCount} expected interactive controls within the bounded traversal`);
    if (surface === 'popup') for (const id of POPUP_DISCLOSURES) assert.ok(visited.some(item => item.tag === 'SUMMARY' && item.disclosureId === id), `Tab did not reach the ${id} summary`);
    return { tabbableCount: count, uniqueControlsVisited: unique.size, tabStopsObserved: visited.length, browserBoundaryStops, truncatedAt: count > limit ? limit : null, visited };
  }
  async function reducedMotion(page) {
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const value = await page.evaluate(() => ({ matches: matchMedia('(prefers-reduced-motion: reduce)').matches, moving: [...document.querySelectorAll('*')].filter(node => {
      const style = getComputedStyle(node); return (style.animationName !== 'none' && style.animationDuration.split(',').some(value => parseFloat(value) > 0)) || style.transitionDuration.split(',').some(value => parseFloat(value) > 0);
    }).map(node => node.tagName).slice(0, 10) }));
    assert.equal(value.matches, true); assert.deepEqual(value.moving, [], 'Reduced-motion preference leaves a CSS animation or transition running');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]); return value;
  }
  async function zoomFactor(page, value) {
    return page.evaluate(async value => {
      const tab = await chrome.tabs.getCurrent(); if (!tab?.id) throw new Error('The extension tab has no current tab ID');
      if (value !== null) await chrome.tabs.setZoom(tab.id, value);
      return chrome.tabs.getZoom(tab.id);
    }, value);
  }
  async function nativeOptionsZoom(page) {
    let applied = false;
    try {
      // Remove emulated device metrics so the real tab zoom must alter the native renderer.
      await page.setViewport(null); await page.bringToFront();
      const session = await instrument(page.target());
      const { targetInfo } = await session.send('Target.getTargetInfo');
      const { windowId } = await session.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId });
      await session.send('Browser.setWindowBounds', { windowId, bounds: { width: 1280, height: 1000 } });
      await zoomFactor(page, 1);
      const before = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
      const factor = await zoomFactor(page, 2); applied = true;
      assert.ok(Math.abs(factor - 2) < 0.01, `Native zoom API returned ${factor}`);
      let after;
      try { after = await until(async () => { const metrics = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })); return metrics.width <= before.width * 0.6 || metrics.dpr >= before.dpr * 1.8 ? metrics : null; }, 'No native renderer change observed', 2500); }
      catch { return { status: 'SKIP', reason: 'Native API accepted 200%, but no layout/device-pixel change was observed; no CSS substitute was used.', before, factor, applied }; }
      return { status: 'PASS', before, after, factor, applied };
    } catch (error) { return { status: 'SKIP', reason: `Native tab/window zoom unavailable: ${error.message}`, applied }; }
  }
  async function auditView(page, surface, mode, section, includeKeyboard) {
    await check(surface, mode, `${section}: locale, headings, status, accessible names`, () => semantics(page, surface, section));
    await check(surface, mode, `${section}: no horizontal document overflow`, () => overflow(page));
    if (includeKeyboard) await check(surface, mode, `${section}: actual Tab focus and visible outline`, () => keyboard(page, surface, section));
  }
  async function disclosureState(page, expectedOpen) {
    const items = await page.evaluate(ids => ids.map(id => {
      const node = document.getElementById(id), summary = node?.querySelector(':scope > summary');
      const controls = node ? [...node.querySelectorAll('button,input,select,textarea,a[href]')].map(control => ({ tag: control.tagName, visible: control.checkVisibility() && control.getClientRects().length > 0 && getComputedStyle(control).visibility !== 'hidden' })) : [];
      return { id, tag: node?.tagName, open: node?.open, summary: summary?.textContent.trim(), summaryCount: node?.querySelectorAll(':scope > summary').length, controls };
    }), POPUP_DISCLOSURES);
    const names = ['distractions', 'protection', 'focus'].map(key => input.locales[locale].messages[key]);
    for (const [index, item] of items.entries()) {
      assert.equal(item.tag, 'DETAILS', `Missing native disclosure ${item.id}`);
      assert.equal(item.summaryCount, 1, `A disclosure needs exactly one direct summary: ${item.id}`);
      assert.equal(item.summary, names[index], `Disclosure name is not localized: ${item.id}`);
      assert.equal(item.open, expectedOpen, `Unexpected disclosure state: ${item.id}`);
      assert.ok(item.controls.length > 0, `Expected fixture controls within ${item.id}`);
      assert.ok(item.controls.every(control => control.visible === expectedOpen), `Collapsed controls must be hidden and expanded controls visible: ${item.id}`);
    }
    return items;
  }
  async function keyboardDisclosureState(page, desiredOpen) {
    await page.bringToFront(); const changes = [];
    for (const [index, id] of POPUP_DISCLOSURES.entries()) {
      if (await page.$eval(`#${id}`, node => node.open) === desiredOpen) continue;
      await page.mouse.click(2, 2); let reached = false, steps = 0;
      for (; steps < 80; steps++) {
        await page.keyboard.press('Tab'); await pause(50);
        reached = await page.evaluate(id => document.activeElement === document.querySelector(`#${id} > summary`), id);
        if (reached) break;
      }
      assert.ok(reached, `Native summary ${id} was not reachable with Tab`);
      const focus = await page.$eval(`#${id} > summary`, node => {
        const style = getComputedStyle(node), r = node.getBoundingClientRect();
        return { visible: node.matches(':focus-visible'), outlineWidth: parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle, outlineColor: style.outlineColor, inViewport: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight };
      });
      assert.ok(focus.visible && focus.outlineWidth >= 2 && !['none', 'hidden'].includes(focus.outlineStyle) && !['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.outlineColor) && focus.inViewport, `Summary focus is not visibly indicated: ${JSON.stringify({ id, focus })}`);
      const activationKey = index % 2 ? 'Space' : 'Enter';
      await page.keyboard.press(activationKey);
      await until(() => page.$eval(`#${id}`, node => node.open).then(open => open === desiredOpen), `Native ${activationKey} did not toggle ${id}`);
      changes.push({ id, desiredOpen, activationKey, tabSteps: steps + 1, focus });
    }
    return changes;
  }
  async function auditPopup(page) {
    // This tab checks product content at its intrinsic width. It does not recreate
    // Chrome's toolbar preferred-size calculation or native popover zoom.
    await page.setViewport({ width: 380, height: 600, deviceScaleFactor: 1 });
    await check('popup', 'collapsed-380px', 'native details start collapsed', () => disclosureState(page, false));
    await auditView(page, 'popup', 'collapsed-380px', 'popup', true);
    await shot(page, 'popup-collapsed');
    await check('popup', 'expanded-380px', 'real Tab and Enter/Space expand all native disclosures', () => keyboardDisclosureState(page, true));
    await check('popup', 'expanded-380px', 'expanded disclosure names and visible controls', () => disclosureState(page, true));
    await auditView(page, 'popup', 'expanded-380px', 'popup', true);
    await check('popup', 'expanded-380px-reduced-motion', 'browser media preference and computed motion', () => reducedMotion(page));
    await shot(page, 'popup-expanded');
    await check('popup', 'collapsed-380px', 'real Tab and Enter/Space collapse disclosures again', () => keyboardDisclosureState(page, false));
    await check('popup', 'collapsed-380px', 'collapsed descendants remain hidden', () => disclosureState(page, false));
    report.checks.push({ locale, surface: 'popup', mode: 'native-200%-zoom', name: 'native toolbar popover enlargement', status: 'SKIP', detail: { reason: 'This runner opens popup content in a tab. Tab zoom cannot establish native toolbar-popup 200% enlargement; no CSS zoom, transform or density simulation is substituted. The separate manual native-surface observation is documented in docs/ACCESSIBILITY.md.', nativePopupExercisedByThisRunner: false, textEnlargementQualified: false } });
  }
  async function auditSurface(page, surface) {
    if (surface === 'popup') { await auditPopup(page); return; }
    const normal = { width: 1280, height: 1000, deviceScaleFactor: 1 };
    const sections = SECTIONS;
    await page.setViewport(normal); await page.bringToFront();
    for (const section of sections) {
      if (surface === 'options') await chooseSection(section);
      await auditView(page, surface, 'normal', section, surface === 'popup' || ['protection', 'focus', 'rules'].includes(section));
    }
    await check(surface, 'reduced-motion', 'browser media preference and computed motion', () => reducedMotion(page));
    await page.setViewport({ width: 320, height: 900, deviceScaleFactor: 1 });
    for (const section of sections) {
      if (surface === 'options') await chooseSection(section);
      await check(surface, '320px-viewport', `${section}: no horizontal document overflow`, () => overflow(page));
    }
    const zoom = await nativeOptionsZoom(page);
    report.checks.push({ locale, surface, mode: 'native-200%-zoom', name: 'genuine browser zoom supported and observed', status: zoom.status, detail: zoom });
    try {
      if (zoom.status === 'PASS') {
        for (const section of sections) {
          if (surface === 'options') await chooseSection(section);
          await check(surface, 'native-200%-zoom', `${section}: no horizontal document overflow`, () => overflow(page));
        }
        await shot(page, `${surface}-native-200-percent`);
      }
    } finally {
      if (zoom.applied) { const restored = await zoomFactor(page, 1); assert.ok(Math.abs(restored - 1) < 0.01, 'Native zoom did not reset'); }
      await page.setViewport(normal);
    }
  }

  try {
    server = http.createServer((req, res) => { if (req.url?.startsWith('/favicon.ico')) { res.writeHead(204); res.end(); return; } res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owned accessibility fixture</title></head><body><h1>Owned accessibility fixture</h1><p>This local page gives the real popup an active website.</p></body></html>'); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); fixtureUrl = `http://a11y.bloku.test:${server.address().port}/`;
    browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: null, userDataDir: profile, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--window-size=1280,1000', '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--host-resolver-rules=MAP *.bloku.test 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE localhost'] });
    assert.equal(interrupted, false, 'Interrupted during browser startup'); report.browser = await browser.version(); assert.match(report.browser, /(?:Chrome|HeadlessChrome)\/156\./);
    browser.on('targetcreated', target => { void instrument(target).catch(error => (closing ? report.cleanupEvents : report.errors).push({ locale, target: target.type(), message: error.message })); });
    for (const target of browser.targets()) await instrument(target);
    const worker = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'), { timeout: 30000 }); extensionId = new URL(worker.url()).host;
    options = await newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' }); await options.waitForSelector('main h1');
    assert.equal((await request('GET_STATE')).engine?.ok, true, 'Actual packaged engine failed initialization');
    fixture = await newPage(); await fixture.goto(fixtureUrl, { waitUntil: 'domcontentloaded' }); popup = await newPage();
    for (const code of selected) {
      locale = code; const { state } = await request('GET_STATE');
      state.preferences.locale = locale; state.preferences.theme = 'light'; state.preferences.activityEnabled = false;
      state.focusProfiles = [{ id: 'a11y-focus', name: input.locales[locale].messages.focus, domains: ['a11y.bloku.test'], enabled: false, schedules: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }], dailyAllowanceMinutes: 30 }];
      state.distractionPresets = { 'youtube.com': ['shorts', 'homefeed'] }; state.distractionRules = { 'a11y.bloku.test': ['.sample'] }; state.userRulesText = 'a11y.bloku.test##.sample';
      await request('UPDATE_STATE', state); await options.reload({ waitUntil: 'domcontentloaded' }); await options.waitForSelector('main h1');
      await auditSurface(options, 'options');
      await fixture.bringToFront(); await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' }); await popup.waitForSelector('#app h1');
      assert.equal(await popup.$eval('#app h1', node => node.textContent), 'a11y.bloku.test', 'Popup needs the actual fixture site controls');
      await auditSurface(popup, 'popup');
      const results = report.checks.filter(item => item.locale === locale);
      console.log(`${locale}: ${results.filter(item => item.status === 'PASS').length} PASS, ${results.filter(item => item.status === 'FAIL').length} FAIL, ${results.filter(item => item.status === 'SKIP').length} SKIP`);
    }
    await check('runtime', 'all', 'no runtime errors or external network attempts', () => { assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, []); });
    const after = await preflight(selected, input.packageInfo.checksumsManifestSha256);
    for (const code of selected) assert.equal(after.locales[code].sha256, input.locales[code].sha256, `Runtime locale changed: ${code}`);
    assert.equal(sha256(await readFile(SCRIPT)), report.runner.sha256, 'Qualification runner changed during execution');
    report.summary = { pass: report.checks.filter(item => item.status === 'PASS').length, fail: report.checks.filter(item => item.status === 'FAIL').length, skip: report.checks.filter(item => item.status === 'SKIP').length };
    report.status = report.summary.fail ? 'FAIL' : report.summary.skip ? 'PASS_WITH_DOCUMENTED_LIMITS' : 'PASS_BOUNDED_AUTOMATED_CHECKS';
    if (report.summary.fail) process.exitCode = 1;
  } catch (error) { report.status = 'RUN_ABORTED'; report.failure = String(error.stack || error); process.exitCode = 1; }
  finally {
    closing = true;
    try { if (browser) await browser.close(); }
    finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true }); process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
    report.completedAt = new Date().toISOString(); report.cleanup = { ownedBrowserClosed: true, ownedServerClosed: true, isolatedProfileRemoved: true };
    const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`); await writeFile(path.join(work, 'report.json'), reportBytes);
    await writeFile(path.join(work, 'SHA256SUMS'), `${[`${sha256(reportBytes)}  report.json`, ...report.screenshots.map(item => `${item.sha256}  ${item.path}`)].sort().join('\n')}\n`);
    const destination = path.join(OUTPUT, `bloku-2.0.0-${input.packageInfo.checksumsManifestSha256.slice(0, 12)}-${path.basename(work).replace('.run-', '')}`);
    await rename(work, destination); console.log(`${report.status}: ${relative(destination)}`); console.log('Owned browser/server/profile cleaned up.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const value = flag => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1]; };
  const selected = value('--locales')?.split(',') || LOCALES;
  assert.ok(selected.length && new Set(selected).size === selected.length && selected.every(locale => LOCALES.includes(locale)), 'Use --locales en,ar or omit for all eight.');
  const expected = value('--expected-checksums'); if (expected) assert.match(expected, /^[a-f0-9]{64}$/);
  const accepted = new Set(['--run', '--check-only', '--screenshots', '--locales', '--expected-checksums', value('--locales'), expected]);
  assert.ok(args.every(argument => accepted.has(argument)), 'Unknown argument');
  if (args.includes('--check-only')) { const result = await preflight(selected, expected); console.log(`Ready: ${selected.length} locales; ${result.packageInfo.entries.length} package files; ${result.packageInfo.checksumsManifestSha256}. No browser launched.`); return; }
  if (args.includes('--run')) { await run({ selected, expected, screenshots: args.includes('--screenshots') }); return; }
  console.log('Usage: node B2/scripts/v2-accessibility-check.mjs --check-only | --run [--locales en,ar] [--screenshots] [--expected-checksums <sha256>]');
  console.log('Run only after the coordinator explicitly grants the browser lane. No build, product edits, CSS zoom, external browsing, or publication occurs.');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
