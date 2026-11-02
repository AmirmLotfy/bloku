import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import {
  product,
  copies,
  pagePath,
  render,
  serialize,
} from "../.ssr/entry-server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "dist/route-manifest.json"), "utf8"),
);
const documents = new Map();
for (const route of manifest)
  documents.set(
    route.path,
    new JSDOM(await fs.readFile(path.join(root, "dist", route.file), "utf8"), {
      url: route.canonical,
    }).window.document,
  );

test("all eight locales have complete, nonempty copy and every feature", () => {
  assert.equal(product.locales.length, 8);
  const keys = (value) =>
    typeof value === "string"
      ? "text"
      : Array.isArray(value)
        ? value.map(keys)
        : Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, keys(v)]),
          );
  const shape = keys(copies.en);
  const checkText = (value) => {
    if (typeof value === "string") assert.ok(value.trim());
    else Object.values(value).forEach(checkText);
  };
  for (const locale of product.locales) {
    assert.deepEqual(
      keys(copies[locale.code]),
      shape,
      `${locale.code} has missing copy`,
    );
    checkText(copies[locale.code]);
    assert.equal(copies[locale.code].features.length, 4);
    if (locale.code !== "en")
      assert.notEqual(
        copies[locale.code].meta.homeTitle,
        copies.en.meta.homeTitle,
      );
  }
});

test("each route ships its own visible content, SEO, canonical, language, and direction without JavaScript", () => {
  assert.equal(manifest.length, 96);
  for (const route of manifest) {
    const doc = documents.get(route.path);
    const locale = product.locales.find((item) => item.code === route.locale);
    assert.equal(doc.documentElement.lang, locale.tag, route.path);
    assert.equal(doc.documentElement.dir, locale.dir, route.path);
    assert.equal(doc.querySelectorAll("h1").length, 1, route.path);
    assert.ok(
      doc.querySelector("main h1").textContent.trim().length > 0 &&
      doc.querySelector("main p").textContent.trim().length > 0,
      route.path,
    );
    assert.equal(
      doc.querySelector("link[rel=canonical]").href,
      route.canonical,
    );
    assert.equal(
      doc.querySelector('meta[property="og:url"]').content,
      route.canonical,
    );
    assert.ok(doc.title.includes("BLOKU"), route.path);
    assert.ok(doc.querySelector("meta[name=description]").content.length > 20);
    assert.equal(
      doc.querySelector("meta[name=robots]").content,
      route.indexable ? "index, follow" : "noindex, follow",
    );
    assert.equal(doc.querySelectorAll("meta[name=robots]").length, 1);
    assert.equal(doc.querySelectorAll("link[rel=canonical]").length, 1);
    assert.ok(!doc.documentElement.outerHTML.includes("<!--app-"), route.path);
  }
});

test("localized alternate links preserve page identity and are reciprocal", () => {
  for (const route of manifest.filter((item) => item.page !== "not-found")) {
    const doc = documents.get(route.path);
    const alternates = [
      ...doc.querySelectorAll("link[rel=alternate][hreflang]"),
    ];
    assert.equal(alternates.length, 9, route.path);
    for (const locale of product.locales) {
      const target = pagePath(locale.code, route.page);
      const link = alternates.find((item) => item.hreflang === locale.tag);
      assert.equal(link.href, `${product.siteUrl}${target}`);
      const targetDoc = documents.get(target);
      assert.ok(
        targetDoc.querySelector(
          `link[rel=alternate][href="${route.canonical}"]`,
        ),
        `${route.path} is not reciprocal`,
      );
    }
    assert.equal(
      alternates.find((item) => item.hreflang === "x-default").href,
      `${product.siteUrl}${pagePath("en", route.page)}`,
    );
  }
});

test("every local navigation destination and fragment resolves, including help anchors", () => {
  for (const route of manifest) {
    const doc = documents.get(route.path);
    for (const anchor of doc.querySelectorAll("a[href]")) {
      const url = new URL(anchor.href);
      if (url.origin !== product.siteUrl) continue;
      const target = documents.get(url.pathname);
      assert.ok(target, `${route.path} links to missing ${url.pathname}`);
      if (url.hash)
        assert.ok(
          target.getElementById(decodeURIComponent(url.hash.slice(1))),
          `${route.path} missing fragment ${url.href}`,
        );
    }
    const switches = doc.querySelectorAll("[role=switch]");
    for (const control of switches) {
      assert.ok(control.getAttribute("aria-label"));
      assert.match(control.getAttribute("aria-checked"), /^(true|false)$/);
    }
  }
});

