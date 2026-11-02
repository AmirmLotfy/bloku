import { readFile, writeFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generated = path.join(root, 'engine/gate-generated');
const extension = path.join(generated, 'extension');
await cp(path.join(generated, 'runtime'), extension, { recursive: true });
const rules = JSON.parse(await readFile(path.join(generated, 'rule-resources.json'), 'utf8'));
await build({ entryPoints: [path.join(root, 'engine/gate-worker.ts')], outfile: path.join(extension, 'worker.js'), bundle: true, format: 'esm', target: 'chrome145', legalComments: 'external', logLevel: 'silent', plugins: [{ name: 'gate-assets', setup(plugin) { plugin.onResolve({ filter: /^\.\/generated\// }, args => ({ path: path.join(generated, path.basename(args.path)) })); } }] });
const manifest = {
  manifest_version: 3, name: 'Bloku isolated engine acceptance gate', version: '2.0.0', minimum_chrome_version: '145',
  permissions: ['declarativeNetRequest', 'scripting', 'storage', 'unlimitedStorage', 'webRequest', 'webNavigation', 'activeTab'],
  host_permissions: ['http://*/*', 'https://*/*'],
  background: { service_worker: 'worker.js', type: 'module' },
  action: {},
  content_scripts: [{ matches: ['http://*/*', 'https://*/*'], js: ['engine/content-script.js'], run_at: 'document_start', all_frames: true }],
  declarative_net_request: { rule_resources: rules },
  web_accessible_resources: [{ resources: ['engine/war/redirects/*', 'engine/assistant.js'], matches: ['http://*/*', 'https://*/*'] }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2));
await writeFile(path.join(extension, 'blocked.html'), '<!doctype html><title>Focus blocked</title><h1>Focus is active</h1>');
await writeFile(path.join(extension, 'probe.html'), '<!doctype html><title>Engine probe</title>');
const requests = [];
const server = http.createServer((req, res) => {
  requests.push({ host: req.headers.host, path: req.url });
  if (req.url.endsWith('.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end('window.fixtureScript = true;'); }
  else if (req.url.endsWith('.png')) { res.setHeader('Content-Type', 'image/png'); res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64')); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Local fixture</title><div class="bloku-cosmetic-fixture">Hide this</div><div id="keep">Keep this</div>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const cache = path.join(root, 'engine/.cache/browser/chrome');
const builds = process.env.BLOKU_CHROME_PATH ? [] : await readdir(cache);
const executablePath = process.env.BLOKU_CHROME_PATH || path.join(cache, builds.sort().at(-1), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const results = [];
let browser;
async function check(name, task) { const start = Date.now(); await task(); results.push({ name, pass: true, ms: Date.now() - start }); console.log(`PASS ${name}`); }
try {
  await rm(path.join(generated, 'browser-profile'), { recursive: true, force: true });
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: path.join(generated, 'browser-profile'), args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--host-resolver-rules=MAP *.bloku.test 127.0.0.1, MAP *.bloku-ads.test 127.0.0.1, MAP *.bloku-track.test 127.0.0.1'] });
  const workerTarget = await browser.waitForTarget(target => target.type() === 'service_worker', { timeout: 30_000 });
  const worker = await workerTarget.worker();
  worker.on('console', message => { if (message.type() === 'error') console.log(`ENGINE ${message.text().slice(0, 400)}`); });
  const extensionId = new URL(workerTarget.url()).host;
  const start = await worker.evaluate(() => globalThis.blokuGateReady);
  if (!start.ok) console.log('START DIAGNOSTIC', await worker.evaluate(async () => ({ status: globalThis.blokuGate.getStatus(), url: chrome.runtime.getURL('engine/rulesets/ruleset_0/ruleset_0.json'), fetch: await fetch(chrome.runtime.getURL('engine/rulesets/ruleset_0/ruleset_0.json')).then(r => ({ status: r.status, length: r.headers.get('content-length') })).catch(e => String(e)) })));
  assert.equal(start.ok, true, JSON.stringify(start));
  const base = { adsEnabled: true, siteExceptions: [], focusDomains: [], userRules: '', enabledLists: ['gate'] };
  const apply = async patch => { const result = await worker.evaluate(input => globalThis.blokuGate.apply(input), { ...base, ...patch }); assert.equal(result.ok, true, JSON.stringify(result)); return result; };
  const page = await browser.newPage();
  const go = async host => { try { await page.goto(`http://${host}:${port}/`, { waitUntil: 'domcontentloaded', timeout: 15_000 }); } catch (error) { if (!String(error).includes('ERR_BLOCKED_BY_CLIENT') && !String(error).includes('ERR_ABORTED')) throw error; } };
  const load = async (host, suffix, type) => page.evaluate(({ url, type }) => new Promise(resolve => { const element = document.createElement(type); element.onload = () => resolve(true); element.onerror = () => resolve(false); element.src = url; document.body.append(element); }), { url: `http://${host}:${port}/${suffix}`, type });
  const expectBlockedPage = async host => { await go(host); await page.waitForFunction(id => location.href.startsWith(`chrome-extension://${id}/blocked.html`), { timeout: 10_000 }, extensionId); };

  await check('SDK starts without cookies, userScripts or feedback permissions', async () => assert.equal(start.ok, true));
  await check('third-party script blocks; scoped exception allows', async () => { await go('site.bloku.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), false); assert.equal(await load('ad.bloku-ads.test', 'allowed.js', 'script'), true); });
  await check('first-party script is preserved', async () => { await go('ad.bloku-ads.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), true); });
  await check('initiator scope and excluded resource type are preserved', async () => { await go('site.bloku.test'); assert.equal(await load('tracker.bloku-track.test', 'tracker.png', 'img'), false); await go('other.bloku.test'); assert.equal(await load('tracker.bloku-track.test', 'tracker.png', 'img'), true); assert.equal(await load('scoped.bloku.test', 'image.png', 'img'), true); assert.equal(await load('scoped.bloku.test', 'script.js', 'script'), false); });
  await check('packaged cosmetic, raw script and scriptlet execute locally', async () => { await go('site.bloku.test'); await page.waitForFunction(() => getComputedStyle(document.querySelector('.bloku-cosmetic-fixture')).display === 'none' && window.blokuPackagedScriptRan === true && window.blokuPackagedScriptletRan === true, { timeout: 10_000 }); });
  await check('focus beats packaged important exception', async () => { await apply({ focusDomains: ['focus.bloku.test'] }); await expectBlockedPage('focus.bloku.test'); });
  await check('focus beats exact site and destination-scoped important exceptions', async () => { await apply({ focusDomains: ['focus.bloku.test'], siteExceptions: ['focus.bloku.test'], userRules: '@@$document,important,to=focus.bloku.test' }); await expectBlockedPage('focus.bloku.test'); });
  await check('focus beats packaged and local important redirects', async () => { await apply({ focusDomains: ['redirect-focus.bloku.test'], userRules: '||redirect-focus.bloku.test^$important,redirect=nooptext' }); await expectBlockedPage('redirect-focus.bloku.test'); });
  await check('focus beats parent site and user exceptions without changing siblings', async () => { await apply({ focusDomains: ['focus.parent.bloku.test'], siteExceptions: ['parent.bloku.test'], userRules: '@@||parent.bloku.test^$important' }); await expectBlockedPage('focus.parent.bloku.test'); await go('sibling.parent.bloku.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), true); });
  await check('pausing ads preserves focus; stopping focus restores exceptions', async () => { await apply({ adsEnabled: false, focusDomains: ['focus.bloku.test'] }); await expectBlockedPage('focus.bloku.test'); await go('site.bloku.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), true); await apply({ siteExceptions: ['parent.bloku.test'] }); await go('focus.parent.bloku.test'); assert.match(page.url(), /^http:/); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), true); });
  await check('invalid rule conversion restores last confirmed filtering', async () => { await apply({}); const result = await worker.evaluate(input => globalThis.blokuGate.apply(input), { ...base, userRules: '||bad.bloku.test^$totally-unknown-modifier' }); assert.equal(result.ok, false); assert.equal(result.restored, true, JSON.stringify(result)); await go('site.bloku.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), false); });
  await check('regex quota failure restores confirmed state', async () => { const userRules = Array.from({ length: 1001 }, (_, index) => `/bloku-quota-${index}\\.js/$script`).join('\n'); const result = await worker.evaluate(input => globalThis.blokuGate.apply(input), { ...base, userRules }); assert.equal(result.ok, false); assert.equal(result.restored, true, JSON.stringify(result)); await go('site.bloku.test'); assert.equal(await load('ad.bloku-ads.test', 'ad.js', 'script'), false); });
  await check('complete pinned real lists initialize and keep focus enforceable', async () => { await apply({ enabledLists: ['base', 'privacy'], focusDomains: ['focus.bloku.test'] }); await expectBlockedPage('focus.bloku.test'); });
  await check('complete optimized base fits guaranteed static capacity and enforces focus', async () => { const catalog = JSON.parse(await readFile(path.join(generated, 'catalog.json'), 'utf8')); assert.ok(catalog.find(list => list.id === 'base-optimized').ruleCount <= 30_000); await apply({ enabledLists: ['base-optimized'], focusDomains: ['focus.bloku.test'] }); await expectBlockedPage('focus.bloku.test'); });
  const catalog = JSON.parse(await readFile(path.join(generated, 'catalog.json'), 'utf8'));
  for (const list of catalog.filter(list => list.id.startsWith('region-') || list.id === 'annoyances')) await check(`${list.id} complete pack loads with optimized base and focus`, async () => { await apply({ enabledLists: ['base-optimized', list.id], focusDomains: ['focus.bloku.test'] }); await expectBlockedPage('focus.bloku.test'); });
  await writeFile(path.join(generated, 'gate-results.json'), JSON.stringify({ browser: await browser.version(), sdk: '6.0.1', results, complete: true }, null, 2));
} catch (error) {
  await writeFile(path.join(generated, 'gate-results.json'), JSON.stringify({ results, complete: false, error: String(error) }, null, 2));
  throw error;
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
