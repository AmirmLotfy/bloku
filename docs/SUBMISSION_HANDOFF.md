# BLOKU 2.0 RC2 submission handoff — not release qualified

Checkpoint: 2 November 2026. RC2 remains a local candidate. The owner retains final data-use certification, submission and publication. Listing drafts and upload material are prepared for review. No listing edits, package uploads, submissions or publication were performed during this audit.

## Current artifact and historical provenance

Use `artifacts/release-rc2/release-manifest.json` and `SHA256SUMS` as the RC2 artifact inventory. The candidate is version **2.0.0**, minimum desktop Chrome **145**, with `manifest.json` at ZIP root:

| Item | RC2 identity |
| --- | --- |
| Chrome ZIP | `artifacts/release-rc2/bloku-2.0.0-chrome.zip` |
| ZIP SHA-256 | `e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875` |
| `checksums.json` SHA-256 | `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b` |
| Root manifest SHA-256 | `45cde63b043c50f3b5500e9753f513887b4746fbbb862d5309d2e72f06b60b2c` |
| Extracted candidate | `artifacts/release-rc2/unpacked/` |

The manifest records 113 ZIP entries and 85,721,766 bytes. Exact extracted-ZIP runtime evidence now identifies this archive, as listed below. At this documentation checkpoint RC2's inventory contains only the Chrome archive; final corresponding source archives, reproducibility and source publication remain pending. `artifacts/release-rc2/reproducibility.json` was absent; use a later completed report and matching manifest before claiming source reproduction. Read `docs/AUDIT_SUMMARY_20261102.md` for the twelve-request audit and full evidence boundaries.

