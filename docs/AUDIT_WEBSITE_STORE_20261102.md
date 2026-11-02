# Website, discovery and Store journey audit — 2 November 2026

## Scope and evidence

Read-only review of the current website, shared product metadata, candidate Store copy and v2 lifecycle entry point. Baseline at review start: private working branch `codex/bloku-2.0`, HEAD `2457233`; initial working tree clean. Read `AGENTS.md` and the final 05:36 UTC `.local/IMPLEMENTATION_HANDOFF.md` checkpoint first. No backend credentials, account data, payment mutations, browser lane, build or deployment was accessed. This report does not certify Store acceptance, legal compliance, live Core Web Vitals, PayPal account readiness or ranking.

Lightweight local checks read the existing `Bloku-Website/dist` only: 96 routes, 72 indexable routes, no duplicate titles, and a `main h1` on every route. Existing tests cover SSR content, canonical/hreflang reciprocity, fragments, utility noindex, 72 sitemap URLs and real 404 status. Those tests were read, not rerun in this audit. Root owns the single build/browser lane and final implementation decisions.

## Prioritized findings

| Priority | Evidence | Finding and patch-ready action |
| --- | --- | --- |
| P1 | `B2/src/background.ts:116–139,281–294`; compare excluded legacy `legacy/v1.1.3/background.js:563–577`; website `src/App.tsx:658–704` | v2 has no `runtime.onInstalled` listener or `setUninstallURL`; `/hey` and `/bye` exist but new installs do not reach them. Restore one lifecycle handler: first install opens the localized welcome once; initialize/install/update sets a clean localized goodbye URL. Do not open welcome on extension update, browser update, reload or worker wake. No identifiers, browsing URL, counters or payment fields in the goodbye URL. An older registration may survive an upgrade; that behavior was not tested here, so refresh it explicitly. |
| P1 | `Bloku-Website/src/entry-server.tsx:87–91`; `src/content/en.ts:23,70,183`; handoff final checkpoint | Candidate HTML advertises 2.0 and links to the existing Store item while public Store/site remain the previous release. This is a release alignment gate, not permission to publish: keep the preview protected/unindexed until the owner coordinates Store availability and public policy accuracy. On public promotion verify production robots allow crawling, root/privacy/support return 200, missing routes return 404, and version-specific copy matches the Store. |
| P2 | `Bloku-Website/src/App.tsx:34–46`; `index.html:8–10`; public image dimensions | Each themed logo is 1000×1000 and 52,850 bytes; favicon PNG is also 1000×1000 and 52,850 bytes. Logos display at 22–68px. Produce small faithful derivatives from the original brand image, retaining enough pixels for the 68px/2× use; use an appropriate icon/touch-icon size. Do not replace the brand. Measure resulting transfer and visual fidelity. Both themed images are present in markup; actual browser request behavior needs the root browser check. |
| P2 | `Bloku-Website/src/content/en.ts:64–65,190–191`; `B2/v2-manifest.json` | Website states desktop Chrome but omits the actual minimum version 145. Add localized compatibility text near installation/help rather than leaving users to discover the requirement at the Store. Keep the manifest the authoritative version source to avoid drift. |
| P2 | `shared/product.json:1–9`; `Bloku-Website/src/App.tsx:744–784`; `src/content/en.ts:258–259` | Current public source and GPL-3.0 are not discoverable from the website. Add a shared verified source URL plus a plainly labeled source/license link, and identify the software license in terms while retaining artwork/trademark and third-party notices. Do not describe the whole brand as GPL. The final handoff reports `https://github.com/AmirmLotfy/bloku`; root should read back the public destination before wiring it. |
| P2 | `shared/product.json:9`; `Bloku-Website/src/App.tsx:744–784` | Funding is hidden and `sponsorsUrl` is not consumed by website markup. Setting that field alone will not create a support path. Add a provider-neutral optional funding URL and localized website-only support copy. Keep null/hidden until the owner supplies or verifies the intended destination. Do not fabricate a PayPal handle from the brand. Suggested copy: “Support BLOKU” / “Optional support helps maintain BLOKU. Every feature remains free.” |
| P3 | `Bloku-Website/src/content/en.ts:4`; `src/entry-server.tsx:49` | Homepage title leads with a slogan and omits “Chrome ad blocker,” while the description contains it. A clearer title such as “BLOKU — Free Chrome ad blocker and focus tools” better describes the page. Preserve natural localized phrasing; do not repeat keywords or claim ranking benefits. Feature titles are already unique. |
| P3 | `Bloku-Website/src/App.tsx:715,770`; `src/content/*:footer.version,footer.updated`; `shared/product.json:3` | Release number, footer year and policy date are repeated literals. These are metadata-maintenance risks, not inherently false claims. Share version/release metadata; keep policy effective date explicit and editorial, changing it only when policy changes. Do not use the current date automatically as a fake freshness signal. |

