# Extension behavior audit — 2 November 2026

Status: source and primary-documentation review only. This audit did not run a browser, build, authenticated workflow, account mutation, checkout, publishing action or Store submission. The coordinator owns the shared browser/build lane. No extension source was changed by this audit.

Read first: `AGENTS.md`, `docs/SUBMISSION_HANDOFF.md`, `docs/IMPLEMENTATION_STATUS.md`. The v2 runtime source is `B2/src`, `B2/engine`, and `B2/v2-manifest.json`; `legacy/v1.1.3/background.js` and `legacy/v1.1.3/manifest.json` are preserved v1 source. Generated packages are outputs. Earlier package qualification does not qualify the requested new behavior.

## Prioritized findings

### 1. Context-menu picker targets the wrong document

Confirmed in source: `B2/src/background.ts:293` ignores `info.frameId` and sends to frame 0. `B2/src/content.ts:36` refuses to start outside the top window. `B2/src/background.ts:201` rejects picker saves/deletes from non-top frames and validates selectors in frame 0. The manifest already injects the scripts into ordinary HTTP(S) frames.

Effect: right-clicking content inside an iframe invokes a picker in the surrounding page. A user cannot hide the clicked element in its actual document. Popup-invoked top-page selection is a separate valid entry point.

Concrete correction: preserve `info.frameId ?? 0` for the context-menu request; let that frame render the picker; validate its selector against the sending document using `sender.documentId`, with `sender.frameId` as fallback, and derive the rule domain from the trusted content sender URL rather than caller text. Do not grant a frame the ability to save rules for the top site or arbitrary other hosts. The content listener should remember the latest `contextmenu` target if the desired flow starts with that clicked item preselected. Frame navigation between right-click and action must fail safely. HTTP(S) restricted/permission-denied frames need a visible unsupported/error result rather than swallowed rejection.

