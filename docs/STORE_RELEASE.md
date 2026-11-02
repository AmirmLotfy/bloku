# Bloku 2.0 store/reviewer material — DRAFT—NOT QUALIFIED

This document and `B2/store/locales/*.json` describe the 2.0 candidate. Preparing or validating text does not build, deploy, submit, publish or qualify a package. The primary coordinator owns qualification of the exact final artifact. Descriptions and screenshot captions must match that artifact before entering a live listing.

## Listing source

Eight localized drafts are available: English (`en`), Arabic (`ar`), Spanish (`es`), Brazilian Portuguese (`pt_BR`), French (`fr`), German (`de`), Japanese (`ja`) and Hindi (`hi`). The approved English title is **BLOKU — Ad Blocker & Focus**. Its exact 112-character summary is:

> Block ads and trackers, hide distracting feeds, and schedule focus time. All features free. No account required.

Each JSON contains `status`, `title`, `summary`, `description` and five entries in `screenshotCaptions`. Titles fit 75 characters and summaries fit 132. This revision changes descriptions only; titles, summaries, captions and schema remain intact for the asset workflow. Captions need corresponding real screenshots of the qualified package. The copy makes no user-count, ranking, machine-learning, exact lifetime-statistic or guaranteed performance claim.

Descriptions cover free ad/tracker blocking, per-site controls, the element picker, distraction presets, YouTube Shorts/comments/home-feed/recommendation controls, 25-minute sessions, recurring focus schedules, daily site allowances, local settings import/export and optional local activity. Presets cover nine domain keys across eight services because both `x.com` and `twitter.com` are included. Available controls vary by supported site. Video blocking is best effort; playback and changing site layouts limit coverage. Protected Chrome pages cannot be modified.

All eight descriptions explain opt-in supported-cookie rejection and clicked-link tracking cleanup. They omit GPC from advertised privacy benefits. The UI instead labels its JavaScript-only feature “Website privacy preference (limited)” and explicitly states that the Sec-GPC HTTP header is not sent and this is not complete GPC support. They explain local data behavior and requested permissions in ordinary language and include the support and privacy URLs: `https://bloku.app/support` and `https://bloku.app/privacy`. They specify **Chrome 145 or later**, matching the candidate manifest.

The website sponsor link is currently hidden. The descriptions do not claim that donations are available. Any future donation route must remain optional and independent of extension features; it would require its own website/payment disclosures.

## Reviewer explanation for the candidate

**Single purpose:** help users reduce ads, tracking and browsing distractions through local filtering and focus controls. All extension features are free, with no account, payment or subscription required.

**Engine and execution:** the candidate uses pinned `@adguard/tswebextension` SDK **6.0.1**, Manifest V3 and Chrome Declarative Net Request (DNR). Chrome applies packaged static and locally configured dynamic network rules. Packaged cosmetic rules hide unwanted elements; packaged scriptlets and generated local script functions handle supported page behaviors. Upstream filter inputs are pinned and executable behavior is built into extension assets. There is no remote hosted executable code or runtime executable-code download in this design. Executable behavior changes ship in an extension update. The integrated final package must substantiate these statements; an isolated SDK fixture alone is insufficient.

**Privacy choices:** cookie rejection, clicked-link cleanup, the limited website privacy preference and YouTube autoplay controls are optional and off by default. Cookie rejection is limited to supported dialogs and rejects optional cookies rather than accepting them. Link cleanup removes known tracking parameters on clicked links, with guards for recognized signed links. These controls do not guarantee coverage of every consent dialog or tracking URL, anonymity or complete fingerprint protection.