## Legacy traces versus current shipping material

`legacy/v1.1.3/docs/CHROME_STORE_DESCRIPTION.txt:3–26` still claims lightweight architecture, a free-tier five-site whitelist/seven-day history, premium upgrades and Polar subscription handling. It must not be used for 2.0. The current archive allowlist (`B2/scripts/v2-release-artifacts.mjs:22–38`) excludes legacy historical documentation and root legacy background, and current Store descriptions are `B2/store/locales/*.json`. Prefer an explicit legacy marker/archive move for those old copy files if root cleans documentation; do not delete historical behavior evidence or claim the old files ship in v2.

Current website/Store marketing contains no active paid tier, fabricated rating, user count, “fastest” or universal ad-removal promise in the sections reviewed. Remaining Polar mentions explain historical records and should stay accurate rather than being erased merely as old branding. The interactive hero is expressly labeled an illustration (`src/content/en.ts:72–90`). Actual product images are separate. Export includes local statistics but omits timed sessions (`B2/src/migration.ts:101–104`); importing does not restore historical usage/session state (`background.ts:242–251`), so do not advertise full state restoration.

## Performance measurements and limits

Existing files, read without a rebuild; bytes are exact local sizes, compression estimates are Node zlib output and not verified host responses:

| File | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `dist/assets/index-BgoDvDG_.js` | 164455 | 51559 | 44904 |
| `dist/assets/index-Czp_4xh9.css` | 39640 | 7598 | 6526 |
| `dist/index.html` | 41787 | 10182 | — |
| `dist/privacy.html` | 28533 | 8291 | — |
| `dist/features/focus.html` | 27294 | 8354 | — |

Home includes four 1280×800 JPEG captures; English files range from 68–84 KiB. `FeatureVisual` already reserves dimensions and uses lazy loading/async decoding (`App.tsx:382–388`). No urgent bundle rewrite is established by these sizes. The HTML contains approximately 15.6K characters of current-locale page context, needed for the existing hydration design. Keep the SSR benefits and pursue further splitting only if profiling identifies a meaningful cost. Product captures currently have one full-size source; responsive derivatives may reduce mobile transfer, provided readable enlarged captures remain available. Preserve the no-tilt requirement and existing reduced-motion/RTL behavior.

Root's bounded browser check should measure cold-load mobile LCP/CLS and interactions on home, one feature and privacy, then compare the same conditions after any asset change. Google’s reference thresholds are LCP ≤2.5s, INP <200ms and CLS <0.1. Lab observations do not establish 75th-percentile field performance; use Search Console/CrUX when enough public traffic exists. [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)

## SEO and AI discovery

Keep the existing prerendered text, one h1, self-canonical, eight reciprocal language alternates/x-default, sitemap and genuine 404 behavior. They support discoverability without client JavaScript. Do not add fabricated ratings, testimonials or unsupported feature schema. Homepage SoftwareApplication offer correctly states zero price; it must match visible free access and the Store release.

The current Google guide prioritizes useful original content, accessible text and a clear technical structure. It says indexed/snippet-eligible pages also require inclusion under Search Console's Search generative AI control; the linked help says inclusion is default or inherited. Read the actual property setting with the owner later; do not infer its state from HTML. Special AI files, special schema and keyword variants provide no Google visibility guarantee. Use real how-to material, limitations and release history for users. Search Console can measure discovery after public release; no ranking or inclusion is guaranteed. [Current Google guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Search generative AI control](https://support.google.com/webmasters/answer/16908024)

