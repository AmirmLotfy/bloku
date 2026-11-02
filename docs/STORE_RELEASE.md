# BLOKU 2.0 RC2 Store material — draft, not release qualified

Prepared for owner review on 2 November 2026. No dashboard changes, upload, submission or publication were performed during this audit. `docs/SUBMISSION_HANDOFF.md` records the current artifact, historical RC1 provenance, evidence and remaining gates. Store certification and publication remain with the owner.

## Exact candidate and listing source

The local candidate is `artifacts/release-rc2/bloku-2.0.0-chrome.zip`, version **2.0.0**, minimum Chrome **145**. ZIP SHA-256: `e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875`. Its `checksums.json` fingerprint is `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`; use the RC2 release manifest and `SHA256SUMS` before upload. Current reports identify the extracted ZIP: Chrome 145 has 31 passes; 155/158 each have 29 passes plus two host-idle activity skips; 156 has 31 passes with no failures or skips on the final harness. See `docs/AUDIT_SUMMARY_20261102.md` for exact report/runner provenance and remaining acceptance.

Use the eight JSON drafts in `B2/store/locales/`: `en`, `ar`, `es`, `pt_BR`, `fr`, `de`, `ja`, `hi`. English title: **BLOKU — Ad Blocker & Focus**. Exact summary:

> Block ads and trackers, hide distracting feeds, and schedule focus time. All features free. No account required.

Each JSON contains `status`, `title`, `summary`, `description` and five `screenshotCaptions`. All eight descriptions now disclose the possible manual reload after filtering changes, saving unfinished work first, and independent focus restrictions. They retain the free-feature model, Chrome 145 minimum, supported-site/video limits and support/privacy links. No keyword lists, competitor-ranking terms, machine-learning claims, fabricated ratings/adoption, exact lifetime totals or performance guarantees are authorized.

Distraction presets cover nine domain keys across eight services because both `x.com` and `twitter.com` are included. Controls vary by site. Advertised optional cookie rejection covers supported dialogs only; unsupported dialogs remain usable. Clicked-link cleanup removes known tracking parameters, with guards for recognized signed links. These controls do not guarantee every dialog/link, anonymity or complete fingerprint protection.

## Short reviewer field

Paste the exact contents of `B2/store/reviewer-instructions.txt`: **478 characters**, excluding its trailing newline, within the inspected dashboard's 500-character limit. No account, license or test credentials are required. The text covers website access, ordinary HTTP(S) pages, manual reload, independent focus and protected-page limits.

For a fuller manual check, open popup/options, create a focus profile for `example.com`, save and start a timed session. The site should show BLOKU's local explanation page. Pausing ads does not remove focus restrictions. A break temporarily permits access; ending the timed session does not remove separate weekly schedules or exhausted daily allowances. Isolate those controls when testing. Use the element picker on an ordinary website to preview/save a hide, reload and edit/delete it. Importing a validated settings file still requires explicit Save and does not replay old timed sessions.

## Engine behavior and explicit pause limit

The candidate uses stock `@adguard/tswebextension` **6.0.1** and DNR converter **2.0.0**, Manifest V3 and Chrome DNR. Those versions matched the coordinator's npm check on 2 November 2026; this is not an ongoing update guarantee. The SDK remains the single DNR writer. Packaged static and locally configured dynamic rules perform network filtering; packaged cosmetics/scriptlets handle supported page behaviors. Executable logic and filter inputs are packaged, with no runtime executable-code download or remote subscriptions. Local arbitrary executable rules are rejected; CSP excludes unsafe-eval. Bundled dormant SDK helper paths are a documented limitation, not evidence of a clean security audit.

An existing document's full ad pause can require a manual reload after SDK configuration changes, rollback or worker startup, especially for already-loaded embedded frames. The popup reports **Pause saved · reload needed**, offers **Reload page**, and warns users to save unfinished work. The extension does not force reloads. A fresh committed top-page load clears the pending state; stored pauses remain and focus stays independent. The current local checks validate that explicit workflow; they do not claim uninterrupted pause effectiveness before reload. Do not weaken focus or add another DNR writer to conceal the limitation.

The optional limited website privacy preference exposes `navigator.globalPrivacyControl` to page scripts. BLOKU does **not** send the `Sec-GPC` HTTP header: this is not complete GPC support and is not advertised as a Store benefit. Optional privacy/distraction controls start off until chosen; their supported behavior is described in the UI.

## Privacy and owner certification

