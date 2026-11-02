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
- `public/bloku-logo.png` is a faithful 204px derivative of the original artwork, sufficient for the largest 68px UI use at 3× density. Proper 32px favicons and a 180px touch icon replace the former 1000px copies. The unchanged original is retained in `scripts/branding-original.png`; `scripts/branding-provenance.json` records hashes and dimensions. On macOS, `npm run assets:branding` reproduces the native sips resampling. Social images and the 32 qualified product captures remain unchanged.

## Shared contract

`../shared/product.json` owns product version, canonical/store/support/source URLs, minimum Chrome version, software license, supported locale code/tag/path/direction/label, feature routes and the optional funding destination. `../shared/design-tokens.json` records the common brand palette, type and scale. Website theme roles are in `src/tokens.css`; keep its core values aligned with the shared file when evolving the brand.

The owner-verified PayPal link is website-only optional support, with a customer-chosen one-time EUR amount and no extra feature access. Localized support and privacy copy explains external processing and possible fees/conversion. The footer/support links do not load a payment SDK, iframe or payment form. Keep funding independent of extension features; do not infer payment eligibility or charitable status from a working link.

## Bounded local performance lab

`scripts/website-lab.mjs before` and `after` use the adjacent `B2` source's existing `puppeteer-core` and verified cached Chrome 156; they install nothing. Start the fixed local preview separately with `PORT=4176 npm run preview`, run `before` against the baseline build, close that browser, then run `npm run check` and `after` against the new build. Stop the owned server after collecting results. The runner writes ignored `artifacts/website-lab` reports and temporary isolated profiles, closing browsers and removing profiles itself.

It uses three cold-cache samples each for English/Arabic home/support, a 390×844 emulated viewport, 4× CPU slowdown and fixed network throttling. The after run also checks all eight languages on desktop/mobile, new-link keyboard reachability, images, RTL, overflow and level cards. External page requests are blocked; PayPal links are never followed. This is a local lab, not Lighthouse, a real mobile device, INP, field Core Web Vitals or a ranking guarantee. Current Google guidance and the measured limits are recorded in `../docs/AUDIT_WEBSITE_STORE_20261102.md`.

## Hosting and release

`vercel.json` serves clean static URLs without a catch-all 200 rewrite. Vercel uses `dist/404.html` for unmatched paths. The local preview selects a translated 404 when it recognizes a locale prefix; the static host may use the English 404 for arbitrary missing URLs. Localized `/ar/404` etc. remain available and noindex.

No deploy or publication is part of this implementation. Before release, verify every advertised extension feature against the packaged extension, confirm store timing, and verify HTTP status/social metadata on the actual hosting preview. The eight locale catalogs are translated in source; no independent native-speaker review is claimed. Historical billing help remains available without claiming that installing 2.0 cancels old payment agreements or deletes processor records.
