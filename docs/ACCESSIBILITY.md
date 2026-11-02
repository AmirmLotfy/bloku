# BLOKU 2.0 accessibility qualification

The bounded runner is `B2/scripts/v2-accessibility-check.mjs`. It reads the existing qualified-input package, opens an owned Chrome for Testing 156 profile, and inspects the actual options and popup UI. It never builds or modifies `B2/dist`, injects replacement UI/CSS, uses the user's browser profile, browses public websites, or publishes anything.

**Current status: the runner source now audits the compact popup’s collapsed and expanded native disclosures at its intrinsic 380px width. This revision has not been executed.** The earlier 289-check run below belongs to its historical package and popup design. Native toolbar-popup 200% enlargement is explicitly SKIP; extension-tab zoom is not native popover zoom. Future runs require the shared browser-lane grant. This remains bounded evidence, not a WCAG conformance claim.

Historical authoring checks passed: Node syntax validation and the read-only preflight for all eight locales and 113 package files, initially against checksums-manifest SHA-256 `efe04b515af36607c1485ba0cfaf223c39d85c7fe34f15067a2e866444070c67`. Those authoring checks did not launch a browser; subsequent executions are recorded below.

```sh
node --check B2/scripts/v2-accessibility-check.mjs
node B2/scripts/v2-accessibility-check.mjs --check-only
node B2/scripts/v2-accessibility-check.mjs --run --locales en,ar --screenshots
node B2/scripts/v2-accessibility-check.mjs --run --expected-checksums 7b0424948d80021bc3564b551d6710d6a3f32a60ff99d6d86f71f90665ec34c5
```

`--check-only` validates inputs without launching Chrome. Omit `--locales` to test `en`, `ar`, `es`, `pt_BR`, `fr`, `de`, `ja`, and `hi`. The optional fingerprint argument refuses a different built package. `--screenshots` captures evidence only for English and Arabic; it never adds screenshots for the other six locales.

## Intended checks

For every locale, the runner inspects all six options sections and the actual popup document in an extension tab associated with an owned `http://a11y.bloku.test` fixture. This does not create a toolbar popover. It seeds ordinary preferences through the trusted API: locale, light theme, a disabled focus profile with weekday/daily-allowance fields, selected YouTube presets, a saved element hide, and a local rule. The owned active hostname uses the distraction disclosure’s fallback/settings controls rather than qualifying live supported-site preset checkboxes. Activity storage remains disabled, and no fabricated counters or historical records are added.

| Area | Actual observation |
| --- | --- |
| Language and direction | Exact document language, explicit direction, computed body direction, translated headings, Arabic RTL, and a status region. |
| Accessible controls | Chromium’s accessibility tree exposes nonempty names for buttons, checkboxes, textboxes, comboboxes, links and native disclosure triangles. Icon-only buttons require explicit aria-labels. Positive tabindex is rejected. |
| Keyboard focus | Real Tab traverses visible controls and summaries in protection, focus, local-rules and both popup states. Each visited element must expose native focus, a nontransparent outline at least 2px wide, and viewport intersection. Hidden disclosure descendants are excluded. Native time segments are recorded without assuming a trap; any 40-control cap is reported. |
| Disclosure behavior | All three native details/summary pairs must have localized names. Descendants must be hidden while collapsed and visible while expanded. Real Tab plus Enter/Space expands and re-collapses them. All summaries must be reached in both keyboard traversals. |
| Normal layout | Options at 1280px and collapsed/expanded popup content at intrinsic 380px have no horizontal document overflow. Popup content uses a 380×600 tab so longer expanded content must remain reachable through native vertical scrolling/Tab. |
| Small viewport | Every options section retains its 320px test. Popup width is intrinsically 380px; forcing it into a 320px/250px tab is not a native popup-sizing check and is omitted. |
| Reduced motion | Browser reduced-motion preference must match; computed animations and transitions must be inactive, including expanded popup contents. |
| Options native 200% zoom | Device overrides are cleared, the native options window is resized, and chrome.tabs.setZoom(2), getZoom and renderer changes confirm real options zoom before overflow is labeled 200%. |
| Toolbar popup 200% enlargement | Explicit SKIP per locale. The runner does not exercise a native toolbar popup; zooming popup.html in a tab cannot qualify popover text enlargement. No CSS zoom or density simulation is substituted. |

