import { renderToString } from "react-dom/server";
import App from "./App";
import { copies } from "./content";
import product from "../../shared/product.json";
import { localeInfo, pagePath, publicPages, routes } from "./routes";
import type { LocaleCode, PageContext, PageId } from "./types";

export { copies, product, pagePath, routes, publicPages };
const ogLocales: Record<LocaleCode, string> = {
  en: "en_US",
  ar: "ar_AR",
  es: "es_ES",
  pt_BR: "pt_BR",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja_JP",
  hi: "hi_IN",
};
const featureIds: PageId[] = [
  "ad-blocking",
  "privacy-feature",
  "distraction-control",
  "focus",
];
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function serialize(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function render(locale: LocaleCode, page: PageId) {
  const copy = copies[locale];
  const language = localeInfo(locale);
  const path = pagePath(locale, page);
  const canonical = `${product.siteUrl}${path}`;
  const featureIndex = featureIds.indexOf(page);
  let title = copy.meta.homeTitle;
  let description = copy.meta.homeDescription;
  if (featureIndex >= 0) {
    title = `${copy.features[featureIndex].eyebrow} | BLOKU`;
    description = copy.features[featureIndex].intro;
  } else if (page !== "home") {
    const section =
      page === "not-found"
        ? copy.notFound
        : copy[
            page as
              | "support"
              | "privacy"
              | "terms"
              | "hey"
              | "bye"
              | "changelog"
          ];
    title = `${section.title} | BLOKU`;
    description = page === "changelog" ? `${copy.changelog.intro} ${copy.changelog.items.slice(0, 2).join(" ")}` : section.intro;
  }
  const context: PageContext = { locale, page, copy, path };
  const indexable = publicPages.includes(page);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: language.tag,
    isPartOf: { "@type": "WebSite", name: product.name, url: product.siteUrl },
  };
  const software =
    page === "home"
      ? {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: product.name,
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Chrome",
          softwareVersion: product.version,
          softwareRequirements: `Desktop Chrome ${product.minimumChromeVersion}+`,
          isAccessibleForFree: true,
          license: `${product.sourceUrl}/blob/main/LICENSE`,
          url: product.siteUrl,
          creativeWorkStatus: "Published",
          downloadUrl: product.storeUrl,
          description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
          publisher: {
            "@type": "Organization",
            name: product.publisher,
            url: product.publisherUrl,
          },
        }
      : null;
  const alternates =
    page !== "not-found"
      ? product.locales
          .map(
            (item) =>
              `<link rel="alternate" hreflang="${item.tag}" href="${product.siteUrl}${pagePath(item.code as LocaleCode, page)}" />`,
          )
          .join("\n") +
        `\n<link rel="alternate" hreflang="x-default" href="${product.siteUrl}${pagePath("en", page)}" />`
      : "";
  const head = `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${indexable ? "index, follow" : "noindex, follow"}" />
<link rel="canonical" href="${canonical}" />
${alternates}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="BLOKU" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:locale" content="${ogLocales[locale]}" />
<meta property="og:image" content="${product.siteUrl}/og-image.jpg" />
<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="BLOKU" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${product.siteUrl}/og-image.jpg" />
<script type="application/ld+json">${serialize(software ? [schema, software] : schema)}</script>`;
  return {
    html: renderToString(<App {...context} />),
    head,
    data: serialize(context),
    lang: language.tag,
    dir: language.dir,
    canonical,
    indexable,
    title,
    description,
  };
}
