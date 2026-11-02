# BLOKU 2.0

Free ad blocking and distraction control for Chrome desktop 145+. No account, license, subscription or paid feature tier. Published by [Frameless](https://frameless.com.eg) under GPL-3.0-only; the BLOKU name/logo remain brand assets.

This tree is a release candidate. Test evidence is bounded to its recorded browser and package hashes; it does not establish universal site compatibility, native-speaker acceptance or a performance ranking. Final Chrome Web Store submission/publication remains with the owner.

## Build the extension

Use Node 22.12+ and npm. The lockfile and packaged filter sources are pinned.

```sh
cd B2
npm ci
npm run build:v2
npm run typecheck
npm run test:foundation
npm run test:engine
```

Load `B2/dist` as an unpacked extension. The build manifest is `B2/v2-manifest.json`; legacy 1.1.3 files in the development checkout are baseline material only and are excluded from the public source/submission archives. See [the extension README](B2/README.md) for architecture, filter maintenance and browser qualification. Public source archives select only audited v2 inputs; they contain no backend, environment files or development caches.

Features include packaged ad/tracker filters, regional/annoyance choices, per-site ad pauses, distraction presets, editable element hides, focus profiles/sessions/schedules/allowances, optional supported cookie rejection, clicked-link cleanup and local data controls. All eight languages are included. The limited privacy-preference option is DOM-only: it does not send the Sec-GPC HTTP header and is not complete GPC support.

## Upstream work and licenses

- [AdGuard filtering libraries](https://github.com/AdguardTeam/tsurlfilter): the stock SDK and official MV3 converter; no competing filter parser or DNR writer.
- [AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry): pinned source text, hashes and license headers in `B2/engine/vendor`.
- [DuckDuckGo Autoconsent](https://github.com/duckduckgo/autoconsent): packaged supported opt-out flows, MPL-2.0, with no generic privileged evaluation bridge.

Exact dependency versions, package URLs and integrity hashes are in `B2/package-lock.json`; the build produces an SBOM and license notices. Install obtains those pinned packages; regular filter builds use the bundled source inputs without fetching new lists. Review [upstream dependency limitations](B2/engine/INTEGRATION.md), including the inherited Zod advisory, before qualification. A clean security audit is not claimed.

## Website and releases

The React/Vite marketing source is in `Bloku-Website`, distributed separately from the extension source archive. It generates static localized HTML and uses no website analytics script. Keep public promotion aligned with the Store version. Optional donations remain hidden until a verified destination is configured, and never unlock features.

[Release notes](docs/RELEASE_NOTES.md), [migration/backup behavior](docs/MIGRATION_REPORT.md), [artifact checks](docs/RELEASE_ARTIFACTS.md), [Store reviewer material](docs/STORE_RELEASE.md), and [maintenance](docs/MAINTENANCE.md) document the candidate and remaining limits. The prepared CI performs checks only; it never deploys or submits a release.

Website: https://bloku.app · Support: support@bloku.app
