# Public-site qualification

Final release ZIP compatibility run: **40/40 attempts**, **0 harness failures**, **30/40 raw readability signals**, and **3/3 demo input checks passed** on Chrome 156.0.8078.80. Exact final checksum manifest: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`; release ZIP SHA-256: `320c288293c7438d1044603e17da5405042707e5163ef13e2a425098faa31190`. These are provisional bootstrap checks with the manual limits below, not 40 complete website passes. Additional exact-version engine/runtime results appear at the end of this report.

## Historical five-variant benchmark

Run: 2026-11-01T21-05-31-875Z. Status: **complete**. Browser: Chrome/156.0.8078.80. Completed 290/290 planned navigation samples.

The frozen package completed **290/290 navigation samples** with **0 harness failures**. Automated checks called 30/40 control pages readable and found 0 BLOKU bootstrap/scroll/input regression candidates. Separate visual review narrowed 4 of those controls (Walmart, BestBuy, Guardian, TikTok), leaving **26/40 controls eligible for this limited comparison**. BLOKU had 0 new automated failures against those 26 controls; all 3 demo-form input checks passed. This is not a claim that 40 complete websites or authenticated workflows passed.

This report applies only to checksum-manifest SHA-256 `efe04b515af36607c1485ba0cfaf223c39d85c7fe34f15067a2e866444070c67`. Later UI/copy/import changes require separate exact-package qualification. Additional 145/155/158 engine and exact-final-package runtime runs are reported separately below; they do not relabel this historical benchmark. No best-in-class effectiveness or universal speed claim follows from these measurements.

Historical benchmark package checksum-manifest SHA-256: `efe04b515af36607c1485ba0cfaf223c39d85c7fe34f15067a2e866444070c67`. Raw results, all attempted cases, initialization rule counts and viewport screenshots: [2026-11-01T21-05-31-875Z](../B2/artifacts/public-qualification/2026-11-01T21-05-31-875Z/results.json).

## Separate manual adjudication

[Manual review](../B2/artifacts/public-qualification/2026-11-01T21-05-31-875Z/manual-review.json) records 19 screenshot hashes across 9 sites. The raw collector source and measurements were not changed. [Structured summary](../B2/artifacts/public-qualification/2026-11-01T21-05-31-875Z/summary.json) identifies both the collector and report-only postprocessor by SHA-256. [Original automated report](../B2/artifacts/public-qualification/2026-11-01T21-05-31-875Z/automated-report.md) is preserved.

- bbc: News cards, text, navigation and photographs are present in both. Vertical positions differ after a fixed scroll; this is not a missing-content finding.
- youtube: Both show the paused 0:00 player, title and public controls. Comments still contain loading skeletons. Playback, ads during playback and comment completion are unqualified.
- walmart: A Robot or human verification modal overlays the catalog in both. Exclude from unrestricted compatibility counts; no challenge was solved or bypassed.
- bluesky: Public post text and feed actions are visible in both. Several post image/avatar areas remain placeholders; complete media loading and authenticated interactions are unqualified. The legacy screenshot shows the public profile header but feed skeletons; this remains an unresolved loading observation, not a confirmed legacy filtering bug.
- bestbuy: Both show the country chooser, not a product catalog. Country selection and shopping flows were not attempted.
- guardian: A large consent overlay covers the page in both. No consent control was clicked. Exclude Guardian from comparative performance conclusions because parent-document automation does not prove an unobstructed content view.
- amazon: Category cards and labels are present in both; many baseline images are still loading while the BLOKU screenshot shows more images. This single observation is not attributed as a speed improvement.
- selenium-form: Both show the nonpersonal test string in the text input. Other form controls remain present; submission was not attempted.
- tiktok: The no-extension control shows navigation and feed placeholders without loaded videos. AdGuard shows a blank viewport. The control itself does not establish a usable feed, so the raw AdGuard candidate cannot be attributed as an extension regression. Playback and feed completion remain unqualified.

The legacy Bluesky loading candidate remains unresolved; no comparator defect is established. The AdGuard TikTok blank view is not attributed as a regression because the control itself showed feed skeletons. Guardian's performance rows are excluded from comparative conclusions because an unobstructed content view is unproven. No fast gate/error result is promoted as a performance advantage.

## Versions and provenance

- no-extension: Chrome without extensions; browser control; prepared.   
- bloku-2: BLOKU 2.0.0 actual dist snapshot; 2.0.0; prepared.   
- bloku-1: Original BLOKU 1.1.3 ZIP; 1.1.3; prepared.  Archive SHA-256: `126e91eca0dd9783fef38580ed5d051157d379d5cfad8ff00d3272a67ce2f4a2`. 
- ubol: uBlock Origin Lite; 2026.1026.1812; prepared. [Official release](https://github.com/uBlockOrigin/uBOL-home/releases/tag/2026.1026.1812). Archive SHA-256: `d3788eac9f0a44c67f3745a43c3fd446ef33d56b1121f469b19e0fa0a836c2b5`. 
- adguard: AdGuard Browser Extension MV3; 5.5.3.3; prepared. [Official release](https://github.com/AdguardTeam/AdguardBrowserExtension/releases/tag/v5.5.3.3). Archive SHA-256: `628b5da9749cf6b4730cf8ffe28b6afdb2b3e029c1acd918c73d7c4b2e90986e`. 

## Observed default configurations

These compare each product's fresh-install defaults, not matched filtering strength or equivalent permissions. A ruleset count is not an effectiveness score. Optional host grants and nondefault modes are not enabled. Full rule/permission state for every fresh profile is recorded in the raw evidence.

| Variant | Enabled static rulesets | Static rules in enabled sets | Dynamic rules | Granted host patterns |
|---|---|---|---|---|
| bloku-2 | ruleset_2, ruleset_3 | 197943 | 0 | http://*/*, https://*/* |
| bloku-1 | ad_rules, ad_rules_extended, rules_ads, rules_trackers, rules_annoyances, rules_security | 28527 | 406 | <all_urls> |
| ubol | ublock-filters, easylist, easyprivacy, pgl, ublock-badware, urlhaus-full | 18870 | 178 | <all_urls> |
| adguard | ruleset_10, ruleset_2 | 70804 | 0 | *://*.adguard.app/*/thankyou.html*, *://*.adguard.com/*/thankyou.html*, *://*.adguard.info/*/thankyou.html*, *://reports.adguard.app/*, *://reports.adguard.com/*, *://reports.adguard.info/*, <all_urls>, http://*/*, https://*/* |

## Method

One isolated Chrome for Testing browser runs at a time, using fresh task-owned profiles. No personal profile, credentials, authenticated sessions, checkout, purchases, form submissions or meeting joins are used. First-run tabs are closed without clicking legal/account/purchase controls. Installed extensions are unmodified official/original archives; installation hooks are never executed. The BLOKU 2 artifact is an immutable verified snapshot of actual dist. Default filter choices are recorded; no premium state is forged in the legacy comparison.

Each compatibility case navigates to the fixed URL, waits for DOMContentLoaded up to 18 seconds, then observes a fixed 2.5-second window. It checks public content bootstrap and scrolling. The three form pages additionally attempt to type a nonpersonal test string into the documented demo input without submission. Video checks cover public page/player-shell loading only; playback, mid-roll ads and authenticated experiences are unqualified. Challenge/login/error pages are recorded as limited coverage rather than passed flows. Large modals are noted. These automatic checks cannot prove visual completeness or all interactions.

Performance uses six representative URLs and three repeats per variant. Variant order rotates between repeats; each variant/repeat starts a fresh profile. HTTP cache is disabled, viewport is 1365×900, language en-US, timezone Africa/Cairo, autoplay requires a gesture, and the same machine/network/browser flags apply. No CPU/network throttling is added. Live-site/network/ad-auction variability and region-dependent responses remain uncontrolled. Compatibility blocks run sequentially by variant and are not simultaneous A/B requests.

DOMContentLoaded, load and LCP are browser navigation/paint observations. CDP Performance renderer TaskDuration/JS heap are recorded separately. Browser CPU is the accumulated delta of Chrome's SystemInfo process cpuTime counters sampled every 750 ms; very short-lived processes between samples may be missed. Peak memory is the maximum summed RSS of only this browser's process IDs, read using macOS ps; shared pages may be double-counted and this is not private working-set memory. CPU/RSS include the browser and extension processes; no worker debugger is kept attached. Startup is completed before page measurement. Request failures marked ERR_BLOCKED_BY_CLIENT are observed network failures, not verified ad counts or bandwidth/time-saving claims.

BLOKU's legacy licensing backend and BLOKU website hosts are DNS-blocked in **every** variant, preventing license/billing calls. This restriction does not alter extension source. No test URL uses these hosts.

Per-site performance medians require three readable, modal-free samples and three positive values for each displayed metric. Guardian is additionally excluded by manual adjudication. Zero/missing navigation-event timestamps mean the event was not observed, not a zero-time load. The 2.5-second settle is a wait before the probe; busy-page/CDP response delays can extend the actual window recorded in windowMs. These observed timings do not establish full visual completion. A fast error page is never promoted into a speed advantage. These are bounded local measurements, not a statistically powered ranking.

## Compatibility matrix

| URL | Category | No extension | BLOKU 2 | BLOKU 1.1.3 | uBOL | AdGuard |
|---|---|---|---|---|---|---|
| [bbc](https://www.bbc.com/news) | news | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [guardian](https://www.theguardian.com/international) | news | MANUAL LIMIT: consent-overlay | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw public-page-readable |
| [reuters](https://www.reuters.com/) | news | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [ap](https://apnews.com/) | news | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [npr](https://www.npr.org/) | news | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [aljazeera](https://www.aljazeera.com/) | news | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [cnn](https://www.cnn.com/) | news | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [nytimes](https://www.nytimes.com/) | news | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [amazon](https://www.amazon.com/) | ecommerce | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [ebay](https://www.ebay.com/) | ecommerce | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [etsy](https://www.etsy.com/) | ecommerce | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [walmart](https://www.walmart.com/) | ecommerce | MANUAL LIMIT: challenge-modal | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw public-page-readable |
| [ikea](https://www.ikea.com/) | ecommerce | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [bestbuy](https://www.bestbuy.com/) | ecommerce | MANUAL LIMIT: country-selector-only | limited control; raw readable-after-navigation-timeout | limited control; raw readable-after-navigation-timeout | limited control; raw readable-after-navigation-timeout | limited control; raw readable-after-navigation-timeout |
| [notion](https://www.notion.com/) | productivity | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [figma](https://www.figma.com/) | productivity | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [linear](https://linear.app/) | productivity | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [trello](https://trello.com/) | productivity | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [google-docs](https://www.google.com/docs/about/) | productivity | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [youtube](https://www.youtube.com/watch?v=jNQXAC9IVRw) | video | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [vimeo](https://vimeo.com/watch) | video | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [twitch](https://www.twitch.tv/directory) | video | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [dailymotion](https://www.dailymotion.com/) | video | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [archive-video](https://archive.org/details/movies) | video | insufficient-content | control limited; insufficient-content | control limited; insufficient-content | control limited; insufficient-content | control limited; insufficient-content |
| [reddit](https://www.reddit.com/r/technology/) | social | challenge | control limited; insufficient-content | control limited; challenge | control limited; challenge | control limited; challenge |
| [x](https://x.com/explore) | social | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [instagram](https://www.instagram.com/) | social | authentication-gated | control limited; authentication-gated | control limited; authentication-gated | control limited; authentication-gated | control limited; authentication-gated |
| [bluesky](https://bsky.app/profile/bsky.app) | social | public-page-readable | no obvious bootstrap/scroll regression | CANDIDATE: public-shell-only | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [tiktok](https://www.tiktok.com/explore) | social | MANUAL LIMIT: control-feed-skeletons | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw public-page-readable | limited control; raw insufficient-content |
| [w3schools-form](https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit) | forms | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [httpbin-form](https://httpbin.org/forms/post) | forms | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [selenium-form](https://www.selenium.dev/selenium/web/web-form.html) | forms | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [mdn-js](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [chrome-docs](https://developer.chrome.com/docs/extensions/) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [python-docs](https://docs.python.org/3/) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [wikipedia](https://en.wikipedia.org/wiki/Main_Page) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [github](https://github.com/AdguardTeam/tsurlfilter) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [stackoverflow](https://stackoverflow.com/questions) | docs | http-error | control limited; http-error | control limited; http-error | control limited; http-error | control limited; http-error |
| [wcag](https://www.w3.org/TR/WCAG22/) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |
| [node-docs](https://nodejs.org/en/learn/getting-started/introduction-to-nodejs) | docs | public-page-readable | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression | no obvious bootstrap/scroll regression |

## Performance medians

Performance was mixed. Across the five nonexcluded BLOKU/control page pairs, BLOKU's median Chrome CPU time was lower on 2 pages and higher on 3. Median peak summed Chrome RSS was higher on all five by about 241–503 MiB. Summed RSS double-counts shared pages and is not private working-set memory. These three-repeat observations support no overall fastest or lowest-memory claim. All comparator values remain visible below; no combined ranking is calculated.

| Page | Variant | Readable/modal-free samples | DCL ms | LCP ms | Browser CPU ms | Peak summed RSS MiB |
|---|---|---|---|---|---|---|
| bbc | no-extension | 3/3 | 2980.8 | 1540 | 3430.3 | 1080.4 |
| bbc | bloku-2 | 3/3 | 1788.3 | 1040 | 2603.5 | 1583.2 |
| bbc | bloku-1 | 3/3 | 2493.3 | 1056 | 2483.9 | 1256.4 |
| bbc | ubol | 3/3 | 2233.3 | 1368 | 2425.7 | 1352.3 |
| bbc | adguard | 3/3 | 2251.2 | 1236 | 3693.2 | 1903.8 |
| guardian | no-extension | excluded; 3 attempted | — | — | — | — |
| guardian | bloku-2 | excluded; 3 attempted | — | — | — | — |
| guardian | bloku-1 | excluded; 3 attempted | — | — | — | — |
| guardian | ubol | excluded; 3 attempted | — | — | — | — |
| guardian | adguard | excluded; 3 attempted | — | — | — | — |
| amazon | no-extension | 3/3 | 753.5 | 660 | 2557 | 1660.7 |
| amazon | bloku-2 | 3/3 | 1131.8 | 1056 | 1820.2 | 1919.7 |
| amazon | bloku-1 | 2/3 | — | — | — | — |
| amazon | ubol | 3/3 | 791 | 868 | 2076.7 | 1894.6 |
| amazon | adguard | 3/3 | — | 1200 | 2749 | 2180 |
| youtube | no-extension | 3/3 | 3851.4 | 1104 | 5391.8 | 2026.3 |
| youtube | bloku-2 | 3/3 | 4824.4 | 1264 | 6559.8 | 2335.2 |
| youtube | bloku-1 | 3/3 | 3348.1 | 908 | 5801.5 | 2340.6 |
| youtube | ubol | 3/3 | 4652.8 | 1116 | 6476.6 | 2238.2 |
| youtube | adguard | 3/3 | 5904.8 | 3228 | 6885.8 | 2227.2 |
| mdn-js | no-extension | 3/3 | 677.2 | 724 | 1334.8 | 2095.6 |
| mdn-js | bloku-2 | 3/3 | 655.3 | 716 | 1444.6 | 2349.3 |
| mdn-js | bloku-1 | 3/3 | 6400.6 | 972 | 2316.9 | 2292.2 |
| mdn-js | ubol | 3/3 | 1057.9 | 856 | 1422.4 | 2248.5 |
| mdn-js | adguard | 3/3 | — | 868 | 1565.4 | 2033 |
| wikipedia | no-extension | 3/3 | 358.6 | 360 | 762.2 | 2111.6 |
| wikipedia | bloku-2 | 3/3 | 542.8 | 544 | 934.2 | 2352.9 |
| wikipedia | bloku-1 | 3/3 | 424.1 | 416 | 874 | 2093 |
| wikipedia | ubol | 3/3 | 391 | 400 | 852.1 | 2263.8 |
| wikipedia | adguard | 3/3 | 366.7 | 368 | 1503.9 | 1973.8 |

## Limits and unresolved items

- No harness-level failure recorded.
- WAF/CAPTCHA, login and paywall coverage is explicitly limited; the runner never bypasses these controls.
- Authenticated social feeds, account editing, checkout, payment, collaboration meetings and browser-wide compatibility are not tested.
- All candidates need reproduction and visual/functional review before attribution. Package behavior is not changed by this runner.
- Profiles are removed after their browser closes; downloaded verified comparison packages remain only in the ignored task cache.

Primary method references: [CDP SystemInfo](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/), [CDP Performance](https://chromedevtools.github.io/devtools-protocol/tot/Performance/).

## Final-package run method

The final current-only run and platform runs completed sequentially after a browser-lane grant. Current-only mode verified a snapshot of the exact release ZIP extraction and ran the fixed 40 URLs, keeping `latest-current.json` separate from the original `latest.json` and 290-sample benchmark. It adds no contemporaneous controls or new performance medians. Platform mode ran 21 isolated engine cases plus all 20 authored runtime checks on exact snapshots 145.0.7632.117, 155.0.8059.84 and 158.0.8127.2. See the evidence table below for the retained physical-idle SKIP and per-version provenance.

<!-- current-package:start -->
## Separate current-package compatibility run

Run 2026-11-02T05-09-35-155Z: **complete**, 40/40 attempts, 30 raw readability signals. Exact package: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`. [Separate report](../B2/artifacts/public-qualification/2026-11-02T05-09-35-155Z/report.md). This is a new current-only run, not a rerun of the earlier five-variant performance comparison; the earlier benchmark remains tied to its original package hash. [Five-screenshot manual review](../B2/artifacts/public-qualification/2026-11-02T05-09-35-155Z/manual-review.md) records Walmart public catalog only, Best Buy country selector only, TikTok partial feed, Guardian obscuring consent overlay, and YouTube paused shell/comment skeletons. Restricted-site and incomplete-flow limits remain explicit.
<!-- current-package:end -->