**GPC limitation:** the current limited preference exposes `navigator.globalPrivacyControl` to page scripts as a do-not-sell/share preference. BLOKU does **not** send the `Sec-GPC` HTTP header, so this is **not complete Global Privacy Control (GPC) support**. UI help and website privacy paragraphs state this explicitly in all eight languages; store descriptions do not advertise it as a GPC benefit. The stock SDK couples its HTTP GPC option with DNT and has additional exception/DOM lifecycle limits, so merely enabling that option would not establish complete support. This copy correction changes no engine behavior. The [24 September 2026 W3C Working Draft](https://www.w3.org/TR/2026/WD-gpc-20260924/) describes both HTTP and DOM signals and navigation-cached preferences; no conformance claim is made for the current feature.

**Local data:** filtering, page controls and focus decisions run in the browser. Settings, custom rules and optional activity records remain on the device. Activity accounting is limited to sites explicitly included in focus profiles and uses observed active time. With history off, only today's counters needed for daily allowances remain; enabling local history retains up to 90 days of summaries. Users can export settings or clear local activity. The SDK adapter disables statistics collection and declarative logging; no browsing history or extension telemetry is sent to BLOKU servers by this design. Current-page network-rule matches are distinct from hidden elements, observed focus activity and any separately retained v1 estimates. They are not exact lifetime totals.

Website visits are separate interactions and may expose normal request metadata to the website host. The privacy policy and store data declarations must accurately distinguish local access/processing from transmission and match the final candidate's retention/deletion behavior.

## Candidate permissions

`B2/v2-manifest.json` declares version `2.0.0`, minimum Chrome `145`, ten API permissions and HTTP(S) host access. The explanations below match that candidate manifest; release review must compare the actual packaged manifest too.

| Permission or access | Actual purpose |
| --- | --- |
| `declarativeNetRequest` | Apply packaged ad/tracker filtering and local focus/site network rules in Chrome. |
| `activeTab` | Permit user-invoked current-page inspection and page controls, including current-page matched-rule access. |
| `scripting` | Run packaged page-control logic and the element picker, and apply or restore the limited JavaScript privacy-preference property in the current document; it does not send an HTTP GPC header. |
| `storage` | Persist settings, site policies, custom rules, focus state and local activity data. Session storage holds current navigation/observation context. |
| `unlimitedStorage` | Keep the filtering engine's local indexes and persisted rule data without the normal extension storage quota. |
| `webRequest` | Supply request lifecycle and tab/frame context to the filtering SDK locally. Network blocking uses DNR; observed metadata is not uploaded. |
| `webNavigation` | Maintain current document/frame context for the SDK and navigation boundaries for current-page rule counts. |
| `alarms` | Reconcile focus schedules, session/break deadlines, temporary ad pauses and local allowance accounting when the worker wakes. |
| `idle` | Exclude idle use from observed active-time accounting for configured focus sites. |
| `contextMenus` | Provide the user-invoked “hide an element” entry point on ordinary websites. |
| `http://*/*` and `https://*/*` host access | Apply filtering and chosen page/distraction controls across browsing sites, including user-selected focus sites, rather than only extension pages. Chrome-protected pages remain outside this access. |

The candidate does **not** request `tabs`, `cookies`, `userScripts`, `declarativeNetRequestFeedback` or `webRequestBlocking`. Using the `chrome.tabs` API with the declared host/active-tab access does not mean a `tabs` permission is requested. SDK cookie mutation/stealth features are disabled, and the build excludes network rules that require cookie capability. Scriptlets are packaged; the design does not require the `userScripts` API. No permission is justified merely because the SDK offers it.

Chrome references: [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest), [webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) and [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).

## Qualification boundary

Before submission, the coordinator must record the final package path/hash/version, compare its actual manifest and assets, verify integrated behavior, match each description and screenshot to the packaged controls, and align the website, privacy policy and store data declarations. Read the current runtime and engine reports for their actual results and limits. This text review does not substitute for those checks or assert that live video/social sites, every consent vendor, schedule/timezone boundaries or long-term retention have all been exercised. The final checksum-manifest fingerprint is `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`; its current UI captures and exact-ZIP runtime evidence are recorded in the corresponding reports. Later changes require requalification of affected behavior and assets.

Billing retirement is documented separately in private operational records. Historical backend records do not make licensing part of the 2.0 extension or establish that the organization has never received payments. No deployment or financial action is performed by this copy revision.

## Text validation

From the repository root, run `node B2/store/validate-copy.mjs` and `node B2/store/validate-ui-locales.mjs`. The first parses all eight draft JSON files, enforces the draft status/schema and title/summary limits, checks the exact approved English text, and requires five captions per locale. The second verifies all **120 UI keys** against English, including ordering, nonempty strings, placeholders, brand/technical names and unintended identical English values. Shared native spellings and established product names are intentional.

Both validators passed after this description revision. Native-speaker review has not been independently obtained. Text validation is not browser layout, runtime, store submission or final package acceptance.

## Final disclosure and upload reconciliation

Use the final archive hash and the evidence handoff before entering the dashboard. Google requires a privacy policy and accurate disclosure of local processing; offline behavior does not justify claiming that no user data is handled. The SDK receives transient request/response headers, potentially including Cookie/Set-Cookie values and session identifiers. It does not request cookie-management permission, but that does not establish absence of authentication-cookie access. Persistent request logging and external telemetry remain disabled. Do not claim that Authorization headers were observed: Chrome excludes certain sensitive headers from the relevant API.

The declaration should describe URL/navigation context, page content, optional configured-site usage and transient header handling as local functions. Review the actual dashboard category help for web browsing history, website content, user activity and authentication information against this behavior; do not automatically uncheck categories merely because data is not sent to a server. The owner must make the final truthful certification in the current dashboard. The extension has no account, payment, credit decision, advertising-data sale or third-party browsing-data transfer function. Historical website/billing records are separately disclosed.

Select **No remotely hosted code**: executable scripts and scriptlets are packaged; local user executable rules and remote subscriptions are excluded. Do not describe the dormant bundled SDK constructor helpers as an unsafe-eval permission; the manifest does not allow unsafe-eval.

The Store accepts five screenshots per locale. Its small and marquee promotional tiles are global, not localized: use the English 440×280 and 1400×560 files for the global fields. The other localized tile variants are supplementary marketing assets, not extra localized Store tile fields. See [Google's listing-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [local-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), rechecked during qualification.