Options navigation uses direct element-rectangle mouse clicks and bounded polling. Native summary activation uses real Tab and Enter/Space rather than assigning `details.open` or injecting CSS. Options zoom resets afterward. A meaningful toolbar-popup text-enlargement acceptance method remains unresolved; changing CSS, default-font preferences or device scale is not reported as native 200% popover zoom.

## Output and cleanup

Each execution creates a new directory under ignored `artifacts/accessibility/`, identified by the package fingerprint. `report.json` records per-locale checks, PASS/FAIL/SKIP results, actual native zoom metrics, accessible names, Tab traversal, screenshots, package/runtime-locale/runner hashes, browser version, runtime errors, outbound attempts, and evidence limits. `SHA256SUMS` covers the report and screenshots.

An explicit `BLOKU_CHROME_PATH` bypasses cache discovery, so a fresh checkout can use an externally installed Chrome for Testing 156. Without that variable, the runner discovers the existing project cache. In either case, the launched browser must actually report version 156; no download or browser-version fallback occurs. Shutdown-phase browser events are retained separately as `cleanupEvents`, not counted as application errors observed during checks.

The extension and local fixture are the only allowed network surfaces. The runner checks the package before and after execution and refuses changed input. On completion or failure, it closes its own browser and server and removes its temporary profile. It preserves failure evidence separately from source. Exit status is nonzero for a failed check or aborted run; documented native-zoom limitations are represented as SKIP and `PASS_WITH_DOCUMENTED_LIMITS` when all executed checks pass.

## Scope of evidence

This runner is a bounded automated check, not a WCAG conformance certificate. It does not replace VoiceOver/NVDA testing, reading-order and task usability review, full color-contrast analysis, indicator-area/occlusion review, alternate input devices, or Chrome's real toolbar-popup behavior. The popup's actual product content is opened in an extension tab at popup widths; no claim is made about native popover zoom or screen-reader announcements. Native file/time/select UI can follow the browser/OS language independently of the extension's translated labels.

Screenshots and computed focus styles support review but do not establish that every focus-indicator pixel remains visible in every scroll state. Runtime success in Chrome 156 does not automatically qualify Chrome 145 or another browser. Unsupported native zoom must remain an explicit evidence limit, not be rewritten as a pass.

## Initial English/Arabic execution

`artifacts/accessibility/bloku-2.0.0-12131d66fa69-7j1jsy/report.json` records **71 PASS, 2 FAIL, 0 SKIP** against package `12131d66fa693f0fc7e8b724e698768fff04984c8566255d6c7b6369ad9bc047`. Both failures identified the native start-time input's missing outer outline during real Tab navigation (`outline-style: none`), once per locale. Native inner segment highlighting was not ruled out; the finding concerns the requested outer focus ring. The coordinator added a visible time-input outline in product CSS. The harness accepts native `:focus-within` while preserving the same real-Tab, visible >=2px outline requirement; it does not require a particular CSS selector to implement that ring.

All named-control, locale/RTL, normal and 320px overflow, reduced-motion, and native-zoom checks in that initial run passed. Native 200% zoom was observed directly: options changed from 1280 to 640 CSS pixels; Chrome clamped the popup-sized native window to 500 pixels, which became 250 CSS pixels at 200%. Device pixel ratio changed from 1 to 2. There were no external requests or application-phase runtime errors. Four “browser is shutting down” events arrived during cleanup in that first report; subsequent runner output separates cleanup events explicitly. The owned browser, server, and profile were cleaned up.

## Historical full execution — package 41049e2448c5

