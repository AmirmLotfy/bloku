# BLOKU website

The source for [bloku.app](https://bloku.app): React, TypeScript and Vite, with ReactDOMServer prerendering. Production serves localized static HTML; React hydrates interactive controls.

## Develop

From `website/`, use Node.js 22.12+ and npm:

```sh
npm ci
npm run check
npm run preview
```

Open [localhost:4173](http://localhost:4173). Set `PORT` to choose another port. `npm run check` runs type checking, lint, client/server builds, prerendering and tests. `npm test` requires an existing build.

`npm run dev` also builds once and starts the static preview server. Rebuild after source changes. The preview serves `dist/`, redirects trailing slashes and returns actual 404 responses.

## Content and assets

- `src/content/` contains all eight locale catalogs, including Arabic RTL.
- `src/routes.ts` defines localized routes; English uses `/`, with locale prefixes for other languages.
- `scripts/prerender.mjs` generates static HTML, metadata and a sitemap.
- `public/` contains icons, social artwork and localized product captures.
- `assets/branding/` preserves the original logo artwork and derivative provenance. On macOS, `npm run assets:branding` regenerates logo and icon derivatives with `sips`.
- `../shared/product.json` defines version, URLs, languages, feature routes and the optional website funding link.

Canonical URLs use `https://bloku.app`, including local previews. Onboarding, goodbye and 404 pages are noindex. `vercel.json` defines static hosting behavior and response headers.

The site loads no analytics scripts, external fonts or payment SDK. Optional support links lead to the external payment provider and never unlock extension features. Keep feature descriptions consistent with the extension, preserve historical privacy disclosures, and avoid invented effectiveness or adoption claims.

See [contributing](../CONTRIBUTING.md), [architecture](../docs/architecture.md) and the [software license](../LICENSE). BLOKU names and artwork remain Frameless brand assets.
