# BLOKU 2.0 store images

`B2/scripts/v2-store-assets.mjs` renders the already-built extension in an isolated, headless Chrome for Testing 156 profile. It never builds, changes `B2/dist`, opens the user's browser profile, uploads assets, or publishes a listing. Run capture only after the coordinator grants the shared browser lane.

```sh
node B2/scripts/v2-store-assets.mjs --check-only
node B2/scripts/v2-store-assets.mjs --capture
node B2/scripts/v2-store-assets.mjs --verify artifacts/store/<capture-directory> --require-all
```

`--check-only` checks the current package, all eight runtime translations, and all eight caption files without opening a browser. `--capture --locales en,ar` is available for a bounded layout review. The default captures all locales: `en`, `ar`, `es`, `pt_BR`, `fr`, `de`, `ja`, `hi`.

`BLOKU_CHROME_PATH` can point to an externally installed Chrome for Testing 156; when supplied, the runner does not require the project browser cache to exist. Without it, the existing project cache is discovered. The launched browser's actual version is still checked, and no browser download occurs.

## Captures

Each locale produces five opaque JPEG screenshots at **1280 × 800**, a **440 × 280** promotional tile, and a **1400 × 560** promotional image. JPEG quality is 90. The title on each screenshot is the exact corresponding `screenshotCaptions` string from `B2/store/locales/<locale>.json`; no new effectiveness, adoption, ratings, or savings claims are added.

| Image | Actual product evidence |
| --- | --- |
| `01-protection.jpg` | Current-site popup and the top of packaged filter choices. Rule counts are the actual package's filter metadata. No blocking counter is invented. |
| `02-distractions.jpg` | YouTube preset settings and the real element-picker preview on an owned article fixture. The preview is canceled afterward. |
| `03-timed-focus.jpg` | A real 25-minute session, the resulting redirect of the already-open fixture to the blocked page, and the actual session controls. |
| `04-schedules.jpg` | Two crops of the same saved profile: domain and daily allowance, then weekday schedule and timed-session controls. |
| `05-local-settings.jpg` | Local rules, export/import controls, and the actual About page with engine revision. |

The small promotional tile uses the original packaged icon, product name, translated product title, and existing “all features free” text. The larger promotional image adds an actual popup capture and the existing localized store summary. The original artwork is never redrawn. Arabic captions, composition, fixture content, and extension UI use right-to-left layout.

## Evidence and boundaries

The browser loads only the built extension and a controlled `http://reading.bloku.test` article served by the runner on an ephemeral loopback port. DNS and request interception prevent external navigation. The article uses existing translated UI copy and is not a third-party website. YouTube evidence shows the actual preset controls, not a claim about a tested public YouTube page.

Synthetic user settings are saved through the extension's trusted `BLOKU_V2` message API: locale, theme, selected presets, a focus profile, a weekday schedule, and a 30-minute daily allowance. The real `PICK_ELEMENT`, `START_FOCUS`, and `END_FOCUS` actions drive the captured behavior. No extension storage, displayed counters, response handlers, DOM content, or product CSS is patched. Cropping and scaling occur only in the separate composition page after raw screenshots are saved. Real session timestamps and the remaining duration are allowed to vary.

The default output is a new directory under ignored `artifacts/store/`, named with the built checksums fingerprint and a unique capture suffix. It contains:

- Seven store-ready JPEGs per locale, 56 in a complete run.
- Ten unmodified raw product PNG crops per locale, with their purpose recorded in the manifest.
- `manifest.json`, including the current `checksums.json` and root manifest hashes, filter revision, input caption/runtime-locale hashes, original icon hash, renderer-source hash, browser version, image dimensions, raw provenance, errors, and evidence limits.
- `SHA256SUMS` for the manifest and every delivered image.

The runner applies the release writer's exact distribution validation before capture and repeats input checks after capture. It rejects changed or unlisted package files, missing notices/locales, gate output, and changed captions. Chrome-owned `_metadata/` remains an explicit exception and is not altered. It also checks each JPEG's encoded dimensions, RGB channels, hash, expected image count, and composition overflow. `--verify` rechecks all image hashes and confirms the current built package/caption fingerprint still matches.

The browser, HTTP server, and temporary profile are owned by the runner and cleaned up on completion or failure. Failed runs keep a separate `failed-capture-*` evidence directory, not a successful manifest. No browser is launched by importing the release validation helper.

## Review status

Assets remain `LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW`. A capture is product evidence and a local asset candidate; it does not independently qualify the extension, establish public-site effectiveness, satisfy a store review, or publish anything. The coordinator must review English and Arabic layouts, representative non-Latin text, cropping, and the final exact-package fingerprint before handing the JPEGs to the owner for submission.

## Current final local capture

The current complete output is `artifacts/store/bloku-2.0.0-41049e2448c5-hfcH8c/`. It contains 40 screenshots at 1280 × 800, eight promotional tiles at 440 × 280, eight promotional images at 1400 × 560, and 80 unmodified raw PNG captures. The 56 JPEGs total 3,683,526 bytes.

The full capture ran in Chrome for Testing 156 from `2026-11-01T22:15:50Z` to `2026-11-01T22:16:51Z`, after the same package passed all 289 eight-locale accessibility checks. Those UTC timestamps fall on 2 November in the workspace's Africa/Cairo timezone. Capture-time input validation and the independent `--verify ... --require-all` command passed. Every expected locale/image was present; dimensions, RGB JPEG encoding, hashes, input stability, and composition bounds passed. All `SHA256SUMS` entries were independently verified again after cleanup. There were zero captured runtime errors and zero external network attempts. The owned browser, server, and temporary profile were cleaned up; no capture profile remained.

- Built checksums-manifest SHA-256: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`.
- Asset manifest SHA-256: `070b44da94c72da6e84382f547db0e3dbfc29f43fb66bc1ccb1eb954c520f9c5`.
- Capture renderer SHA-256: `082f405898410149443f0aad108d47c968b5bd86abc293976cb1859f6b58c463`.

The coordinator reviewed the English protection and Arabic schedule composition during the earlier layout pass. Additional visual inspection covered English focus/local-settings views, Arabic picker/RTL layouts, Japanese/Hindi screenshots, and promotional text. The preceding `bf82` capture review included the updated English protection status and Arabic/Japanese weekday checkbox schedules. The current capture repeats the same renderer and unchanged product UI/CSS after a canonical-import guard changed the package fingerprint. Framing adds padding outside unmodified product crops so rounded frames do not cut native headings. The exact current package is recorded above; store submission remains an owner action.

The folders `artifacts/store/bloku-2.0.0-c1f79a99313b-lIKOtg/` and `artifacts/store/bloku-2.0.0-c1f79a99313b-SAeci4/` are **superseded layout-review precursors**. Their package predates the original logo's corrected 16/48/128-pixel Chrome icon exports. `artifacts/store/bloku-2.0.0-efe04b515af3-TtSAmT/` is also preserved, but has been superseded by the later popup status, editable-hide, weekday-control, localization, and focus-outline changes. `artifacts/store/bloku-2.0.0-bf82b25f1d2b-ye5b0k/` preserves the successful preceding capture but predates the final canonical-import guard. Use only `41049e2448c5-hfcH8c` for the current package. The live `--verify` command rejects the older package fingerprints.

Chrome Web Store upload distinction: screenshots can be localized, but the 440×280 and 1400×560 tile fields are global. Use the English pair for those fields; the other 14 tile variants are optional external marketing material. Source: https://developer.chrome.com/docs/webstore/cws-dashboard-listing .