Filtering handles URLs, request/navigation/frame context, selected page content and transient request/response headers locally. Headers may include Cookie/Set-Cookie session identifiers even though the extension requests no cookie-management permission. Do not claim observation of Authorization headers. Settings, site policies, rules, focus state and optional configured-site activity stay on device. Activity counts observed active time for configured focus sites; history off retains today's allowance counters, while optional local history keeps up to 90 days. Export and local deletion controls are available. Persistent request logging, SDK statistics collection and external telemetry are disabled. Current-page filtering observations, cosmetic hides, focus activity and labeled legacy estimates are distinct measures.

Website visits are separate: hosting receives ordinary request metadata, including for clean localized welcome/uninstall pages. No browsing URL, local settings or identifier is appended to those lifecycle URLs. Historical payment/support records are separately disclosed. The extension has no account, payment, credit-decision or advertising-data-sale function and does not upload browsing history to BLOKU servers.

Google's [user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) explicitly requires disclosure of user-data handling even when processing/storage is local. Its [privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) requires accurate categories, purpose, permission justifications and certifications consistent with the public policy. These official pages were rechecked on 2 November 2026. The owner must review actual dashboard definitions against URL/navigation, content, optional activity and transient authentication-cookie handling. Do not automatically clear every category on the basis that no data is uploaded.

The six-area authenticated dashboard walkthrough still showed 1.1.3, old Premium copy, blank reviewer fields, and financial/payment and personally identifiable information categories selected. Those old choices are not an RC2 certification. Reconcile each field truthfully; do not infer that historical billing means the 2.0 extension processes payments. Set distribution to **Free of charge** and remove obsolete paid-tier, subscription and in-app-purchase benefit claims. Final limited-use/privacy certifications belong to the owner.

For this packaged candidate, declare **No remotely hosted code** after comparing the actual final ZIP to the source/runtime evidence. Scriptlets are bundled; no unsafe-eval permission is present. No declaration in this document replaces the owner's final truth check.

## Candidate permissions

The extracted RC2 manifest declares ten API permissions and HTTP(S) host access:

| Permission/access | Purpose |
| --- | --- |
| `declarativeNetRequest` | Packaged ad/tracker and local focus/site network rules. |
| `activeTab` | User-invoked current-page inspection, page controls and matched-rule access. |
| `scripting` | Packaged page controls/picker and the limited DOM privacy preference. |
| `storage` | Settings, site policies, rules, focus and local activity; session context. |
| `unlimitedStorage` | Filtering engine local indexes and persisted rule data. |
| `webRequest` | Local request lifecycle and tab/frame context for the filtering SDK; DNR performs blocking. |
| `webNavigation` | Document/frame context and current-page observation boundaries. |
| `alarms` | Focus schedules, session/break deadlines, temporary pauses and allowance accounting on wake. |
| `idle` | Exclude idle use from configured-site active-time accounting. |
| `contextMenus` | User-invoked element picker on ordinary websites. |
| `http://*/*`, `https://*/*` | Apply filtering/chosen controls across browsing and focus sites; protected Chrome pages remain excluded. |

The manifest does not request `tabs`, `cookies`, `userScripts`, `declarativeNetRequestFeedback` or `webRequestBlocking`. SDK cookie mutation/stealth features are disabled, and unsupported cookie-capability rules are excluded. API availability alone does not justify adding permissions. Compare these explanations to the final packaged manifest before submission.

## Website, assets and final acceptance

The final protected preview is `https://bloku-website-djgxvc51e-mellardoos-projects.vercel.app`. Authenticated CLI readback passed 12 route checks: all eight localized homes plus English privacy/support and robots returned 200, and an unknown route returned 404. All responses remained noindex, page canonicals pointed to bloku.app, robots denied crawling and the exact PayPal href was confirmed. Evidence: `.local/audit-20261102/preview-817-readback/summary.json`. Raw authenticated headers/logs remain private and excluded from public source artifacts.

Final local evidence is `Bloku-Website/artifacts/website-lab-final-817/after.json`: 12 cold mobile samples and 32 eight-locale home/support desktop/mobile surfaces passed, with CLS 0 and no recorded console errors, page errors or external page requests. Median local LCP was 1,140ms for English home, 1,492ms for Arabic home, 1,040ms for English support and 1,304ms for Arabic support. This was 390×844 mobile emulation, 4× CPU slowdown, 150ms latency and disabled cache on a local static server. It is not a Lighthouse score, field Core Web Vitals, real-device/CDN result, universal speedup or search/AI ranking claim. The owned browser/profile were cleaned up.