[Chrome context-menu documentation](https://developer.chrome.com/docs/extensions/reference/api/contextMenus) defines `OnClickData.frameId` and `frameUrl` for the clicked document. This is an API-supported fix; it does not require DNR changes.

### 2. Restore controls exist, but site-level reset is missing

Confirmed: the picker previews a single element with inline display and restores it on Cancel/Escape; saved rules create a stylesheet (`content.ts:7–14, 40–47`). A ten-second Undo deletes one rule (`content.ts:63–66`). Settings can edit/remove each selector but requires Save (`ui/options.ts:29,46`). The popup has no restore/reset-hidden-items entry (`ui/popup.ts:19–24`).

Missing behavior: quick restoration of all custom hides for the current site, restoration beyond the ten-second toast, a distinct all-sites custom-hide reset, and explanation of inherited parent-domain rules. Ad pause does not disable custom distraction CSS; `pageConfig` returns selectors independently of `adsEnabled`. This is consistent with independent features, but a broken work app needs the correct recovery control.

Small compatible correction: add a trusted popup action that removes the selected stored custom-hide group, update pages immediately, and keep per-selector controls in settings. Add a separate explicit all-custom-hides reset. Preserve presets, focus sessions/schedules, ad exceptions, network user rules, usage and unrelated settings. A site reset must identify all matching saved origins/groups, including parent-domain entries, before removing them; silently deleting a parent rule would affect sibling sites. Either present those scope choices or restore the exact origin group with clear inherited-rule text. Do not introduce a full settings reset as the primary recovery action.

An iframe rule stored on a third-party host will apply to that host wherever embedded under the existing model; expose that scope. A top-site-plus-frame-origin scope requires a deliberate schema change and migration and should not be smuggled into a frame fix.

[Apple's documented Distraction Control](https://support.apple.com/en-nz/120682) provides a persistent Show Hidden Items path and explains that changing ads are not permanently hidden. [uBO's element picker](https://github.com/gorhill/uBlock/wiki/Element-picker) uses selection followed by preview/create controls. These support reversible interaction design, not a claim of identical filtering effectiveness.

Other picker quality gaps: only `HTMLElement` targets are accepted, excluding SVG elements; there is no parent-selection control or match-count/scope explanation; generated positional/class selectors can drift after a site redesign. These are bounded improvements after frame handling and recovery.

### 3. Fresh-install and uninstall lifecycle hooks are absent in v2

Confirmed: no `onInstalled`, `setUninstallURL`, welcome page or review link exists in `B2/src`. Startup defaults/migration/locale selection work separately in `background.ts:114–140`; preserve those gates. V1 `legacy/v1.1.3/background.js:559–566` registered `https://bloku.app/bye`, so existing installations can have a prior registration while fresh v2 installations have none. The exact retained-browser behavior requires an upgrade fixture.

Concrete correction: register a top-level `onInstalled` listener. Open one localized welcome URL only for `reason === 'install'` after initialization, without resetting or overwriting state. Register a verified localized uninstall URL after install/update and restore it on startup if locale changes require it. Only include a locale and optional public version in that URL; no user/device ID, browsing URL, settings, hidden selectors, license or account data. Ensure the website routes exist in the actual public deployment before enabling the external lifecycle URLs. A local prepared route is not a working public route. Uninstall cannot run extension cleanup code afterward or recover storage erased by Chrome.

Add a neutral user-invoked review link in About/welcome/footer using the existing Store ID. Do not auto-open it, block functionality on a rating, prefill praise, promise a reward, or ask only happy users. [Chrome runtime documentation](https://developer.chrome.com/docs/extensions/reference/api/runtime) supplies both `onInstalled` and `setUninstallURL`; unpacked reload fires update, so install-only welcome is essential. [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies) prohibit review manipulation/incentives and require accurate metadata/data disclosure. Final Store writes remain owner-controlled.

### 4. Business-tool compatibility differs from v1 and requires workflow evidence

V1 had built-in always-allow domains (`legacy/v1.1.3/background.js:161` onward), broad creative-tool allowances (`:410–419`) and same-origin/CDN allowances for Meta/Google advertising dashboards (`:421–428`). These rules were not the user's stored allowlist. V2 migration preserves `settings.whitelistedDomains` (`src/migration.ts:30`), not these internal defaults. Therefore preserved user settings do not establish preserved v1 compatibility.

Do not copy the old DNR writer or broad domain lists into v2. The pinned AdGuard Base already includes Facebook Adsmanager exceptions (`engine/vendor/filter_2.txt:68062–68063`), Google Ads images/service exceptions (`:68181–68184`), Google account login path exceptions (`:69328–69329`) and account-page generic-cosmetic protection (`:150048`). Tracking Protection includes Canva's required Segment script exception (`filter_3.txt:128343`) and Meet logging exception (`:127152`). Preserve those packaged upstream fixes. Broad allowance of all `facebook.com`, `google.com`, `canva.com`, iframes or third-party scripts would sacrifice useful protection and still not prove critical workflows.

The acceptance matrix must separate public bootstrap from authenticated use: Meta Business Suite/Adsmanager navigation and draft preview; Google Ads/Analytics/Tag Manager/Search Console UI; Gmail/Docs/Drive editing/preview; Canva create/edit/export; OAuth/CAPTCHA; payment and video-meeting flows only within authorized accounts and without charge/publication. Do not create ads, spend money, send email/messages, publish designs or change account settings merely to obtain a compatibility pass. Compare enabled protection versus the same clean-profile control and record actual blocked-resource evidence before introducing a narrow compatibility rule.

### 5. Popup handling is supported by the stock SDK, with MV3 limits

`engine/adapter.ts:34–51` already configures the stock SDK. There is no extra popup toggle in its configuration schema. The SDK receives packaged filters plus `userrules`; its MV3 engine implements `$popup` matching in TSUrlFilter and removes a matching newly blank tab (`node_modules/@adguard/tswebextension/dist/index.mv3.js:4297–4310`). Its `isNewPopupTab` checks an initially empty/`about:blank` URL (`:773–783`), so delayed/navigated popunders may evade that test. Do not reinterpret this as complete popup prevention.

The build explicitly records the unsupported DNR conversion of `$popup` (`scripts/v2-build-engine.mjs:73–76`) while preserving filter inputs for SDK processing. [AdGuard's filter documentation](https://adguard.com/kb/general/ad-filtering/create-own-filters/#popup-modifier) describes exactly this MV3 distinction. Programmatic tab closing is stock SDK behavior, not a second DNR writer.

Careful follow-up: `adapter.ts:57–58` treats every dynamic conversion diagnostic as fatal. Adding an ordinary user `$popup` rule could therefore be rejected even though packaged `$popup` rules use the SDK path. Confirm in the browser gate before offering local popup rules. If confirmed, admit only the exact diagnostic class whose stock-SDK handling is qualified; never blanket-ignore conversion/quota errors or weaken focus rollback.

For a site-specific fix, use packaged domain-scoped network, cosmetic and scriptlet rules as appropriate and preserve their source/license/provenance. Only known unwanted requests should receive `$subdocument`; block-all-iframe rules break players, login, CAPTCHA, payment, embeds and editors. Avoid global `window.open` suppression or global event interception. [uBO's own popup switch documentation](https://github.com/gorhill/uBlock/wiki/Per-site-switches#no-popups) explains that unconditional popup blocking can also block legitimate new-tab actions; it is not a safe universal default to copy.

### 6. Egydead and YouTube need targeted observations, not guarantees

Default v2 list selection is Base + Tracking Protection (`src/model.ts:39`). Arabic Liste AR is packaged but optional (`engine/vendor/sources.json`); its `filter_112.txt:506,508` explicitly cover `egydead.media` using third-party script/XHR rules. Those rules are broad for that listed site and may affect a player; enable/reload/observe as a separate configuration, with rollback available. The presence of `egydead.media` in source does not establish that `sitea1.egydead.media` redirects, all popups, iframe players or in-player ads work. Do not add a random rule just from a hostname match.

On `https://sitea1.egydead.media`, collect a bounded public landing/player sample: final URL and redirect chain, clicked target/frame origin, attempted new tabs/popunders, player media origin, error state and visible overlays. Separate site outage/anti-bot/region restrictions from extension interference. Stop on credential/payment/permission prompts or unrequested downloads. Use a task-owned clean profile and close only its tabs/processes.

For YouTube compare clean no-blocker, current exact BLOKU candidate, BLOKU + regional/annoyance variant if relevant, current uBOL in documented filtering mode, and current AdGuard MV3, each in a separate profile. Record extension/browser/package/filter versions and locale/region/login state. Exercise several public videos and a playlist with play/seek/fullscreen/captions, observe pre-roll/mid-roll/overlays, and capture baseline ad opportunities. An ad-free sample when the control also showed no ad is inconclusive. Do not label a sample passed because a video eventually plays after ad skipping or retry.

[uBOL's current FAQ](https://github.com/uBlockOrigin/uBOL-home/wiki/Frequently-asked-questions-%28FAQ%29) distinguishes Basic versus Complete generic cosmetics, MV3 anti-blocker limits, and package-updated filters. Match capabilities/configuration before comparing performance; no universal winner or all-ads guarantee follows from a few visits. BLOKU's shipped scriptlets must remain packaged and reviewed; do not fetch remote executable anti-adblock patches.

## Focused regression matrix for the coordinator's lane

| Area | Minimum meaningful cases | Pass condition |
| --- | --- | --- |
| Clicked document | Top page, same-origin iframe, cross-origin iframe, frame navigation race | Picker appears only in requested document; stored scope derives from sender; race/unsupported frame is visible and safe. |
| Picker reversal | Preview Cancel/Escape; save/reload; undo after save; restore after toast expiry | Content and original inline styles return; unrelated page state and other hides persist. |
| Scope/reset | Exact host, inherited parent host, embedded third-party host; site reset versus all custom hides | Affected groups are explicit; presets/focus/network rules/usage remain byte-equivalent. |
| Lifecycle | Fresh install, update from seeded v1, unpacked reload, worker restart, locale change | Exactly one welcome only on fresh install; no state overwrite; uninstall URL registered to valid route; no identifiers in URL. |
| Local popup rule | `$popup` through stock userrules; packaged popup filter; allowed OAuth/new-tab control | SDK path is confirmed or precise unsupported status; original confirmed state restores on error; no second DNR writer. |
| Popup edge cases | Direct new tab, `about:blank` then navigation, redirect, delayed popunder, user middle-click | Known unwanted cases blocked where supported; legitimate controls work; unsupported paths documented. |
| Focus independence | Active focus + site ad pause/reset/popup-rule update + failed quota/config | Focus continues; confirmed state restored on failure; reset affects only requested hides. |
| Business tools | Public page plus authorized login/editor/preview checks | No newly introduced missing core script/resource, usable core UI; authenticated gaps explicitly limited. |
| Egydead | Default versus +Arabic list, landing and selected player | Exact observed outcomes for popups/frames/overlays/playback, with absent ad opportunities marked inconclusive. |
| YouTube | Multiple videos + playlist, default settings and chosen comparators | Comparable controls/configurations, playback controls intact; ads/opportunities measured honestly. |

## Readiness and smallest next action

Ready for bounded implementation: document-correct picker routing; persistent per-rule/site/all-custom-hide restoration with clear inherited scope; install-only welcome and verified uninstall/review routes. These need UI/localization and source review, then a new exact-package build and focused tests.

Not ready for broad filtering changes: no live Egydead player/popup evidence, no new YouTube comparative sample and no authenticated Meta/Google/Canva workflow evidence was collected by this audit. First reproduce the reported site in the coordinator's single browser lane, compare default and Arabic-list configurations, and preserve the exact requests/frame/new-tab evidence. Retain stock SDK authority and all existing focus/rollback gates.

## Authored bounded behavior runner

`B2/scripts/v2-behavior-audit.mjs` is a separate observation runner, never a build or product-source writer. Its default/`--check-only` mode validates package bytes and cached official comparator archives without launching Chrome. Authoring checks completed: `node --check` passed; `--check-only` confirmed all 112 baseline package hashes against fingerprint `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`, uBOL `2026.1026.1812` archive SHA-256 `d3788eac9f0a44c67f3745a43c3fd446ef33d56b1121f469b19e0fa0a836c2b5`, and AdGuard MV3 `5.5.3.3` archive SHA-256 `628b5da9749cf6b4730cf8ffe28b6afdb2b3e029c1acd918c73d7c4b2e90986e`. These are cached official versions, not a new latest-version claim.

After an explicit coordinator browser-lane grant only:

```sh
cd B2 # from the repository root
BLOKU_BROWSER_LANE_GRANTED=1 node scripts/v2-behavior-audit.mjs --run
```

The runner creates fresh task-owned profiles and immutable verified package copies, runs one Chrome 156 browser at a time, and stops at a 590-second default budget. It reports skipped/unattempted cases instead of silently extending the run. Five configurations are no extension, baseline BLOKU default, baseline BLOKU + Arabic list, cached official uBOL default and cached official AdGuard MV3 default. Fifteen URLs emphasize Google/Meta/Canva work tools, two YouTube samples, Twitch and the user's exact `https://a1.egydead.media/` hostname. The earlier static audit's `sitea1` spelling is historical input; this runner uses the coordinator-confirmed `a1` URL.

Local controlled fixtures observe ordinary OAuth-like `window.open`, cancel a native file chooser without selecting any file, and play/pause/seek browser-generated canvas WebM through native video controls. BLOKU additionally tries one local `$popup` user rule, distinguishing actual acceptance/closure from rejected conversion with preserved confirmed state, and restores its original settings. These fixtures never establish real account, OAuth provider or third-party media compatibility.

The public lane records bootstrap gates, scrolling, visible Canva template-search typing without submission, short YouTube player observations, and five seconds of heavy-site page/popover observation. Heavy-site watch/play links are inspected without starting a movie or download. It refuses downloads, uses no personal profiles, accounts or credentials, and does not bypass terms, CAPTCHA, consent, paywalls or login. Request URLs are stripped of queries/fragments and token-like path segments; console text/headers/bodies are omitted. Failed requests are not counted as verified blocked ads. Screenshots are explicitly `NOT_MANUALLY_REVIEWED` until the coordinator examines them. No new CPU/speed benchmark is performed.

Output goes only to a new `B2/artifacts/behavior-audit/<run-id>/` directory. Original baseline/comparator inputs are rechecked, loaded-copy hashes must remain unchanged, and only task-owned browser/profile/server/snapshot data is removed. No browser run had been performed when this authoring section was written.

## Completed baseline observations

After the coordinator granted the isolated browser lane, run `2026-11-02T05-56-18-547Z` completed **75/75 public attempts in 258.4 seconds, with zero harness failures or unattempted cases**, on Chrome `156.0.8078.80`. Evidence: `B2/artifacts/behavior-audit/2026-11-02T05-56-18-547Z/results.json` and `report.md`. There are 75 viewport screenshots. This completion count is a collector result, not 75 compatibility/effectiveness passes. Baseline fingerprint remains `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`.

All five variants passed the three owned synthetic behaviors: an ordinary OAuth-like window opened, a native file chooser opened and was canceled with zero selected files, and locally generated WebM played through native video controls, paused and accepted a seek. These do not qualify real OAuth providers, account flows or third-party players.

Both BLOKU configurations **rejected** the local `$popup` user rule with the exact message `Network rule with explicitly enabled $popup modifier is not supported`. Their original stored state remained byte-equal and was restored. The fixture's PASS concerns correct classification/preservation, **not successful popup filtering**. This confirms the adapter diagnostic-classification gap described above and justifies one precise supported-path fix followed by a direct gate; it does not justify ignoring other unsupported rules/quota diagnostics.

Observed default comparator configurations were not silently normalized: uBOL enabled six packaged sets (`ublock-filters`, `easylist`, `easyprivacy`, `pgl`, `ublock-badware`, `urlhaus-full`), 178 dynamic and 771 session rules, with recorded `popupBlockMode`/`strictBlockMode` and broad host permission flags. Cached AdGuard MV3 initially enabled only `ruleset_2`, with zero dynamic/session rules. BLOKU default enabled Base + Tracking Protection; the explicit Arabic variant added Liste AR. These differences preclude pretending the samples had identical filtering capabilities.

Manually reviewed screenshots and implications:

- `no-extension--canva-home.png`: Canva's explicit Cloudflare “Verifying…” page. All three Canva URLs returned HTTP errors in every variant. No template typing could meaningfully qualify the actual Canva UI. This is a shared restriction, not evidence for a BLOKU-specific defect, and no challenge was bypassed.
- `no-extension--meta-business.png` and `bloku-ar--meta-business.png`: same rendered Meta Business Suite login/marketing screen. `bloku-default--meta-business.png` was blank gray at its captured instant, without recorded failed requests or page errors. AdGuard also yielded a short-settle blank-shell signal. This remains a timing/regression candidate requiring one longer-settle isolated reproduction, not a demonstrated deterministic BLOKU defect or reason for a blanket domain allow. The automated `PUBLIC_BOOTSTRAP_OBSERVED` classification for rendered `/business/loginpage/` means only a visible login screen; the auth heuristic does not recognize this pathname.
- `no-extension--egydead-a1.png`, `bloku-default--egydead-a1.png`, `bloku-ar--egydead-a1.png`: visually intact Arabic homepage/catalog, with no obvious foreground overlay in the captured viewport. No variant produced an automatic new-tab/popunder during its five-second homepage observation. No movie/player link was clicked, so click-triggered popups, iframe playback, player advertisements and play-button usability remain unqualified. The collector's modal flag is provisional and does not establish a visible obstruction in these screenshots.
- `bloku-default--youtube-elephants.png`: actual elephant-clip frame, normal player controls and public page. The no-extension/BLOKU/BLOKU+Arabic samples recorded approximately 1.78 seconds of playback, readyState 4 and no media error. All three also showed zero observed ad markers/slots, including the control, so ad-blocking superiority is **inconclusive**. NASA's selected stream supplied no meaningful ready-state/playback observation.
- `adguard--youtube-elephants.png`: actual clip/player rendered despite an earlier automated `SHELL_LIMITED` text probe, proving the short-settle heuristic can become stale during hydration. Do not score this as an AdGuard playback failure or derive a winner from the raw status table.

No actual account, business dashboard, design edit/export, ad creation/spend, message, checkout, meeting or Store action occurred. No known authenticated state, headers, cookies, request bodies or URL queries were captured. Cached package input hashes and loaded snapshot bytes remained unchanged. The owned server/browser/profiles/snapshots were removed, and a subsequent process/directory check found no remaining `behavior-*` work directory or browser using its profile. The specialist explicitly released the browser lane afterward; further runs require a fresh coordinated grant.

## Provisional current-package gate: incomplete, stopped

The coordinator supplied provisional fingerprint `9c62af8a983dabf7de01884309fa8b295506d7d7edb44c13d71ff23719c4b767` and granted a separate bounded current-only lane. This package is distinct from the immutable 4104 baseline. Its 112 checksums were verified before testing; the runner copied it rather than building or editing it.

The stronger fixture requires all of: a targeted popup demonstrably opening before the local rule; successful SDK rule acceptance; native window references closing for immediate and initially blank/50-ms-delayed navigations; ordinary OAuth-like windows remaining usable with the rule; and direct target navigation remaining available. `BLOKU_REQUIRE_POPUP=1` makes rejection/failure a stopping gate, not a successful preservation-only test. The public heavy case was authored to click a safe visible catalog detail link and then a visible watch/play control, refuse download/security/account/payment controls, observe only five seconds, and pause any discovered videos. A separate Meta Business no-extension control uses a 3.8-second settle. Own BLOKU website/backend DNS blocks apply uniformly, preventing startup welcome/uninstall routes from exercising the old published website; their public functionality cannot be qualified by this run.

Two interrupted/incomplete observations are retained:

- `2026-11-02T06-26-38-635Z`: an unhandled target-waiter timeout occurred while Puppeteer's `Page.click` was still pending, before a fixture result or SDK popup test was recorded. This is a harness interruption. The coordinator identified an existing host-idle/RAF automation issue and directed use of the stable instant-scroll/bounding-rectangle/real-mouse helper with explicit 100-ms polling. The known temporary directory was removed only after process/open-handle checks.
- Corrective run `2026-11-02T06-29-24-431Z` stopped after 47.0 seconds with status `REQUIRED_FIXTURE_FAILED_STOPPED`, one longer-settle no-extension Meta Business login-screen observation, and 30 current public cases unattempted. The retained Arabic configuration reached SDK **acceptance** of the local popup rule, so the prior conversion rejection was not observed for that configuration. The default configuration did not retain sufficient fixture detail for an acceptance conclusion. However, no closure claim is qualified: the retained Arabic fixture's before-rule popup-target waiter timed out, followed by its immediate targeted-closure waiter timing out. Failure of the positive control prevents attributing this to the SDK. Ordinary OAuth-like popup, native file chooser and generated-video checks passed in that retained Arabic fixture.

The default current fixture hit a harness assertion because `UPDATE_STATE` canonicalized an absent optional `embeddedHides` field to `[]`; its original byte-string comparison treated this semantic no-op as a state change. Because that collector persisted fixture results only at the end, the default fixture's individual test details were not retained; do not infer their outcomes from acceptance alone. The authoring-only runner now compares full state structurally after normalizing exactly this optional empty collection, records every fixture/check immediately, attaches rejection handlers immediately, stops at the first required failure, and captures the native window reference and sanitized open-page URLs on failure. `node --check` passed after those changes. **No additional browser retry was run.**

No current heavy-site clicks, current YouTube matrix, current Meta-vs-control conclusion or lifecycle/public-route acceptance was obtained. Original baseline and comparator evidence remains unchanged. Both interrupted runs' owned browsers and profiles are gone; subsequent process/directory checks found no remaining task-owned browser or `behavior-*` work directory. The specialist released the lane and reported the exact limits. The next action is to diagnose the local positive control under a fresh explicit lane grant before making any filtering change or broad compatibility claim.

Historical relocation after this baseline audit:113 v1 runtime/document/script files were moved into legacy/v1.1.3 with every byte hash preserved. Generated historical packages are isolated in ignored B2/legacy-builds. Their old claims are no longer mixed into the active extension source. New fixes still require current-build browser qualification.
