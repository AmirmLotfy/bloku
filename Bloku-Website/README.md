# BLOKU 2.0 website

React + TypeScript + Vite, with ReactDOMServer prerendering. Production is a static site: every route contains localized content, canonical metadata, hreflang links and JSON-LD before JavaScript runs. React hydrates only for the menu, theme and illustrative demo. Navigation uses ordinary links.

## Develop and verify

Use Node 22.12+ (the tested local runtime is 22.13.1).

```sh
npm ci
npm run check
npm run preview
```

The preview server is http://127.0.0.1:4173. Set `PORT` for another port. It serves only `dist`, redirects trailing slashes and returns actual 404 responses. `npm run dev` builds once and opens the same static preview server; rebuild after changes. There is no client-only SPA fallback.

`npm run check` runs typecheck, lint, client/server build, prerender and meaningful tests. `npm test` expects an existing build. The tests check translated copy shape, visible static content, navigation/fragment targets, canonical/hreflang relationships, robots isolation, honest schema, free content, sitemap coverage and preview HTTP behavior.

## Content and routes

- `src/content/`: independently translated English, Arabic, Spanish, Brazilian Portuguese, French, German, Japanese and Hindi. No English fallback in published locales.
- English lives at `/`; other locale prefixes are `/ar`, `/es`, `/pt-br`, `/fr`, `/de`, `/ja`, `/hi`.
- Each locale includes home, four feature pages (ad blocking, privacy, distractions, focus), help, privacy, terms, changelog, onboarding, goodbye and 404.
- `scripts/prerender.mjs` builds 96 HTML documents and a 72-URL sitemap. Onboarding, goodbye and 404 are noindex.
- Canonical origin is always `https://bloku.app`, including local previews. No analytics scripts, external fonts, tracking pixels or external runtime requests are used.
- `public/bloku-logo-light.png` and `public/bloku-logo-dark.png` are the exact original source logos. The existing OG image is retained because it contains only the BLOKU wordmark, with no unsupported feature/rating claims.

## Shared contract

`../shared/product.json` owns product version, canonical/store/support URLs, supported locale code/tag/path/direction/label, feature routes and the nullable Sponsors URL. `../shared/design-tokens.json` records the common brand palette, type and scale. Website theme roles are in `src/tokens.css`; keep its core values aligned with the shared file when evolving the brand.

No donation control is rendered while `sponsorsUrl` is null. Adding one requires a verified GitHub Sponsors destination and implementation/review; merely changing the JSON does not publish a button.

## Hosting and release

`vercel.json` serves clean static URLs without a catch-all 200 rewrite. Vercel uses `dist/404.html` for unmatched paths. The local preview selects a translated 404 when it recognizes a locale prefix; the static host may use the English 404 for arbitrary missing URLs. Localized `/ar/404` etc. remain available and noindex.

No deploy or publication is part of this implementation. Before release, verify every advertised extension feature against the packaged extension, confirm store timing, and verify HTTP status/social metadata on the actual hosting preview. The eight locale catalogs are translated in source; no independent native-speaker review is claimed. Historical billing help remains available without claiming that installing 2.0 cancels old payment agreements or deletes processor records.