Hosted visual browser acceptance remains blocked: IAB automation persistently returned `browser.user unavailable` on normal and direct API paths; the native Codex-app fallback was rejected by automatic safety review and did not execute. The coordinator did not change security settings, request additional authorization or claim a hosted visual pass. The exact final URL, local lab report, asset folder and reviewer/listing files are prepared for a manual owner walkthrough. Public bloku.app remains on the earlier site. Make the accurate RC2 policy publicly reachable at `https://bloku.app/privacy` before submission; a protected preview cannot replace it. Coordinate public promotion/indexing with Store availability under owner control.

Optional website-only support uses `https://www.paypal.com/ncp/payment/H2Y4B9EM6CF5C` for a customer-chosen one-time EUR amount. It grants no extension benefit and loads no payment interface before a click. Do not promise fees, tax treatment, account eligibility or payment/withdrawal success. Website disclosure separates PayPal processing and historical records from local extension data. Publisher: `https://frameless.com.eg`.

Current Store capture `artifacts/store/bloku-2.0.0-817fc857d09b-QkNLWm/` contains 56 verified JPEGs and 80 raw crops matched to the final fingerprint, with no capture errors/external requests and recorded cleanup. It remains `LOCAL_CAPTURE_REQUIRES_OWNER_REVIEW`; representative EN/AR/JA/HI images were reviewed as readable, level and free from overflow with appropriate RTL; complete owner visual review remains pending. Japanese browser-owned file-input text following the browser/OS locale is not an extension fallback, and no native-speaker acceptance is claimed. Older d2/RC1 assets remain historical. Per Google's [listing-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), screenshots can be localized, with up to five per locale; 440×280 and 1400×560 promotional tile fields are global, so use the accepted English pair there. Additional localized tiles are supplementary external assets. Preserve the original logo.

Current exact-ZIP runtime counts are listed above. Stock SDK engine cases passed 21/21 on Chrome 145/155/156/158 for unchanged engine modules. Accessibility at `artifacts/accessibility/bloku-2.0.0-817fc857d09b-Aqa08e/report.json` has 329 PASS, 0 FAIL and eight native-toolbar-popup 200% SKIP.

Current native English/Arabic pending-pause screenshots (`artifacts/audit-20261102/native-pause-reload-final-en.jpg` and `native-pause-reload-final-ar.jpg`) show 380 CSS pixels at DPR 2 without horizontal overflow; 13 real Tab presses reached Open settings. A real Arabic Reload page action returned to the owned parent fixture, cleared `pauseReloadRequired` and preserved the saved pause. The owned native harness cleaned up. This is not native 200% zoom acceptance. Final source/reproducibility, hosted visual/owner asset review and independent language/screenreader acceptance remain pending or limited. At this checkpoint the reproduction report was absent; verify a later `artifacts/release-rc2/reproducibility.json` and matching source/archive inventory before asserting reproduction.

Current 817 heavy-site evidence comprises exactly three public observations in each of two runs (`B2/artifacts/behavior-audit/2026-11-02T09-23-48-738Z/` and `2026-11-02T09-25-51-788Z/`), with 13 owned fixture passes and zero harness failures/unattempted cases per run. The first run's watch label was a related-film-link misclassification; the tightened helper reached catalog detail but found no safe matching watch control. Player/popunder effectiveness remains limited, and shared control-page errors are not attributed to extension runtime.

Current 817 video evidence has 27 PASS, 8 LIMITED and 0 FAIL across 35 checks, mapped to the exact archive and verified snapshot (`B2/artifacts/video-qualification/2026-11-02T09-22-07-880Z/results.json`). YouTube playback/seek/fullscreen/comments/recommendations passed; captions/autoplay and Vimeo/Twitch remain limited, with no confirmed comparison regression. d2 public results and RC1 comparisons do not qualify changed RC2 bytes. Narrow business-route/YouTube-embed preset guards and native SPA refresh are source/fixture checked; they do not certify authenticated business workflows or exempt network/focus filtering.

The coordinator owns final artifact/source/asset reconciliation. The coordinator verified all eight Store-copy drafts, 144 UI locale keys and 26 packager self-tests. Copy checks are `node B2/store/validate-copy.mjs` and `node B2/store/validate-ui-locales.mjs`; this documentation edit ran neither. Do not claim final qualification, Store approval, security certification or universal website compatibility. Preserve migration-safe v1 backups and historical evidence. The owner decides final submission and deferred publication after accepting the documented limits. Google's [update guide](https://developer.chrome.com/docs/webstore/update), rechecked on 2 November, restricts partial rollout to items with over 10,000 seven-day active users; this packet asserts no eligibility. Manual recovery uploads require a higher version; the separate official Store rollback workflow needs its own owner eligibility/data-safety check, and no rollback action was performed.
