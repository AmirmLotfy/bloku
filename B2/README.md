# BLOKU 2.0

Free, open-source ad blocking and distraction control for Chrome desktop 145 and later. No account, payment, license check, extension telemetry or runtime filter download. Optional privacy and focus features are controlled by the user.

## Build

Use Node 22.12 or newer and npm. From this directory:

```sh
npm ci
npm run build:v2
npm run typecheck
npm run test:foundation
npm run test:engine
```

Load the generated `dist/` directory using Chrome's **Load unpacked** developer control. The version 2 manifest source is `v2-manifest.json`; `scripts/v2-build-extension.mjs` is the build entrypoint. Generated files and Chrome's `_metadata/` are not source. The original 1.1.3 files are retained only for migration and baseline comparison; do not package them as a version 2 release.

For browser qualification, install Chrome for Testing from Google's official distribution and pass its executable path through `BLOKU_CHROME_PATH`, or use the task-owned browser cache created by the acceptance runner:

```sh
npm run test:engine:browser
node scripts/v2-runtime-check.mjs
```

The engine gate uses isolated local fixtures, not personal browser profiles. The runtime gate verifies the already-built dist checksums before loading it. Tests must complete and all owned browsers must close before another heavy test or build starts.

## Architecture

The service worker is the sole controller of AdGuard's stock Manifest V3 SDK. It serializes configuration changes, verifies installed rules, persists confirmed state and restores the prior configuration after a failed update. Other modules never modify DNR rules directly. Declarative network filtering is supplemented by packaged cosmetics/scriptlets, local user rules, site-specific distraction styles, a reversible picker and opt-in DOM-based cookie-dialog rejection.

Focus uses persisted deadlines, alarms, device-local weekly schedules, observed foreground usage allowances and explicit breaks/end controls. Existing matching tabs are moved to a local explanation page after a confirmed focus change. Pausing ads does not end a focus session. Focus is a user-controlled aid, not a tamper-resistant parental control.

Storage migration preserves user settings, site exceptions, saved hides and clearly labeled legacy estimates. It verifies the semantic stored result before retiring payment identifiers. Unknown newer schemas are retained instead of overwritten. Imports are validated before application. Ordinary editable-settings saves preserve current session and usage state.

## Filters and limits

Pinned original lists and source hashes are in `engine/vendor/`. Regular builds are offline with respect to filter acquisition and use the official converter. Explicit maintenance uses:

```sh
node scripts/v2-update-filters.mjs EXACT_FILTERSREGISTRY_COMMIT
```

Review changes, licenses and diagnostics before rebuilding. Complete optimized Base is available when Chrome has insufficient extra static-rule capacity. Regional and annoyance lists are optional. Capacity failures are visible; the last confirmed configuration remains active. Lists are never silently sliced. Source exceptions and main-frame-capable redirects are composed with focus restrictions using the SDK's supported rule mechanisms.

## Privacy and statistics

Browsing/request context and page content are processed locally for filtering and the chosen controls. No automatic billing or telemetry traffic is part of version 2. This local processing is still disclosed data handling. Current-page matched-rule counts, saved hides, local focus activity and legacy estimates are separate; they must not be advertised as exact lifetime blocking totals or measured bytes/time saved.

See `PRIVACY_POLICY.v2.md`, `NOTICE.v2.md`, the packaged SBOM and `engine/INTEGRATION.md` for licenses, limitations and upstream advisory mitigation. All features are free. Donations, if enabled later through a verified website link, never change blocking.

## Release

After rebuilding and qualifying the exact dist, create candidate archives:

```sh
node scripts/v2-release-artifacts.mjs
```

The writer checks assets, eight locales, notices, source provenance and file hashes. It excludes backend files, secrets, dependencies, gate fixtures and Chrome metadata from the Chrome package. ZIP entries have fixed timestamps and sorted paths. A matching audited version 2 source archive and SHA-256 manifest accompany the extension.

A candidate archive is not a claim of completed compatibility, performance or store qualification. Keep the existing Chrome Web Store item ID. The owner performs final store submission/publication after reviewing the release evidence and assets.

Settings exports omit timed sessions. Import previews editable settings and applies through explicit validation on Save; current usage and matching active sessions are preserved. Saved element selectors can be edited or restored in Distractions. Weekday checkboxes use localized day names. Popup status distinguishes global off, exact/inherited pauses, recurring focus and breaks.

The limited privacy-preference option exposes `navigator.globalPrivacyControl` to page scripts only. It does not send the `Sec-GPC` HTTP header and must not be advertised as complete GPC. The stock SDK's coupled DNT/GPC header behavior and exception priority do not satisfy this release's independence requirements; no second DNR writer is introduced to conceal that limitation.

Historical1.1.3 runtime, policies and scripts are isolated under `legacy/v1.1.3` in the private development checkout; the extension source directory intentionally has no legacy root manifest. Build and load `B2/dist` only. Public corresponding source excludes historical material.