[Public RC1](https://github.com/AmirmLotfy/bloku/releases/tag/v2.0.0-rc.1) preserves the earlier sanitized source snapshot at public commit `de302dfac8f58366d3153d36ed442abcff4907e8`. It is historical provenance, not RC2 source or current qualification. Preserve `artifacts/release/` and its original manifest/digests; do not overwrite or relabel them. Original RC1 checksums fingerprint: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`; Chrome ZIP SHA-256: `320c288293c7438d1044603e17da5405042707e5163ef13e2a425098faa31190`.

## Current evidence and limits

| Check | Current evidence |
| --- | --- |
| Foundation / engine transaction / TypeScript / build | 50/50, 14/14, typecheck/build passed; 144 locale keys, eight Store drafts and 26 packager self-tests verified; local `*-route.log` records. |
| Exact ZIP Chrome 145 | 31 PASS, 0 FAIL, 0 SKIP; `B2/artifacts/qualification/platforms-route/chrome-145-runtime.json`. |
| Exact ZIP Chrome 155 / 158 | Each 29 PASS, 0 FAIL, 2 host-idle activity SKIP; corresponding `platforms-route` runtime reports. |
| Exact ZIP Chrome 156 | 31 PASS, 0 FAIL, 0 SKIP on the final harness; earlier 30-case report preserved separately. |
| Stock SDK engine | 21/21 on all four versions. 145/156 engine reports remain in `platforms/` for unchanged engine modules; 155/158 are in `platforms-route/`. |
| Eight-locale accessibility | 329 PASS, 0 FAIL, 8 native-toolbar-popup 200% SKIP; `artifacts/accessibility/bloku-2.0.0-817fc857d09b-Aqa08e/report.json`. |

Final 31-case reports record runner SHA-256 `4c3b1bb919f20aba7d49df22f1777493f511e526d6c93ed00b0d26c214960259`. Initial Chrome 155 fixture/cleanup failure and the earlier 30-case runner are retained; do not relabel their provenance. Final Chrome 156 passed 31 with runner `4c3b…`; its old report is `platforms-route/chrome-156-runtime-30-case-historical.json` and the final-run log is `.local/audit-20261102/runtime-final-156-817.log`.

Current 817 native toolbar evidence is `artifacts/audit-20261102/native-pause-reload-final-en.jpg` and `native-pause-reload-final-ar.jpg`. Root/client/scroll widths were 380 CSS pixels with no horizontal overflow at DPR 2. Thirteen real Tab presses reached Open settings. After the real Arabic Reload page action, the owned parent fixture returned, `pauseReloadRequired` was false, and the saved site pause remained. The task-owned native harness reported `CLEANUP_COMPLETE`. Energy Saver was observed enabled; no system setting was changed. DPR 2 and this ordinary-zoom check do not qualify native 200% zoom.

Current 817 video evidence has 27 PASS, 8 LIMITED, 0 FAIL in `B2/artifacts/video-qualification/2026-11-02T09-22-07-880Z/results.json`, with exact archive/snapshot mapping and cleanup. YouTube playback/seek/fullscreen and comments/recommendations passed; captions/autoplay and Vimeo/Twitch remain LIMITED. No confirmed comparison regression was recorded. Current 817 public heavy-site observations are bounded and limited as recorded below. Historical d2 video results (24 PASS, 6 LIMITED) and comparative/public runs remain tied to their own bytes.

Current 817 heavy-site runs `2026-11-02T09-23-48-738Z` and `2026-11-02T09-25-51-788Z` under `B2/artifacts/behavior-audit/` each completed exactly three public observations, 13 owned fixture passes and zero harness failures/unattempted cases. The first collector mistook a related-film link for a watch control; retain that correction with its raw label. The tightened run reached catalog detail in all variants but found no safe matching watch control. Player/in-player-ad coverage remains LIMITED. The control and both BLOKU variants shared two sanitized generic page Error entries in the tightened run; tracker-blocking console signals have no recorded extension-runtime attribution. No observed new targets is not proof of popunder prevention.

The stock SDK 6.0.1/converter 2.0.0 integration has an explicit limitation: an existing page's full ad pause can require a manual reload after SDK reconfiguration, rollback or worker startup, especially with already-loaded embedded frames. The popup reports **Pause saved · reload needed**, offers **Reload page**, and warns to save unfinished work. No automatic reload occurs. Stored pauses remain; focus restrictions stay independent. This does not qualify uninterrupted pre-reload pause effectiveness. Website help and Store descriptions disclose the limitation in all eight locales.

## Owner listing preparation

Keep the existing Store item `mjfieeobdnanclichjahkhkkhlipnigj` and Privacy & Security category. Use `B2/store/locales/<locale>.json` for all eight titles, summaries and descriptions. English title: **BLOKU — Ad Blocker & Focus**. Summary:

> Block ads and trackers, hide distracting feeds, and schedule focus time. All features free. No account required.

Prepared handoff material is the exact ZIP/inventory above, `B2/store/locales/<locale>.json`, current Store images and `B2/store/reviewer-instructions.txt`. The latter fits the dashboard's 500-character reviewer field. No account or test credentials are required. Longer reviewer/permission guidance is in `docs/STORE_RELEASE.md`.

The authenticated dashboard inspected earlier still showed 1.1.3, the old title/Premium description, and selected financial/payment and personally identifiable information data categories. This is an observed old state, not a proposed RC2 certification. Reconcile the current dashboard personally: distribution is free of charge, and obsolete Premium/subscription/payment-benefit claims must be removed. Do not automatically uncheck every data category because processing is local; use the actual candidate behavior and current category definitions.

Current Store images are `artifacts/store/bloku-2.0.0-817fc857d09b-QkNLWm/`: 56 verified JPEGs and 80 raw captures, matching the final fingerprint, zero capture errors/external requests, with owned-process cleanup recorded. Status remains `LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW`; four representative EN/AR/JA/HI images were reviewed as readable/level/RTL/no-overflow, while complete owner visual acceptance remains pending. Browser-owned English file-input text in Japanese is not claimed as a translation defect; native-speaker acceptance is not established. Prior d2 and RC1 images are historical. Use only screenshots matched to the accepted final bytes. The Store accepts up to five screenshots per locale; global promotional fields use the English 440×280 and 1400×560 pair. Other localized tiles are supplementary external assets. Preserve the original branding and level cards; no fabricated ratings, adoption, performance superlatives or guaranteed video blocking.

## Public website, policy and optional support

The final protected preview is `https://bloku-website-djgxvc51e-mellardoos-projects.vercel.app`. Authenticated CLI readback passed 12 route checks: all eight localized homes plus English privacy/support and robots returned 200, and an unknown route returned 404. All responses remained noindex, page canonicals pointed to bloku.app, robots denied crawling and the exact PayPal href was confirmed. Evidence: `.local/audit-20261102/preview-817-readback/summary.json`. Raw authenticated headers/logs remain private and excluded from public source artifacts.

Final local evidence is `Bloku-Website/artifacts/website-lab-final-817/after.json`: 12 cold mobile samples and 32 eight-locale home/support desktop/mobile surfaces passed, with CLS 0 and no recorded console errors, page errors or external page requests. Median local LCP was 1,140ms for English home, 1,492ms for Arabic home, 1,040ms for English support and 1,304ms for Arabic support. This was 390×844 mobile emulation, 4× CPU slowdown, 150ms latency and disabled cache on a local static server. It is not a Lighthouse score, field Core Web Vitals, real-device/CDN result, universal speedup or search/AI ranking claim. The owned browser/profile were cleaned up.

Hosted visual browser acceptance remains blocked: IAB automation persistently returned `browser.user unavailable` on normal and direct API paths; the native Codex-app fallback was rejected by automatic safety review and did not execute. The coordinator did not change security settings, request additional authorization or claim a hosted visual pass. The exact final URL, local lab report, asset folder and reviewer/listing files are prepared for a manual owner walkthrough. Public bloku.app remains the previous site.

The RC2 privacy policy must be publicly accessible at `https://bloku.app/privacy` before it is used for submission. A protected preview cannot satisfy that public policy gate. Coordinate the public policy/site transition with Store availability; use the production indexing configuration for public 2.0 promotion, not preview crawl-denial settings. Publishing remains an owner-controlled step.

Optional website-only support uses the verified [PayPal destination](https://www.paypal.com/ncp/payment/H2Y4B9EM6CF5C): customer-chosen one-time EUR amount, no feature benefit. It loads only after a click; no payment embed or extension payment feature. Do not infer transaction/withdrawal success, fees, tax treatment or account eligibility. Publisher links use `https://frameless.com.eg`.

## Remaining acceptance and recovery

Before final submission, close the owner asset/hosted-visual review and reproducibility/source archives against the exact RC2 artifact. Recheck final archive checksums and manifest. Independently review critical authenticated workflows, actual Store upgrade permissions, native-speaker/screenreader behavior and remaining video limits as applicable; owned/public fixtures do not establish customer acceptance. GPC remains DOM-only with no Sec-GPC header, and mixed performance evidence supports no fastest claim. Retain documented inherited dependency/SDK risks rather than calling this a clean security audit.

The owner must accept the documented limits and make the final truthful privacy/limited-use certifications before submission. Use deferred publication after final acceptance. Google's [update guide](https://developer.chrome.com/docs/webstore/update) makes partial rollout available only above 10,000 seven-day active users; do not assume eligibility. Preserve original v1 backups and historical payment/support records. Do not instruct users to uninstall as routine update recovery: uninstall removes local storage. A manual recovery upload needs preserved source, a higher manifest version, migration-safe handling of v2 data and fresh validation; a lower-version upload is not a recovery path. Google also documents a separate [Store rollback workflow](https://developer.chrome.com/docs/webstore/update#rollback-to-a-previous-version); the owner must check its eligibility and data-safety limits before any action. No eligibility or rollback action is asserted.
