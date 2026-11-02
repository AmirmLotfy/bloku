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

## Current RC2 local capture — review pending

Use `artifacts/store/bloku-2.0.0-817fc857d09b-QkNLWm/` for the current artifact. Its fingerprint is `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`, root manifest SHA-256 `45cde63b043c50f3b5500e9753f513887b4746fbbb862d5309d2e72f06b60b2c` and filter revision `d394c08f96db93677910d7ae07a0fc808548ad15`.

Capture ran in Chrome for Testing 156 from `2026-11-02T09:09:03.825Z` to `09:10:19.858Z`. It produced **40 screenshots** at 1280×800, eight 440×280 tiles, eight 1400×560 promotional images, and **80 unmodified raw captures**. The capture log records all 56 JPEGs/80 raw crops verified against the current package, zero capture errors/external requests, and owned browser/server/profile cleanup. Evidence is the capture `manifest.json`, `SHA256SUMS` and `.local/audit-20261102/store-assets-final.log`.

- Asset manifest SHA-256: `a48714c23f1c50cf189363ca905cf3ceebf693a9f9e503a96d71e21437ac03b3`.
- Renderer SHA-256: `082f405898410149443f0aad108d47c968b5bd86abc293976cb1859f6b58c463`.
- Original packaged 128px icon SHA-256: `255467f3838dc40611ef770dea66ca886ed84b53966444cc6ba3f1a770f797a9`.

Status remains **LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW**. The coordinator visually reviewed four representative current Store images covering English, Arabic, Japanese and Hindi: text was readable, cards level, RTL correct where applicable and no composition overflow was observed. The English browser-owned file-input label visible in Japanese follows the browser/OS locale; it is not an extension translation fallback. This sample is not native-speaker acceptance or a complete owner asset review. Complete owner visual/cropping acceptance remains pending. All 32 product photos are now synced into website source and its check passed 10/10. A successful capture is controlled-fixture product evidence, not independent extension qualification, authenticated-site proof or native-toolbar-popup acceptance. Separate current 817 native evidence is `artifacts/audit-20261102/native-pause-reload-final-en.jpg` and `native-pause-reload-final-ar.jpg`: 380 CSS-pixel root/client/scroll widths, no horizontal overflow, DPR 2, and 13 real Tab presses reaching Open settings. A real Arabic Reload page action cleared the pending flag, returned to the owned parent fixture and preserved the saved pause. The owned native harness reported `CLEANUP_COMPLETE`. Neither capture establishes real 200% popup zoom. Current accessibility evidence has 329 passes and eight explicit native-toolbar zoom skips; see `docs/AUDIT_SUMMARY_20261102.md`.

## Preserved historical captures

`artifacts/store/bloku-2.0.0-d2c42c347c32-Qy01do/` belongs to the superseded d2 RC2 build. It is not the current product capture even where screenshots appear similar. The older complete RC1 capture is `artifacts/store/bloku-2.0.0-41049e2448c5-hfcH8c/`; its fingerprint is `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2` and its asset manifest SHA-256 is `070b44da94c72da6e84382f547db0e3dbfc29f43fb66bc1ccb1eb954c520f9c5`. Earlier c1f79/efe04/bf82 folders remain layout-review history. Do not overwrite or relabel their bytes, timestamps or provenance. The live verifier rejects stale package/caption inputs.

All 32 final 817 product photos are synced into the website. Its check passed 10/10; the final local lab passed 12 cold mobile samples plus 32 localized surfaces, CLS 0 and no recorded console/page/external-request errors (`Bloku-Website/artifacts/website-lab-final-817/after.json`). The final protected preview is `https://bloku-website-djgxvc51e-mellardoos-projects.vercel.app`; authenticated CLI readback passed 12 routes with protected noindex/crawl denial and canonical/PayPal href checks. Hosted visual acceptance remains blocked by unavailable IAB browser-user control and the rejected native fallback; no hosted visual pass is claimed. Raw authenticated headers/logs remain private. See `docs/AUDIT_SUMMARY_20261102.md` for the prepared manual owner walkthrough. Public bloku.app remains the earlier public site; no Store upload or listing mutation occurred during this audit.

Chrome Web Store screenshots can be localized; the small and marquee promotional fields are global. Use the accepted English 440×280 and 1400×560 pair for those fields. Other localized tiles are supplementary marketing assets. See [Google's listing guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing). Owner retains final certification, submission and publication; preparing upload material is not submission.
