# BLOKU extension

Manifest V3 ad blocking and distraction control for Chrome desktop 145+. All features are free, with eight interface languages and no account requirement.

## Build and check

From `extension/`, use Node.js 22.12+ and npm:

```sh
npm ci
npm run build
npm run check
```

Load `dist/` through **Load unpacked** at `chrome://extensions`. The source manifest is `manifest.json`; `dist/` and `engine/generated/` are generated outputs.

Run the build before checks: it prepares the engine resources required by TypeScript and package validation. `npm run check` runs type checking, unit tests, locale validation, static DNR validation and package validation. It does not launch a browser.

## Browser integration gate

Install an official [Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/) build, set `BLOKU_CHROME_PATH` to its executable, then run:

```sh
npm run test:browser
```

The gate uses a separate extension build, isolated profile and local fixtures to check the stock AdGuard SDK, focus precedence and restoration after conversion or quota failures. It closes its owned browser on completion. CI resolves Chrome for Testing automatically. A passing gate covers these fixtures and browser version; it does not establish compatibility with every website.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/` | Service worker, content scripts, settings, popup, locales and unit tests |
| `engine/` | Stock SDK adapter, policy composition, transactions and tests |
| `engine/vendor/` | Original pinned filter texts and source hashes |
| `data/` | Distraction presets |
| `scripts/` | Builds, validation, browser gate, packaging and filter maintenance |
| `icons/` | Packaged extension icons |

The engine adapter is the only owner of filtering mutations. Configuration changes are serialized and verified before becoming confirmed state. See [architecture](../docs/architecture.md) and [engine integration details](engine/INTEGRATION.md).

## Filters and packages

Regular builds use the committed filter originals and verify their hashes. They do not fetch new lists. Installing dependencies with `npm ci` requires access to the pinned npm packages. For an intentional filter refresh:

```sh
npm run filters:update -- <exact-40-character-FiltersRegistry-commit>
```

Replace the placeholder with a full commit hash. Review source changes, license headers and conversion diagnostics, then rebuild and check. See [filter maintenance](../docs/filters.md).

To build and create extension and complete project-source archives:

```sh
npm run package
```

Archives are written beneath the repository's ignored `artifacts/release/` directory. Packaging validates the built files and includes checksums, licenses, an SBOM and filter provenance. It does not submit to the Chrome Web Store. To include the website source archive, run the package writer with `--include-website-source` after building:

```sh
node scripts/v2-release-artifacts.mjs --include-website-source
```

## Privacy and limitations

Settings, saved hides and chosen focus activity are stored locally. The extension processes request and page context for the enabled controls without sending extension telemetry. Existing paused pages may require an explicit reload after filtering is reconfigured. Current-page counts and historical estimates are distinct from exact lifetime blocking totals.

The optional privacy-preference control exposes `navigator.globalPrivacyControl` to page scripts only. It does not send the `Sec-GPC` HTTP header and is not complete GPC support. Cookie rejection works with supported flows; it is not universal.

Read the [privacy policy](PRIVACY.md), [third-party notices](NOTICE.md), [license](../LICENSE) and [security policy](../SECURITY.md), including the known inherited dependency advisory.