The historical result is `artifacts/accessibility/bloku-2.0.0-41049e2448c5-fa9vae/report.json`: **289 PASS, 0 FAIL, 0 SKIP**, status `PASS_BOUNDED_AUTOMATED_CHECKS`. It ran from `2026-11-01T22:13:49Z` to `2026-11-01T22:15:09Z` in the owned Chrome for Testing `156.0.8078.80` browser against package `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`. Those UTC timestamps fall on 2 November in the workspace's Africa/Cairo timezone.

All eight locales passed accessible-name, language/direction, normal/320px overflow, reduced-motion, and actual keyboard-outline checks. All **16 extension-tab 200% zoom observations** passed, covering options and the old popup document in tabs, with corresponding overflow checks. No tab zoom cases were simulated or skipped. These do not establish toolbar popover enlargement. The native popup-sized window remained clamped by Chrome to 500 physical viewport pixels before zoom and 250 CSS pixels afterward; the toolbar popover itself remains outside this evidence.

The visible time-input fix was confirmed both in computed state and the English/Arabic screenshots `en-options-focus-time-input-focus.png` and `ar-options-focus-time-input-focus.png`. The report contains ten English/Arabic screenshots in total. The previous outer-outline failures remain in their original evidence directory.

There were zero application-phase runtime errors and zero external network attempts. Four browser-shutdown events were retained separately in `cleanupEvents`. The owned browser/server were closed and the isolated profile was removed. The package and runtime translations matched before and after execution. All report/screenshot `SHA256SUMS` entries were independently verified after cleanup.

- Report SHA-256: `5dfa11eee773baeb4f1d0a3c96f486ffbcdc6d7ae36201e4bd060049777ed501`.
- Qualification runner SHA-256: `37caa0c88edee5bdfa0c4d8e06bbd7aaf46ca63785f542595fc9199105e2646b`.

These results qualify the listed automated observations for the exact package only. The manual and browser-surface limits above remain unchanged.

The preceding corrected run, `artifacts/accessibility/bloku-2.0.0-bf82b25f1d2b-FYtMEw/`, also passed 289 checks with no failures or skips. It is preserved as evidence for its own package. The current run repeats the full matrix after the canonical-import validation guard changed the package fingerprint; the product UI/CSS and qualification runner were unchanged. Use the `41049e2448c5-fa9vae` report only for that historical package; it does not qualify the current compact popup.

## Current native toolbar observation — 2 November 2026

The coordinator opened the actual Chrome for Testing 156 toolbar action through the native UI against package checksums-manifest `7b0424948d80021bc3564b551d6710d6a3f32a60ff99d6d86f71f90665ec34c5`. The English dark/system popup rendered at innerWidth/root clientWidth/root scrollWidth **380px**, innerHeight **577px**, and DPR **2**. This is normal density on this display, not proof of 200% zoom. Three read-only target captures preserve the metrics:

- `B2/artifacts/native-audit/2026-11-02T07-20-21-343Z/popup-1793604093579.json`
- `B2/artifacts/native-audit/2026-11-02T07-20-21-343Z/popup-1793604112798.json`
- `B2/artifacts/native-audit/2026-11-02T07-20-21-343Z/popup-1793604155061.json`

The coordinator reports that Cmd-plus five times while the popup was open changed the underlying website’s zoom; the actual popup remained at 380px/DPR2. Options 200% zoom was separately confirmed in native Chrome UI. Therefore native toolbar-popup 200% enlargement remains **SKIP / not established**, while genuine options zoom remains a separate supported check. No simulated popup zoom or popup-sized-window result is promoted into native popover acceptance.

The new all-locale collapsed/expanded/keyboard harness revision is source-only and has not been run. No screenshots were regenerated. It should produce documented popup zoom skips if all other checks pass, rather than a false zero-skip conformance claim. Source changes are confined to this document and the accessibility runner; product source, existing dist, backend and active root runtime were not changed.