<!-- platform-results -->
## Additional Chrome engine and exact-package runtime checks

Requested exact Chrome for Testing versions are reported as snapshots, not current channel labels. Each browser runs the 21-case isolated stock-SDK engine gate followed by the 20 authored runtime checks against the exact release ZIP extraction. These are local fixture checks, not repeat public-site matrices, authenticated workflows, native toolbar tests or comparative performance measurements. Screenshots are disabled here. Physical idle checks remain SKIP when the real host is idle.

| Requested snapshot | Overall result | Engine cases | Runtime pass / skip / fail | Observed browser |
|---|---|---|---|---|
| 145.0.7632.117 (minimum supported snapshot) | passed-with-stated-skips | 21/21 | 19 / 1 / 0 | Chrome/145.0.7632.117 |
| 155.0.8059.84 (previous milestone) | passed | 21/21 | 20 / 0 / 0 | Chrome/155.0.8059.84 |
| 158.0.8127.2 (requested beta snapshot) | passed | 21/21 | 20 / 0 / 0 | Chrome/158.0.8127.2 |

[Raw platform evidence](../B2/artifacts/public-qualification/platforms.json) records per-version official metadata, archive provenance, executable version, environment, complete outputs and cleanup. The 155/158 browser archives are freshly downloaded from URLs verified against official per-version metadata; their local SHA-256 identifies downloaded bytes and is not a publisher-signed digest. The minimum 145 uses the preexisting cached bundle and records its executable hash; its original archive is unavailable. Task-downloaded bundles are removed after each version. Stable Chrome 156 runtime JSON and documentation are restored byte-for-byte after every wrapper. Separate runtime evidence is retained per exact version. Earlier interrupted minimum-version screenshot/CDP attempts remain historical harness limitations; these no-screenshot results do not qualify screenshot capture. [Official CfT metadata documentation](https://github.com/GoogleChromeLabs/chrome-for-testing).
