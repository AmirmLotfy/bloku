#!/usr/bin/env node
/** Capture the built extension in an isolated browser; never build or alter dist. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { safePath, validateExtension } from './v2-release-artifacts.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const B2 = path.resolve(path.dirname(SCRIPT), '..');
const ROOT = path.dirname(B2);
const DIST = path.join(B2, 'dist');
const OUTPUT = path.join(ROOT, 'artifacts/store');
const LOCALES = ['en', 'ar', 'es', 'pt_BR', 'fr', 'de', 'ja', 'hi'];
const SHOTS = ['01-protection', '02-distractions', '03-timed-focus', '04-schedules', '05-local-settings'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const relative = absolute => path.relative(ROOT, absolute).split(path.sep).join('/');
const pngData = bytes => `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;

async function inputs(selected = LOCALES) {
  const qualified = await validateExtension(DIST);
  const locales = {};
  for (const locale of selected) {
    assert.ok(LOCALES.includes(locale), `Unsupported locale: ${locale}`);
    const captionPath = `B2/store/locales/${locale}.json`;
    const uiPath = `B2/dist/locales/${locale}.json`;
    const captionBytes = await readFile(path.join(ROOT, captionPath));
    const uiBytes = await readFile(path.join(ROOT, uiPath));
    const copy = JSON.parse(captionBytes), ui = JSON.parse(uiBytes);
    assert.ok(typeof copy.title === 'string' && copy.title.startsWith('BLOKU'), `${captionPath}: missing title`);
    assert.ok(typeof copy.summary === 'string' && copy.summary.trim(), `${captionPath}: missing summary`);
    assert.equal(copy.screenshotCaptions?.length, 5, `${captionPath}: exactly five approved captions required`);
    assert.ok(copy.screenshotCaptions.every(value => typeof value === 'string' && value.trim()), `${captionPath}: empty caption`);
    for (const key of ['free', 'protection', 'distractions', 'focus', 'rules', 'about', 'presetsHelp', 'focusHelp', 'localOnly', 'recommendations', 'confirmHide', 'cancel', 'filterHelp']) assert.ok(typeof ui[key] === 'string' && ui[key], `${uiPath}: missing ${key}`);
    locales[locale] = { copy, ui, lang: locale.replace('_', '-'), dir: locale === 'ar' ? 'rtl' : 'ltr', provenance: { captions: captionPath, captionsSha256: sha256(captionBytes), runtimeLocale: uiPath, runtimeLocaleSha256: sha256(uiBytes) } };
  }
  const iconBytes = await readFile(path.join(DIST, 'icons/icon-128.png'));
  return { qualified, locales, icon: pngData(iconBytes), iconSha256: sha256(iconBytes) };
}

function fixtureHTML({ copy, ui, lang, dir }) {
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BLOKU · ${escape(ui.distractions)}</title><style>
  *{box-sizing:border-box}body{margin:0;color:#231b1f;background:#faf7f4;font:17px/1.7 system-ui,-apple-system,sans-serif}header{padding:24px 30px;border-bottom:1px solid #d9cfd0;display:flex;justify-content:space-between;align-items:center;font-size:12px;letter-spacing:.12em}header strong{font-size:20px;letter-spacing:.08em}main{padding:30px;max-width:900px;margin:auto}h1{font-size:36px;line-height:1.2;margin:0 0 20px;letter-spacing:-.035em;max-width:15em}p{margin:0 0 18px}.article{max-width:570px}.line{height:1px;background:#d9cfd0;margin:25px 0}.accent{width:48px;height:5px;background:#8b1230;margin-bottom:25px}aside{border:1px solid #ddc7cc;background:#f4e7e9;border-radius:14px;padding:22px;margin-top:24px}aside h2{font-size:19px;margin:0 0 9px}aside p{font-size:14px;margin:0}small{color:#6c5960;font-size:12px}html[dir=rtl] h1{letter-spacing:0}
  </style></head><body><header><strong>BLOKU</strong><span>${escape(ui.protection)}</span></header><main><div class="accent"></div><article class="article"><h1>${escape(ui.distractions)}</h1><p>${escape(ui.presetsHelp)}</p><div class="line"></div><small>reading.bloku.test</small></article><aside id="suggestion"><h2>${escape(ui.recommendations)}</h2><p>${escape(copy.screenshotCaptions[1])}</p></aside></main></body></html>`;
}

function compositionHTML({ locale, item, icon, images, index, kind = 'screenshot' }) {
  const { copy, ui, lang, dir } = locale;
  const title = kind === 'screenshot' ? copy.screenshotCaptions[index] : copy.title.replace(/^BLOKU\s*[—–-]\s*/, '');
  const image = (name, className, label) => `<figure class="proof ${className}"><div class="frame-label">${escape(label)}</div><div class="image-frame"><img src="${images[name]}" alt="${escape(label)}"></div></figure>`;
  let proof = '';
  if (kind === 'screenshot') {
    if (index === 0) proof = image('popup', 'popup-proof', ui.currentSite) + image('protection', 'wide-proof', ui.protection);
    if (index === 1) proof = image('presets', 'equal-proof', ui.distractions) + image('picker', 'equal-proof', ui.picker);
    if (index === 2) proof = image('blocked', 'wide-proof dark-proof', ui.focusActive) + image('active-popup', 'session-proof dark-proof', ui.focus);
    if (index === 3) proof = image('profile', 'equal-proof', ui.profileName) + image('schedule', 'equal-proof', ui.schedules);
    if (index === 4) proof = image('rules', 'equal-proof', ui.export) + image('about', 'equal-proof', ui.about);
  } else if (kind === 'marquee') proof = image('popup', 'promo-popup', ui.protection);
  const isSmall = kind === 'small';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${escape(item)}</title><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",sans-serif;background:#f5efed;color:#25171d}body:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 88% 0%,#e5c8d06b,transparent 62%);pointer-events:none}.canvas{position:relative;height:100%;padding:36px 48px 30px}.brand-row{display:flex;justify-content:space-between;align-items:center;gap:24px}.brand{display:flex;align-items:center;gap:12px;font-size:26px;letter-spacing:.1em;font-weight:800;direction:ltr}.brand img{width:42px;height:42px;object-fit:contain}.version{font-size:12px;letter-spacing:0;background:#8b1230;color:white;border-radius:20px;padding:5px 9px;margin-inline-start:4px}.badge{font-size:16px;border:1px solid #d6bec4;padding:8px 16px;border-radius:99px;color:#6a1730;background:#fff7}.caption{font-size:43px;line-height:1.17;letter-spacing:-.035em;font-weight:700;margin:25px 0 26px;max-width:1120px;min-height:102px;display:flex;align-items:center}.proofs{display:flex;align-items:center;justify-content:center;gap:26px;height:520px}.proof{margin:0;min-width:0;display:flex;flex-direction:column;align-items:center;max-height:520px}.frame-label{align-self:flex-start;font-size:13px;font-weight:600;color:#745963;margin:0 8px 9px}.image-frame{display:flex;justify-content:center;width:100%;padding:12px;border:1px solid #d8cbd0;border-radius:13px;background:#fcfcfc;box-shadow:0 12px 34px #45233212}.proof img{display:block;width:100%;height:auto;object-fit:contain;object-position:top center;max-height:460px}.dark-proof .image-frame{background:#101014;border-color:#413841}.popup-proof{width:338px}.wide-proof{width:716px}.equal-proof{width:568px}.session-proof{width:375px}.footer{position:absolute;bottom:17px;inset-inline:50px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#755b65;letter-spacing:.07em}.footer b{font-weight:600}.marker{width:36px;height:3px;background:#8b1230;border-radius:3px}html[dir=rtl] .caption{letter-spacing:0}html[lang=ja] .caption{font-size:37px}html[lang=hi] .caption{line-height:1.35;font-size:39px}.marquee .canvas{padding:40px 54px}.marquee .caption{font-size:52px;max-width:790px;min-height:0;line-height:1.16;margin:38px 0 24px}.marquee .summary{font-size:21px;line-height:1.6;max-width:740px;margin:0;color:#6a515b}.marquee .badge{display:none}.marquee .proofs{position:absolute;inset-inline-end:48px;top:60px;width:330px;height:455px}.marquee .promo-popup{width:310px}.marquee .image-frame{padding:10px}.marquee .proof img{max-height:430px}.marquee .frame-label{display:none}.marquee .brand-row{max-width:790px}.marquee .footer{bottom:24px}.small .canvas{padding:26px 28px}.small .brand{font-size:29px;gap:9px}.small .brand img{width:42px;height:42px}.small .version{font-size:10px}.small .badge{display:none}.small .caption{font-size:26px;line-height:1.2;margin:24px 0 20px;min-height:0;max-width:384px}.small .summary{font-size:15px;font-weight:550;color:#741d37;margin:0}.small .footer{inset-inline:29px;bottom:19px;font-size:9px}.small .proofs{display:none}.small[lang=ja] .caption{font-size:24px}.small[lang=hi] .caption{font-size:26px}.small[dir=rtl] .caption{line-height:1.4}
  </style></head><body class="${kind}"><div class="canvas"><header class="brand-row"><div class="brand"><img src="${icon}" alt="">BLOKU <span class="version">2.0</span></div><span class="badge">${escape(ui.free)}</span></header><h1 class="caption">${escape(title)}</h1>${kind !== 'screenshot' ? `<p class="summary">${escape(isSmall ? ui.free : copy.summary)}</p>` : ''}<div class="proofs">${proof}</div><footer class="footer"><b>bloku.app</b><span class="marker"></span></footer></div></body></html>`;
}

function jpegDimensions(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, 'Expected JPEG SOI');
  let cursor = 2;
  while (cursor + 4 < buffer.length) {
    assert.equal(buffer[cursor], 0xff, 'Malformed JPEG marker');
    while (buffer[cursor] === 0xff) cursor++;
    const marker = buffer[cursor++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = buffer.readUInt16BE(cursor);
    assert.ok(length >= 2 && cursor + length <= buffer.length, 'Invalid JPEG segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: buffer.readUInt16BE(cursor + 3), width: buffer.readUInt16BE(cursor + 5), channels: buffer[cursor + 7] };
    cursor += length;
  }
  throw new Error('JPEG dimensions not found');
}

async function verifyAssets(directory, requireAll = false) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW');
  assert.equal(manifest.version, '2.0.0');
  if (requireAll) assert.deepEqual(manifest.locales, LOCALES);
  assert.equal(manifest.images.length, manifest.locales.length * 7);
  assert.equal(new Set(manifest.images.map(item => item.path)).size, manifest.images.length);
  for (const item of [...manifest.images, ...manifest.rawCaptures]) {
    safePath(item.path);
    const bytes = await readFile(path.join(directory, item.path));
    assert.equal(sha256(bytes), item.sha256, `Image changed: ${item.path}`);
    if (item.path.endsWith('.jpg')) {
      const dimensions = jpegDimensions(bytes);
      assert.equal(dimensions.width, item.width); assert.equal(dimensions.height, item.height);
      assert.equal(dimensions.channels, 3, `Expected opaque RGB JPEG: ${item.path}`);
    }
  }
  for (const locale of manifest.locales) {
    assert.deepEqual(manifest.images.filter(item => item.locale === locale && item.kind === 'screenshot').map(item => item.basename), SHOTS.map(name => `${name}.jpg`));
    assert.equal(manifest.images.filter(item => item.locale === locale && item.kind === 'small').length, 1);
    assert.equal(manifest.images.filter(item => item.locale === locale && item.kind === 'marquee').length, 1);
  }
  for (const line of (await readFile(path.join(directory, 'SHA256SUMS'), 'utf8')).trim().split('\n')) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/); assert.ok(match, 'Malformed SHA256SUMS'); safePath(match[2]);
    assert.equal(sha256(await readFile(path.join(directory, match[2]))), match[1], `SHA256SUMS mismatch: ${match[2]}`);
  }
  console.log(`Verified ${manifest.images.length} JPEGs and ${manifest.rawCaptures.length} raw captures; package ${manifest.package.checksumsManifestSha256}`);
  return manifest;
}

async function capture(selected) {
  const source = await inputs(selected);
  let executablePath = process.env.BLOKU_CHROME_PATH;
  if (!executablePath) {
    const cache = path.join(B2, 'engine/.cache/browser/chrome');
    const build = (await readdir(cache)).filter(value => /156\./.test(value)).sort().at(-1);
    assert.ok(build, 'Cached Chrome for Testing 156 is required; this script does not download browsers.');
    executablePath = path.join(cache, build, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  }
  await mkdir(OUTPUT, { recursive: true });
  const work = await mkdtemp(path.join(OUTPUT, '.capture-'));
  const profile = path.join(work, '.browser-profile');
  const run = { status: 'LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW', version: '2.0.0', capturedAt: new Date().toISOString(), locales: selected, package: { checksumsManifestSha256: source.qualified.checksumsManifestSha256, manifestSha256: source.qualified.manifestSha256, filterRevision: source.qualified.filterRevision, excludedBrowserMetadata: source.qualified.excludedRuntimeFiles }, captions: Object.fromEntries(selected.map(locale => [locale, source.locales[locale].provenance])), logo: { path: 'B2/dist/icons/icon-128.png', sha256: source.iconSha256 }, screenshotsPerLocale: 5, images: [], rawCaptures: [], errors: [], blockedExternalRequests: [], limits: ['Controlled local fixture and synthetic user configuration only; no public-site effectiveness claim.', 'Screenshot composition frames unmodified rendered UI crops; the fixture is not a third-party website.', 'Not a store upload, publication, or independent extension qualification.', 'Font rendering and real session timestamps may vary across hosts; screenshots are checksum-tracked, not claimed byte reproducible.'], configuration: { theme: 'light, with dark mode for active focus', profileDomains: ['reading.bloku.test'], timedMinutes: 25, scheduleDays: [1, 2, 3, 4, 5], scheduleStart: '09:00', scheduleEnd: '17:00', dailyAllowanceMinutes: 30, youtubePresets: ['shorts', 'homefeed', 'recommendations'], activityEnabled: false } };
  run.renderer = { path: relative(SCRIPT), sha256: sha256(await readFile(SCRIPT)) };
  let browser, server, options, fixture, popup, compositor, extensionId, fixtureUrl, browserVersion, currentLocale = selected[0], finished = false, interrupted = false;
  const sessions = new Map();
  const interrupt = () => { interrupted = true; if (browser) void browser.close().catch(() => {}); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  async function instrument(target) {
    if (sessions.has(target)) return sessions.get(target);
    const promise = (async () => {
      if (!['page', 'service_worker'].includes(target.type())) return;
      const session = await target.createCDPSession();
      session.on('Fetch.requestPaused', async event => {
        try {
          const url = new URL(event.request.url);
          if (url.origin === new URL(fixtureUrl).origin || url.origin === `http://127.0.0.1:${server.address().port}`) await session.send('Fetch.continueRequest', { requestId: event.requestId });
          else { run.blockedExternalRequests.push({ locale: currentLocale, origin: url.origin, path: url.pathname }); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }); }
        } catch { /* Target may close during normal cleanup. */ }
      });
      await session.send('Fetch.enable', { patterns: [{ urlPattern: 'http://*' }, { urlPattern: 'https://*' }] });
      session.on('Runtime.exceptionThrown', event => run.errors.push({ locale: currentLocale, target: target.type(), message: event.exceptionDetails.exception?.description || event.exceptionDetails.text }));
      await session.send('Runtime.enable');
    })(); sessions.set(target, promise); return promise;
  }
  async function newPage(viewport) {
    const value = await browser.newPage(); await instrument(value.target()); await value.setViewport({ ...viewport, deviceScaleFactor: 1 });
    value.on('pageerror', error => run.errors.push({ locale: currentLocale, target: 'page', message: error.message }));
    return value;
  }
  async function request(action, payload) {
    const reply = await options.evaluate(({ action, payload }) => chrome.runtime.sendMessage({ type: 'BLOKU_V2', action, payload }), { action, payload });
    assert.equal(reply?.ok, true, `${action}: ${JSON.stringify(reply)}`); return reply;
  }
  async function update(change) { const { state } = await request('GET_STATE'); change(state); return request('UPDATE_STATE', state); }
  async function refreshOptions(section) {
    await options.bringToFront();
    await options.reload({ waitUntil: 'domcontentloaded' }); await options.waitForSelector('main h1');
    const index = ['protection', 'distractions', 'focus', 'rules', 'activity', 'about'].indexOf(section);
    assert.ok(index >= 0);
    await options.evaluate(() => scrollTo(0, 0));
    const center = await options.$eval(`nav button:nth-child(${index + 1})`, element => { const rect = element.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; });
    await options.mouse.click(center.x, center.y);
    await options.waitForFunction(text => document.querySelector('main h1')?.textContent === text, { polling: 100 }, source.locales[currentLocale].ui[section]);
    assert.equal(await options.$eval('html', element => element.lang), currentLocale.replace('_', '-'));
    assert.equal(await options.$eval('html', element => element.dir), currentLocale === 'ar' ? 'rtl' : 'ltr');
  }
  async function refreshPopup() {
    await fixture.bringToFront();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' }); await popup.waitForSelector('#app h1');
    assert.equal(await popup.$eval('html', element => element.lang), currentLocale.replace('_', '-'));
  }
  async function bounds(value, selector) {
    return value.$eval(selector, element => { const rect = element.getBoundingClientRect(); return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height }; });
  }
  async function raw(value, name, clip, note) {
    const filename = `${currentLocale}/raw/${name}.png`; const target = path.join(work, filename); await mkdir(path.dirname(target), { recursive: true });
    const normalized = Object.fromEntries(Object.entries(clip).map(([key, number]) => [key, Math.ceil(number)]));
    assert.ok(normalized.width > 0 && normalized.height > 0);
    const bytes = await value.screenshot({ path: target, type: 'png', clip: normalized, captureBeyondViewport: true, omitBackground: false });
    run.rawCaptures.push({ path: filename, locale: currentLocale, name, width: normalized.width, height: normalized.height, sha256: sha256(bytes), note });
    return pngData(bytes);
  }
  async function elementRaw(value, name, selector, note) { return raw(value, name, await bounds(value, selector), note); }
  async function renderImage(locale, name, kind, index, images) {
    const dimensions = kind === 'small' ? { width: 440, height: 280 } : kind === 'marquee' ? { width: 1400, height: 560 } : { width: 1280, height: 800 };
    await compositor.setViewport({ ...dimensions, deviceScaleFactor: 1 });
    await compositor.setContent(compositionHTML({ locale: source.locales[locale], item: name, icon: source.icon, images, index, kind }), { waitUntil: 'load' });
    await compositor.evaluate(() => document.fonts.ready);
    await compositor.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0), { polling: 100 });
    // Reduce only the marketing heading if a long translation exceeds its allocated area.
    await compositor.evaluate(kind => {
      const title = document.querySelector('.caption'); const limit = kind === 'small' ? 89 : kind === 'marquee' ? 185 : 103;
      let size = parseFloat(getComputedStyle(title).fontSize);
      while (title.getBoundingClientRect().height > limit && size > 19) { title.style.fontSize = `${--size}px`; }
    }, kind);
    const overflow = await compositor.evaluate(() => {
      const nodes = [...document.querySelectorAll('.caption,.summary,.brand,.badge,.proof,.footer')];
      return nodes.filter(node => { const rect = node.getBoundingClientRect(); return getComputedStyle(node).display !== 'none' && (rect.x < -1 || rect.y < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1 || node.scrollWidth > node.clientWidth + 2); }).map(node => node.className);
    });
    assert.deepEqual(overflow, [], `Composition overflow in ${locale}/${name}`);
    const filename = `${locale}/${name}.jpg`;
    const bytes = await compositor.screenshot({ path: path.join(work, filename), type: 'jpeg', quality: 90, fullPage: false, omitBackground: false });
    assert.deepEqual(jpegDimensions(Buffer.from(bytes)), { ...dimensions, channels: 3 });
    run.images.push({ path: filename, basename: `${name}.jpg`, locale, kind, ...dimensions, quality: 90, sha256: sha256(bytes), caption: kind === 'screenshot' ? source.locales[locale].copy.screenshotCaptions[index] : source.locales[locale].copy.title, rawSources: kind === 'small' ? [] : Object.keys(images).map(key => `${locale}/raw/${key}.png`) });
  }
  async function closedShadowText() {
    const session = await fixture.createCDPSession();
    try {
      const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
      const text = node => (node.nodeValue || '') + [...(node.children || []), ...(node.shadowRoots || [])].map(text).join(' ');
      return text(root);
    } finally { await session.detach(); }
  }
  try {
    server = http.createServer((req, res) => {
      if (req.method !== 'GET' || !['/', '/favicon.ico'].includes(req.url?.split('?')[0])) { res.writeHead(404); res.end(); return; }
      if (req.url.startsWith('/favicon.ico')) { res.writeHead(204); res.end(); return; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(fixtureHTML(source.locales[currentLocale]));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    fixtureUrl = `http://reading.bloku.test:${server.address().port}/`;
    browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-domain-reliability', '--host-resolver-rules=MAP *.bloku.test 127.0.0.1, MAP * ~NOTFOUND, EXCLUDE localhost'] });
    assert.equal(interrupted, false, 'Capture interrupted during browser startup');
    browserVersion = await browser.version(); assert.match(browserVersion, /(?:Chrome|HeadlessChrome)\/156\./, 'Capture browser must be the cached CFT 156'); run.browser = browserVersion;
    browser.on('targetcreated', target => { void instrument(target).catch(error => run.errors.push({ locale: currentLocale, target: target.type(), message: error.message })); });
    for (const target of browser.targets()) await instrument(target);
    const worker = await browser.waitForTarget(target => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'), { timeout: 30000 });
    extensionId = new URL(worker.url()).host;
    options = await newPage({ width: 940, height: 1250 }); await options.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' }); await options.waitForSelector('main h1');
    assert.equal((await request('GET_STATE')).engine?.ok, true, 'Packaged engine must initialize successfully');
    fixture = await newPage({ width: 680, height: 570 });
    popup = await newPage({ width: 380, height: 1100 });
    compositor = await newPage({ width: 1280, height: 800 });
    for (const locale of selected) {
      currentLocale = locale; const { ui } = source.locales[locale]; const images = {};
      await update(state => {
        state.preferences.locale = locale; state.preferences.theme = 'light'; state.preferences.adsEnabled = true; state.preferences.activityEnabled = false;
        state.sitePolicies = []; state.distractionRules = {}; state.userRulesText = '';
        state.distractionPresets = { 'youtube.com': ['shorts', 'homefeed', 'recommendations'] };
        state.focusProfiles = [{ id: 'store-focus', name: ui.focus, domains: ['reading.bloku.test'], enabled: false, schedules: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }], dailyAllowanceMinutes: 30 }];
      });
      await fixture.goto(fixtureUrl, { waitUntil: 'domcontentloaded' }); await fixture.bringToFront(); await refreshPopup();
      assert.equal(await popup.$eval('#app h1', element => element.textContent), 'reading.bloku.test', 'Popup must show the actual active fixture tab');
      const card = await bounds(popup, '#app>section:first-of-type');
      images.popup = await raw(popup, 'popup', { x: 0, y: 0, width: 380, height: card.y + card.height + 15 }, 'Actual popup header and current-site protection card; no request counter was fabricated or requested.');
      await refreshOptions('protection');
      const protection = await bounds(options, 'main');
      const filterBottom = await options.$eval('main section', section => { const labels = [...section.querySelectorAll('label')].filter(label => label.querySelector('input[type=checkbox]')); const last = labels[Math.min(6, labels.length - 1)]; return last.getBoundingClientRect().bottom + scrollY + 13; });
      images.protection = await raw(options, 'protection', { ...protection, height: filterBottom - protection.y }, 'Top of actual protection settings and packaged filter choices. Counts shown are the package list metadata.');
      await renderImage(locale, SHOTS[0], 'screenshot', 0, { popup: images.popup, protection: images.protection });
      await refreshOptions('distractions');
      const main = await bounds(options, 'main'), youtube = await bounds(options, 'main>section');
      images.presets = await raw(options, 'presets', { ...main, height: youtube.y + youtube.height - main.y }, 'Actual YouTube preset controls with synthetic user choices saved through UPDATE_STATE.');
      await fixture.bringToFront();
      const tabId = await options.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.id, fixtureUrl); assert.ok(tabId);
      await request('PICK_ELEMENT', { tabId }); await sleep(150);
      await fixture.$eval('#suggestion', element => element.scrollIntoView({ block: 'nearest' }));
      const suggestion = await fixture.$eval('#suggestion', element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y }; });
      await fixture.mouse.click(suggestion.x + 8, suggestion.y + 8);
      await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#suggestion')).display === 'none', { polling: 100 });
      const shadow = await closedShadowText(); assert.ok(shadow.includes(ui.confirmHide) && shadow.includes('#suggestion'), 'Real localized picker preview was not rendered');
      images.picker = await raw(fixture, 'picker', { x: 0, y: 0, width: 680, height: 570 }, 'Actual closed-shadow element-picker preview after selecting the suggestion on the owned HTTP article fixture. Not saved.');
      await fixture.keyboard.press('Escape'); await fixture.waitForFunction(() => getComputedStyle(document.querySelector('#suggestion')).display !== 'none', { polling: 100 });
      await renderImage(locale, SHOTS[1], 'screenshot', 1, { presets: images.presets, picker: images.picker });
      await update(state => { state.preferences.theme = 'dark'; });
      await fixture.bringToFront();
      const active = await request('START_FOCUS', { profileId: 'store-focus', minutes: 25 });
      const session = active.state.focusSessions.find(value => value.profileId === 'store-focus'); assert.ok(session);
      await fixture.waitForFunction(id => location.href.startsWith(`chrome-extension://${id}/blocked.html`), { timeout: 15000, polling: 100 }, extensionId); await fixture.waitForSelector('h1');
      assert.equal(await fixture.$eval('h1', element => element.textContent), ui.focusActive);
      await fixture.setViewport({ width: 790, height: 570, deviceScaleFactor: 1 });
      images.blocked = await elementRaw(fixture, 'blocked', '#app', 'Actual focus-blocked page content after START_FOCUS redirected the open fixture for 25 minutes; unused viewport space is cropped.');
      await refreshPopup(); images['active-popup'] = await elementRaw(popup, 'active-popup', '#app>section:nth-of-type(2)', 'Actual running session card, including observed remaining duration and break/end controls.');
      await renderImage(locale, SHOTS[2], 'screenshot', 2, { blocked: images.blocked, 'active-popup': images['active-popup'] });
      await request('END_FOCUS', { sessionId: session.id });
      await update(state => { state.preferences.theme = 'light'; state.focusProfiles[0].enabled = true; });
      await refreshOptions('focus');
      const profileBox = await bounds(options, 'section.profile');
      const allowanceBottom = await options.$eval('section.profile input[type=number]', element => element.closest('label').getBoundingClientRect().bottom + scrollY);
      images.profile = await raw(options, 'profile', { ...profileBox, height: allowanceBottom - profileBox.y + 15 }, 'Upper portion of the actual saved focus profile: domain, enabled schedule, and 30-minute daily allowance.');
      const scheduleBox = await bounds(options, 'section.profile .inline-fields');
      images.schedule = await raw(options, 'schedule', { x: profileBox.x, y: scheduleBox.y - 10, width: profileBox.width, height: profileBox.y + profileBox.height - scheduleBox.y + 10 }, 'Lower portion of the same actual saved profile: weekday schedule and timed-session controls.');
      await renderImage(locale, SHOTS[3], 'screenshot', 3, { profile: images.profile, schedule: images.schedule });
      await update(state => { state.focusProfiles[0].enabled = false; state.userRulesText = 'reading.bloku.test##.suggestion'; });
      await refreshOptions('rules'); images.rules = await elementRaw(options, 'rules', 'main', 'Actual local rules and export/import settings controls.');
      await refreshOptions('about'); images.about = await elementRaw(options, 'about', 'main', 'Actual About view and installed filtering-engine revision.');
      await renderImage(locale, SHOTS[4], 'screenshot', 4, { rules: images.rules, about: images.about });
      await renderImage(locale, 'promo-small-440x280', 'small', 0, {});
      await renderImage(locale, 'promo-marquee-1400x560', 'marquee', 0, { popup: images.popup });
      await fixture.setViewport({ width: 680, height: 570, deviceScaleFactor: 1 });
      console.log(`Captured ${locale}: five 1280×800 screenshots and both promotional sizes.`);
    }
    assert.deepEqual(run.errors, [], 'Unexpected runtime or rendering errors during capture');
    assert.deepEqual(run.blockedExternalRequests, [], 'Unexpected external network attempt during controlled capture');
    const after = await inputs(selected);
    assert.equal(after.qualified.checksumsManifestSha256, source.qualified.checksumsManifestSha256, 'Built package changed while capturing');
    for (const locale of selected) assert.deepEqual(after.locales[locale].provenance, source.locales[locale].provenance, `Caption or locale changed while capturing ${locale}`);
    assert.equal(sha256(await readFile(SCRIPT)), run.renderer.sha256, 'Capture renderer changed while running');
    run.completedAt = new Date().toISOString();
    await writeFile(path.join(work, 'manifest.json'), `${JSON.stringify(run, null, 2)}\n`);
    const manifestBytes = await readFile(path.join(work, 'manifest.json'));
    const lines = [...run.images, ...run.rawCaptures].map(item => `${item.sha256}  ${item.path}`); lines.push(`${sha256(manifestBytes)}  manifest.json`);
    await writeFile(path.join(work, 'SHA256SUMS'), `${lines.sort().join('\n')}\n`);
    await verifyAssets(work, selected.length === LOCALES.length);
    finished = true;
  } catch (error) {
    run.failure = String(error.stack || error); run.browser = browserVersion;
    await writeFile(path.join(work, 'failure.json'), `${JSON.stringify(run, null, 2)}\n`);
    throw error;
  } finally {
    try { if (browser) await browser.close(); }
    finally {
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      await rm(profile, { recursive: true, force: true });
      process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
    }
    const prefix = finished ? `bloku-2.0.0-${source.qualified.checksumsManifestSha256.slice(0, 12)}` : 'failed-capture';
    const destination = path.join(OUTPUT, `${prefix}-${path.basename(work).replace('.capture-', '')}`);
    await rename(work, destination);
    console.log(`${finished ? 'Assets' : 'Failure evidence'}: ${relative(destination)}`);
    console.log('Owned browser, HTTP server, and isolated profile cleaned up.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--check-only' && args.length === 1) {
    const value = await inputs(); console.log(`Ready: eight caption sets; ${value.qualified.entries.length} checked package files; SHA-256 ${value.qualified.checksumsManifestSha256}. No browser launched.`); return;
  }
  if (args[0] === '--verify' && args[1]) {
    const manifest = await verifyAssets(path.resolve(args[1]), args.includes('--require-all'));
    const current = await inputs(manifest.locales);
    assert.equal(current.qualified.checksumsManifestSha256, manifest.package.checksumsManifestSha256, 'Assets refer to a different built package. Recapture after the package is frozen.');
    for (const locale of manifest.locales) assert.deepEqual(current.locales[locale].provenance, manifest.captions[locale], `Caption or locale changed after capture: ${locale}`);
    if (manifest.renderer) assert.equal(sha256(await readFile(SCRIPT)), manifest.renderer.sha256, 'Capture renderer differs from the recorded version.');
    return;
  }
  if (args[0] === '--capture') {
    const index = args.indexOf('--locales'); const selected = index < 0 ? LOCALES : args[index + 1]?.split(',');
    assert.ok(selected?.length && new Set(selected).size === selected.length && selected.every(locale => LOCALES.includes(locale)), 'Use --locales en,ar or omit for all eight.');
    assert.ok(args.every((arg, position) => position === 0 || (index >= 0 && [index, index + 1].includes(position))), 'Unknown capture argument');
    await capture(selected); return;
  }
  console.log('Usage: node B2/scripts/v2-store-assets.mjs --check-only | --capture [--locales en,ar] | --verify <artifact-directory> [--require-all]');
  console.log('Run --capture only after the coordinator grants the shared browser lane. No external upload or publication occurs.');
  if (args.length) process.exitCode = 1;
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
