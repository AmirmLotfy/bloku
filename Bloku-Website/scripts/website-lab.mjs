// Bounded local lab; requires the adjacent extension source's existing puppeteer-core.
// It never builds, deploys, visits payment providers, or uses an account profile.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireB2 = createRequire(path.join(root, "../B2/package.json"));
const puppeteer = requireB2("puppeteer-core");
const phase = process.argv[2];
assert.ok(["before", "after"].includes(phase), "Use before or after; start the fixed local preview server separately.");
const origin = "http://127.0.0.1:4176";
const output = process.env.BLOKU_WEBSITE_LAB_OUTPUT ? path.resolve(process.env.BLOKU_WEBSITE_LAB_OUTPUT) : path.join(root, "artifacts/website-lab");
await fs.mkdir(output, { recursive: true });
const profile = await fs.mkdtemp(path.join(output, ".profile-"));
const cache = path.join(root, "../B2/engine/.cache/browser/chrome");
const build = (await fs.readdir(cache)).find(name => name.includes("156.0.8078.80"));
assert.ok(build, "The already verified Chrome for Testing 156 cache is required; no download is performed.");
const executablePath = path.join(cache, build, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const product = JSON.parse(await fs.readFile(path.join(root, "../shared/product.json"), "utf8"));
const report = {
  phase, observedAt: new Date().toISOString(), status: "RUNNING",
  method: { tool: "Puppeteer/CDP and buffered PerformanceObserver", lighthouse: "Not run: npm lighthouse 13.6.0 requires Node >=22.19; host Node 22.13.1.", viewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, cpuSlowdown: 4, network: { latencyMs: 150, downloadBytesPerSecond: 200000, uploadBytesPerSecond: 93750 }, repeats: 3, paths: ["/", "/ar", "/support", "/ar/support"], cache: "New isolated browser context per sample, cache disabled, service workers bypassed", observation: "Until load event plus 2 seconds without input or scroll; CLS uses maximum session window", host: "Local uncompressed static preview; all external page requests blocked and recorded" },
  limits: ["Local mobile emulation on one host, not a real mobile device or public CDN/TLS/compression measurement.", "Small sequential before/after samples include content/layout changes; order and host load can affect timings.", "No Lighthouse score, field CWV, INP, universal speedup or ranking claim is established.", "Optional funding destinations are inspected as hrefs only; no payment navigation or transaction occurs."],
  dist: {}, samples: [], surfaces: [], externalRequests: [], consoleErrors: [], pageErrors: [], cleanup: {},
};
for (const file of ["index.html", "ar/index.html", "support.html", "ar/support.html"]) report.dist[file] = hash(await fs.readFile(path.join(root, "dist", file)));
let browser;
async function instrument(page, label) {
  page.on("console", message => { if (message.type() === "error") report.consoleErrors.push({ label, message: message.text() }); });
  page.on("pageerror", error => report.pageErrors.push({ label, message: error.message }));
  await page.setRequestInterception(true);
  page.on("request", request => {
    const url = new URL(request.url());
    if (["data:", "blob:"].includes(url.protocol) || url.origin === origin) void request.continue();
    else { report.externalRequests.push({ label, origin: url.origin, path: url.pathname }); void request.abort("blockedbyclient"); }
  });
}
try {
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: profile, args: ["--disable-extensions", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1"] });
  report.browser = await browser.version();
  report.node = process.version;
  for (let repeat = 1; repeat <= 3; repeat++) for (const route of report.method.paths) {
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await instrument(page, `${route}#${repeat}`);
      await page.setViewport(report.method.viewport);
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
      const cdp = await page.createCDPSession();
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.setBypassServiceWorker", { bypass: true });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: "cellular3g" });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.evaluateOnNewDocument(() => {
        window.__lab = { lcp: null, shifts: [] };
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__lab.lcp = { startTime: entry.startTime, size: entry.size, tag: entry.element?.tagName, className: entry.element?.className }; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__lab.shifts.push({ at: entry.startTime, value: entry.value }); }).observe({ type: "layout-shift", buffered: true });
      });
      const response = await page.goto(origin + route, { waitUntil: "load", timeout: 45000 });
      assert.equal(response.status(), 200);
      await new Promise(resolve => setTimeout(resolve, 2000));
      const metrics = await page.evaluate(() => {
        const shifts = window.__lab.shifts;
        let max = 0, sum = 0, start = 0, last = 0;
        for (const shift of shifts) { if (!sum || shift.at - last >= 1000 || shift.at - start >= 5000) { sum = shift.value; start = shift.at; } else sum += shift.value; last = shift.at; max = Math.max(max, sum); }
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource").map(entry => ({ path: new URL(entry.name).pathname, bytes: entry.encodedBodySize, transferBytes: entry.transferSize, durationMs: entry.duration }));
        return { lcpMs: window.__lab.lcp?.startTime ?? null, lcpElement: window.__lab.lcp, cls: max, layoutShifts: shifts, dclMs: nav.domContentLoadedEventEnd, loadMs: nav.loadEventEnd, documentBytes: nav.encodedBodySize, resources, totalEncodedBytes: nav.encodedBodySize + resources.reduce((sum, resource) => sum + resource.bytes, 0) };
      });
      assert.notEqual(metrics.lcpMs, null, "LCP observation must exist");
      report.samples.push({ path: route, repeat, ...metrics });
      console.log(`${phase} ${route} ${repeat}/3 LCP=${Math.round(metrics.lcpMs)}ms CLS=${metrics.cls.toFixed(5)} bytes=${metrics.totalEncodedBytes}`);
    } finally { await context.close(); }
  }
  if (phase === "after") for (const locale of product.locales) for (const kind of ["home", "support"]) for (const mobile of [false, true]) {
    const context = await browser.createBrowserContext();
    const route = `/${[locale.path, kind === "support" ? "support" : ""].filter(Boolean).join("/")}`;
    const label = `${locale.code}/${kind}/${mobile ? "mobile" : "desktop"}`;
    try {
      const page = await context.newPage(); await instrument(page, label);
      await page.setViewport(mobile ? report.method.viewport : { width: 1280, height: 900 });
      await page.goto(origin + route, { waitUntil: "networkidle0" });
      if (["en", "ar"].includes(locale.code)) await page.screenshot({ path: path.join(output, `${locale.code}-${kind}-${mobile ? "mobile" : "desktop"}.png`) });
      // Trigger actual lazy images; do not replace native dimensions or apply CSS zoom.
      for (const image of await page.$$("img")) { await image.scrollIntoView(); await image.evaluate(element => element.decode()); }
      const state = await page.evaluate(({ product, locale, kind }) => {
        const errors = [];
        if (document.documentElement.lang !== locale.tag || document.documentElement.dir !== locale.dir) errors.push("language/direction");
        if (document.documentElement.scrollWidth > innerWidth + 1) errors.push("horizontal overflow");
        if (![...document.images].every(image => image.complete && image.naturalWidth > 0)) errors.push("image load");
        if (!document.querySelector(`footer a[href="${product.sourceUrl}"]`)) errors.push("source link");
        if (document.querySelectorAll(`a[href="${product.fundingUrl}"]`).length !== (kind === "support" ? 2 : 1)) errors.push("funding links");
        if (document.querySelectorAll("iframe,form,script[src*='paypal']").length) errors.push("payment embed");
        if (!document.querySelector(`footer a[href="${product.publisherUrl}"]`)) errors.push("publisher link");
        const tilted = [...document.querySelectorAll(".product-capture,.demo,.support-aside>section")].filter(element => { const t = getComputedStyle(element).transform; if (t === "none") return false; const m = new DOMMatrix(t); return Math.abs(m.b) > .0001 || Math.abs(m.c) > .0001; });
        if (tilted.length) errors.push("tilted cards");
        return { errors, lang: document.documentElement.lang, dir: document.documentElement.dir, images: document.images.length, width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
      }, { product, locale, kind });
      // Real Tab navigation verifies the new links remain keyboard reachable and indicated.
      await page.goto(origin + route, { waitUntil: "networkidle0" });
      const seen = new Set();
      for (let i = 0; i < 90 && seen.size < 2; i++) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(({ sourceUrl, fundingUrl }) => {
          const element = document.activeElement;
          if (!element?.matches("a")) return null;
          const href = element.href;
          if (![sourceUrl, fundingUrl].includes(href)) return null;
          const style = getComputedStyle(element);
          return { href, indicated: element.matches(":focus-visible") && parseFloat(style.outlineWidth) >= 2 && style.outlineStyle !== "none" };
        }, product);
        if (focus) { assert.ok(focus.indicated, `${label} link focus indicator`); seen.add(focus.href); }
      }
      if (seen.size !== 2) state.errors.push("new links unreachable by Tab");
      report.surfaces.push({ label, ...state, keyboardLinks: seen.size, status: state.errors.length ? "FAIL" : "PASS" });
      console.log(`${state.errors.length ? "FAIL" : "PASS"} ${label}${state.errors.length ? ` ${state.errors.join(",")}` : ""}`);
    } finally { await context.close(); }
  }
  assert.equal(report.externalRequests.length, 0, "No page-origin external requests expected, including PayPal");
  assert.equal(report.consoleErrors.length + report.pageErrors.length, 0, "No console/runtime errors expected");
  assert.ok(report.surfaces.every(surface => surface.status === "PASS"), "Surface failures must be addressed");
  report.status = "PASS — LOCAL LAB ONLY";
} catch (error) { report.status = "FAIL"; report.error = error.message; process.exitCode = 1; }
finally {
  if (browser) { await browser.close(); report.cleanup.browserClosed = true; }
  await fs.rm(profile, { recursive: true, force: true }); report.cleanup.ownedProfileRemoved = true;
  await fs.writeFile(path.join(output, `${phase}.json`), JSON.stringify(report, null, 2) + "\n");
}
