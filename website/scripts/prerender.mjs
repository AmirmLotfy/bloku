import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { product, routes, render, pagePath } from "../.ssr/entry-server.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const template = await fs.readFile(path.join(dist, "index.html"), "utf8");
const manifest = [];
for (const locale of product.locales) {
  for (const page of Object.keys(routes)) {
    const rendered = render(locale.code, page);
    const urlPath = pagePath(locale.code, page);
    const relative =
      page === "home"
        ? `${locale.path ? `${locale.path}/` : ""}index.html`
        : `${urlPath.slice(1)}.html`;
    const html = template
      .replace(
        'lang="en" dir="ltr"',
        `lang="${rendered.lang}" dir="${rendered.dir}"`,
      )
      .replace("<!--app-head-->", rendered.head)
      .replace("<!--app-html-->", rendered.html)
      .replace(
        "<!--app-data-->",
        `<script type="application/json" id="page-data">${rendered.data}</script>`,
      );
    const target = path.join(dist, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html);
    manifest.push({
      locale: locale.code,
      page,
      path: urlPath,
      file: relative,
      canonical: rendered.canonical,
      indexable: rendered.indexable,
    });
  }
}
const urls = manifest
  .filter((item) => item.indexable)
  .map((item) => {
    const alternates = product.locales
      .map(
        (locale) =>
          `<xhtml:link rel="alternate" hreflang="${locale.tag}" href="${product.siteUrl}${pagePath(locale.code, item.page)}"/>`,
      )
      .join("");
    return `<url><loc>${item.canonical}</loc>${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${product.siteUrl}${pagePath("en", item.page)}"/></url>`;
  });
await fs.writeFile(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("\n")}</urlset>\n`,
);
await fs.writeFile(
  path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${product.siteUrl}/sitemap.xml\n`,
);
await fs.writeFile(
  path.join(dist, "route-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Prerendered ${manifest.length} localized pages; ${urls.length} indexable URLs.`,
);