Optional follow-up content should answer concrete questions already supported by the product: allow a site, restore a hidden element, configure focus, explain local records, and explain which controls affect video playback. Do not manufacture comparison rankings or publish replicated query pages. A public source/license link and accurate release status improve verifiability; their direct ranking effect is not established here.

## PayPal support placement and owner handoff

PayPal's public countries page explicitly lists Egypt for PayPal.Me. Its Egypt help says PayPal.Me supports personal/business accounts, with business accounts accepting goods/services payments. Its separate Egypt receiving guide requires confirmed email and a confirmed Visa credit card or US bank account. This verifies country availability, not this owner's eligibility, payout readiness or an approved transaction type. Do not create an account, attest eligibility, select legal/tax classification or initiate a test payment. [PayPal.Me countries](https://www.paypal.com/paypalme/pages/countries), [Egypt PayPal.Me help](https://www.paypal.com/eg/cshelp/article/what-is-paypalme-help432), [Egypt receiving requirements](https://www.paypal.com/eg/cshelp/article/how-do-i-receive-money-through-paypal-help667?locale.x=en_EG)

Recommended interface: a modest footer/support-page link opening the owner-verified PayPal-hosted destination only after a click. Keep payments outside the extension and avoid loading a payment SDK/iframe on ordinary website visits. The copy must make support optional, grant no extra feature access, and make no charitable/tax-deductibility claim. An ordinary support payment must not be represented as a registered-charity donation. Add website/privacy wording that PayPal handles a voluntary payment under its own policies; BLOKU receives whatever support-payment information the provider exposes. Do not promise anonymity, zero fees, supported cards/currencies or refunds without actual provider/account evidence.

Owner's final step: open PayPal account settings personally, verify the legal recipient identity and account readiness, obtain the actual support link, open it signed out to check displayed recipient/currency/amount behavior, then give that URL to the coordinator. A provider-hosted link that merely opens successfully is not proof that a real payment/withdrawal will succeed.

## Install, uninstall and reviews

Chrome documents `onInstalled` as firing for installs, extension updates and Chrome updates. Restrict automatic welcome to the install reason; use the existing noindex `/hey` page with pinning/settings/help. The documented `setUninstallURL` opens an HTTP(S) URL after removal; no survey backend is required for the existing optional email feedback. Verify first install, update/reload, browser restart/worker wake, locale fallback and actual uninstall in a disposable profile. Keep uninstall data-loss explanation and previous-payment distinction; never suggest uninstall/reinstall as routine upgrade advice. [Chrome runtime lifecycle API](https://developer.chrome.com/docs/extensions/reference/api/runtime)

The current reviewed UI has no review solicitation. If adding one, use a user-clicked, neutral “Write a review” link to the genuine Store item. Do not preselect a star rating, reward reviews, gate features, solicit only happy users, or fabricate reviews/counts. Place review access in help/settings after normal use rather than in the first-install or uninstall journey. These placement choices are UX recommendations, not a claim that Google mandates that exact location. Google's policies prohibit illegitimate/incentivized review/rating/install inflation and inaccurate listing/privacy metadata. The same policies cover landing pages and marketing. [Chrome Web Store policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

## Coordinator acceptance checklist

1. Apply only chosen source changes; avoid backend/provider mutations and final publication.
2. Run the website check once after the chosen copy/asset edits. Add regressions for accurate compatibility/source/funding links and lifecycle install/update behavior where implemented.
3. In the single browser lane, verify level cards, Frameless URL, readable faithful images, eight locale routes and Arabic RTL; compare bounded performance samples under the same conditions.
4. Rebuild/requalify extension artifacts if lifecycle source changes; website-only asset/SEO changes do not justify claiming extension runtime requalification.
5. Regenerate affected candidate/source archives and update provenance/handoff. Keep owner-controlled Store submission and website promotion explicit.

## Authorized website implementation checkpoint

The coordinator subsequently authorized source edits within the website/shared metadata only. This supersedes the audit's earlier recommendation to keep funding hidden pending a destination: the owner created and the coordinator verified `https://www.paypal.com/ncp/payment/H2Y4B9EM6CF5C`, labeled Support BLOKU, for a customer-chosen one-time EUR amount, no shipping/recurring payment or feature benefit. This specialist did not access the payment account or execute a transaction.

Source now uses a provider-neutral `fundingUrl`, a source repository URL, `GPL-3.0-only` and minimum Chrome 145 in shared metadata. All eight website locales have descriptive Chrome/ad-blocker homepage titles, compatibility text, a source/license link, optional support/no-extra-benefit/amount/fee copy, and a PayPal-processing privacy section. Funding links are plain external links in the footer and third support sidebar section. No PayPal SDK, iframe, form, subscription path or extension upsell was added. Policy/terms effective dates were editorially advanced to 2 November for these actual changes. The original feature screenshots, social images, level cards and publisher URL are preserved.

All former themed-logo and favicon PNGs were the same original 1000×1000 image, SHA-256 `f191e688ae0f8bbbff20bd9796ae68c60b73adb8030a34110d00b9d4b5768331`. That original is retained unchanged in `Bloku-Website/scripts/branding-original.png`. Native macOS sips produced one 204×204 transparent logo (3× the largest 68px UI use), a 32px PNG/ICO favicon and 180px touch icon. `scripts/optimize-branding.mjs` and `scripts/branding-provenance.json` record source/output hashes and exact sizes. Two byte-identical themed copies were removed from public markup/assets; the original artwork remains retained.

| Branding resource set | Before | After |
| --- | ---: | ---: |
| Two logo PNGs + favicon PNG + ICO / one logo PNG + favicon PNG + ICO + touch icon | 190588 bytes | 45597 bytes |

The published asset set is 144991 bytes smaller (76.08%). This is an artifact-size comparison, not a measured page transfer, CWV or speedup claim. The source-logo download shrank from 52850 to 19827 bytes and now uses one URL across both themes. The original old `dist` JS/CSS/HTML is deliberately untouched until the coordinator grants the build lane, so the earlier bundle measurements remain baseline only.

Two regression tests were authored for all-locale funding/source/compatibility destinations and no payment embeds, plus brand source provenance, derivative dimensions/size and published output matching. `git diff --check` on owned source passed. Typecheck/lint/build/tests/browser remain pending the coordinator's lane grant; no external deployment or source publication was performed by this specialist.

## Completed local validation after lane grant

The coordinator granted the single heavy lane. Baseline dist was measured first, then its browser closed. `npm run check` passed TypeScript, lint, build and 10/10 tests; output remains 96 pages/72 indexable URLs. Current JavaScript is 165761 bytes (51870 gzip), CSS 39765 (7624 gzip). Necessary localized UI increased the bundle slightly; only branding assets were reduced.

Registry Lighthouse 13.6.0 requires Node ≥22.19, exceeding the tested host 22.13.1; no install was attempted. The approved existing-CDP fallback used verified Chrome 156.0.8078.80, isolated no-extension contexts, cache disabled, 390×844 mobile emulation/DPR1, 4× CPU slowdown, 150ms latency and 200000/93750B/s down/up throughput. Twelve baseline and twelve current samples (three each for EN/AR home/support) observed LCP and maximum CLS session window through load+2 seconds without interactions. An initial hostname-rule setup failure was fixed to allow loopback before valid samples.

| Route | Median LCP baseline → current | Body bytes baseline → current | Maximum observed load-window CLS |
| --- | ---: | ---: | ---: |
| `/` | 1204 → 1056ms | 519723 → 356161 | 0 |
| `/ar` | 1372 → 1192ms | 523853 → 360975 | 0 |
| `/support` | 1028 → 896ms | 423611 → 260735 | 0 |
| `/ar/support` | 1184 → 1068ms | 431042 → 268823 | 0 |

This small sequential local uncompressed-host sample supports a bounded observation, not a public-host, real-device, INP, field-CWV, Lighthouse-score or universal speedup claim. Network/body-byte changes include both branding and current page content. [DevTools performance controls](https://developer.chrome.com/docs/devtools/performance/reference), [LCP measurement](https://web.dev/articles/lcp), [CLS session windows](https://web.dev/articles/cls)

After-build checks passed 32/32 surfaces (home/support × eight locales × desktop/mobile): loaded images, correct language/direction, no horizontal overflow, level cards, publisher/source/funding URLs, no embedded payment interface, and actual Tab reachability/visible focus for both new external links. No external page request, PayPal request, console error or runtime page error was observed. EN desktop light/AR mobile dark optional-support placement was captured and visually reviewed, in addition to eight initial home/support captures. Native-speaker and screenreader acceptance were not obtained.

Reports/provenance/screenshots are ignored local evidence in `Bloku-Website/artifacts/website-lab`. Runner `scripts/website-lab.mjs` records methods, exact input hashes and versions; summary records runner hash and cleanup. All owned browsers/profiles closed and were removed. Local server PID51236 was verified against cwd/port4176, terminated, and the listener confirmed absent. The heavy lane was released. Public site, existing protected preview and payment configuration were unchanged by this validation.

## Privacy disclosure follow-up — source only

The coordinator then restored a one-time fresh-install welcome visit, uninstall goodbye URL and manually chosen About links in the extension. This specialist changed only the eight website locale privacy sections to disclose the automatic welcome/goodbye visits, ordinary host metadata (IP, browser request headers and access time), and absence of appended identifiers, visited website URLs, settings or local activity. The copy distinguishes these visits from locally processed browsing history and states that BLOKU requires no account/license. It also explicitly identifies transient request/response headers, possible Cookie/Set-Cookie session values, local processing, no request-log retention or BLOKU upload, and no cookie mutation. Existing optional PayPal processing remains separately disclosed.

No build, test or browser/lab rerun was performed for this source-only follow-up. The prior lab remains evidence for its recorded input hashes. Because the current SSR context serializes the entire current-locale copy on every route, changed privacy text will change the payload/hash of rebuilt home/support HTML as well, even though their visible content/layout is unchanged. The coordinator must preserve that prior-build boundary or rerun affected samples before attributing the prior timings to a newly rebuilt exact website.


Historical relocation after this baseline audit:113 v1 runtime/document/script files were moved into legacy/v1.1.3 with every byte hash preserved. Generated historical packages are isolated in ignored B2/legacy-builds. Their old claims are no longer mixed into the active extension source. New fixes still require current-build browser qualification.

## Owner visual correction and final local website check

The owner explicitly preferred the original UI/UX on 2 November at 09:05, including the website. The visual implementation now restores the original source's warm cream/espresso palette, burgundy/rose buttons, strong left-aligned desktop hero and substantial interactive product panel beside it. Cards remain level. Existing V2 accurate free copy, no-account behavior, optional provider-hosted support link, privacy disclosure, static SEO and eight languages remain. No old premium/pricing/tracking behaviors were restored.

TypeScript, lint, static generation and all ten website regression tests passed. The bounded lab `Bloku-Website/artifacts/website-lab-restored-20261102/after.json` passed all 32 home/support locale/device surfaces with no horizontal overflow, tilted cards, image failures, external page requests or console/runtime errors. Twelve local cold mobile-emulation samples (four pages × three runs, CPU4x/150ms RTT/1.6Mbps) recorded median LCP: English home1088ms, Arabic home1488ms, English support964ms, Arabic support1236ms; observed load CLS0. These are local lab values, not public field CWV, Lighthouse scores or guaranteed rankings. Initial-HTML/asset hashes in that report identify the tested build; do not compare its timings as isolated design effects because copy/layout also changed.

The coordinator inspected the current website in the in-app browser at1280px, including English espresso and Arabic mirrored porcelain hero. Screenshots are `artifacts/audit-20261102/website-restored-en-dark.jpg` and `website-restored-ar-light.jpg`. This build has not yet replaced the public1.1.3 website or the older protected RC1 preview. Store draft/publication remains unchanged; final submission/publication remains with the owner.