test("no legacy checkout, analytics, fabricated rating, search schema, or unexpected payment integration is published", () => {
  for (const route of manifest) {
    const doc = documents.get(route.path);
    assert.doesNotMatch(
      doc.documentElement.outerHTML,
      /googletagmanager|google-analytics|gtag\(|aggregateRating|ratingValue|SearchAction|Install &amp; Subscribe|\$4\.99|\$39\.99|enterprise-grade|ML-powered|1000/,
    );
    for (const link of doc.querySelectorAll("a[href]"))
      assert.doesNotMatch(link.href, /checkout|polar\.sh|sponsors/);
    for (const script of doc.querySelectorAll("script[src]"))
      assert.equal(new URL(script.src).origin, product.siteUrl);
    const json = JSON.parse(
      doc.querySelector('script[type="application/ld+json"]').textContent,
    );
    assert.ok(json);
    if (route.page === "home") {
      const software = json.find(
        (item) => item["@type"] === "SoftwareApplication",
      );
      assert.equal(software.offers.price, "0");
      assert.equal(software.downloadUrl, undefined, "Do not advertise a 2.0 download while Store approval is pending");
      assert.equal(software.offers.availability, "https://schema.org/PreOrder");
      assert.match(software.creativeWorkStatus, /approval pending/);
    }
    if (route.page === "bye")
      assert.equal(
        doc.querySelectorAll("form").length,
        0,
        "No feedback form without a backend",
      );
  }
});

test("each locale clearly distinguishes the 2.0 website from the currently available Store version", () => {
  for (const route of manifest) {
    const doc = documents.get(route.path);
    const notice = doc.querySelector('.release-availability');
    assert.ok(notice?.textContent.includes('1.1.3'), route.path);
    assert.ok(notice.textContent.includes('2.0'), route.path);
    assert.ok(notice.textContent.includes('Google'), route.path);
    for (const action of doc.querySelectorAll(`a.button[href="${product.storeUrl}"]`))
      assert.ok(![copies[route.locale].nav.install, copies[route.locale].bye.reinstall].includes(action.textContent.trim()), route.path);
    if (route.page === 'privacy') {
      assert.equal(doc.querySelectorAll('.document-sections section').length, 8);
      assert.ok(doc.querySelector('.document-sections').textContent.includes('support@bloku.app'));
    }
  }
});

test("all locales expose accurate compatibility, source and optional external support without payment embeds", () => {
  assert.equal(product.minimumChromeVersion, 145);
  assert.equal(product.license, "GPL-3.0-only");
  assert.equal(product.sourceUrl, "https://github.com/AmirmLotfy/bloku");
  assert.equal(product.fundingUrl, "https://www.paypal.com/ncp/payment/H2Y4B9EM6CF5C");
  assert.equal("sponsorsUrl" in product, false);
  for (const route of manifest) {
    const doc = documents.get(route.path);
    const copy = copies[route.locale];
    const source = doc.querySelector(`footer a[href="${product.sourceUrl}"]`);
    assert.equal(source?.textContent, copy.details.sourceLink, route.path);
    const funding = [...doc.querySelectorAll(`a[href="${product.fundingUrl}"]`)];
    assert.equal(funding.length, route.page === "support" ? 2 : 1, route.path);
    for (const link of funding) {
      assert.equal(link.textContent, copy.details.fundingTitle, route.path);
      assert.equal(link.target, "_blank");
      assert.ok(link.relList.contains("noopener"));
      assert.ok(link.relList.contains("noreferrer"));
    }
    assert.equal(doc.querySelector(".compatibility")?.textContent, copy.details.compatibility.replace("{version}", "145"));
    assert.equal(doc.querySelectorAll("iframe, form, script[src*='paypal'], link[href*='paypal']").length, 0, route.path);
    if (route.page === "support") {
      const section = doc.querySelector("main #optional-support");
      assert.ok(section?.textContent.includes(copy.details.fundingBody));
      assert.ok(!section.querySelector(".button-primary"), "Support must stay a secondary text link");
    }
    if (route.page === "privacy") {
      assert.ok(doc.querySelector("main").textContent.includes(copy.details.fundingPrivacyBody));
      assert.equal(doc.querySelector(`main a[href="${product.fundingPrivacyUrl}"]`)?.textContent, copy.details.paypalPolicy);
    }
    if (route.page === "terms") assert.ok(doc.querySelector("main").textContent.includes(copy.details.licenseBody));
    if (route.page === "home") assert.match(doc.title, /Chrome/);
  }
});

test("brand derivatives retain the original artwork provenance and fit their published use", async () => {
  const provenance = JSON.parse(await fs.readFile(path.join(root, "scripts/branding-provenance.json"), "utf8"));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const original = await fs.readFile(path.join(root, provenance.source.path));
  assert.equal(digest(original), "f191e688ae0f8bbbff20bd9796ae68c60b73adb8030a34110d00b9d4b5768331");
  assert.equal(provenance.source.sha256, digest(original));
  let totalBytes = 0;
  for (const asset of provenance.files) {
    const bytes = await fs.readFile(path.join(root, asset.path));
    const published = await fs.readFile(path.join(root, "dist", asset.path.replace(/^public\//, "")));
    assert.deepEqual(published, bytes, asset.path);
    assert.equal(digest(bytes), asset.sha256, asset.path);
    totalBytes += bytes.length;
    if (asset.path.endsWith(".png")) {
      assert.equal(bytes.subarray(1, 4).toString(), "PNG");
      assert.equal(bytes.readUInt32BE(16), asset.width);
      assert.equal(bytes.readUInt32BE(20), asset.height);
    } else {
      assert.equal(bytes.readUInt16LE(2), 1, "ICO image type");
      assert.equal(bytes[6], 32);
      assert.equal(bytes[7], 32);
    }
  }
  assert.ok(totalBytes < 50000, "Branding assets must remain smaller than one former logo PNG");
  for (const doc of documents.values()) {
    assert.equal(doc.querySelectorAll('img[src*="bloku-logo-light"], img[src*="bloku-logo-dark"]').length, 0);
    for (const image of doc.querySelectorAll('img[src="/bloku-logo.png"]')) {
      assert.ok(Number(image.width) * 3 <= 204, "Logo must retain 3× pixels for its largest display size");
      assert.equal(image.width, image.height);
    }
    assert.equal(doc.querySelector('link[rel="icon"][type="image/png"]')?.getAttribute("sizes"), "32x32");
    assert.equal(doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"), "/apple-touch-icon.png");
  }
});

test("noindex is isolated to utility pages and never leaks into subsequent renders", () => {
  assert.match(render("en", "hey").head, /noindex, follow/);
  assert.match(render("ar", "not-found").head, /noindex, follow/);
  assert.match(render("en", "home").head, /content="index, follow"/);
  assert.doesNotMatch(render("en", "home").head, /noindex/);
  assert.doesNotMatch(
    serialize({ payload: "</script><script>alert(1)</script>" }),
    /<\/script>/,
  );
});

test("sitemap contains only the 72 indexable canonical URLs and no utility routes", async () => {
  const xml = await fs.readFile(path.join(root, "dist/sitemap.xml"), "utf8");
  const doc = new JSDOM(xml, { contentType: "application/xml" }).window
    .document;
  assert.equal(doc.querySelectorAll("url").length, 72);
  for (const item of manifest.filter((route) => route.indexable))
    assert.ok(
      [...doc.querySelectorAll("loc")].some(
        (node) => node.textContent === item.canonical,
      ),
    );
  assert.doesNotMatch(xml, /<loc>[^<]*(?:\/hey|\/bye|\/404)<\/loc>|2026-01-24/);
});

test("preview server returns actual 404 status and preserves localized errors", async () => {
  const port = 43971;
  const child = spawn(process.execPath, ["scripts/serve.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await Promise.race([
      once(child.stdout, "data"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Preview did not start")), 5000),
      ),
    ]);
    const good = await fetch(`http://127.0.0.1:${port}/ar/features/focus`);
    assert.equal(good.status, 200);
    assert.match(await good.text(), /lang="ar" dir="rtl"/);
    const missing = await fetch(`http://127.0.0.1:${port}/ar/does-not-exist`);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /lang="ar" dir="rtl"/);
    const source = await fetch(`http://127.0.0.1:${port}/src/main.tsx`);
    assert.equal(source.status, 404);
    const redirect = await fetch(`http://127.0.0.1:${port}/support/`, {
      redirect: "manual",
    });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get("location"), "/support");
    const config = JSON.parse(
      await fs.readFile(path.join(root, "vercel.json"), "utf8"),
    );
    assert.ok(
      !config.rewrites,
      "Do not turn arbitrary URLs into 200 SPA responses",
    );
  } finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
});
