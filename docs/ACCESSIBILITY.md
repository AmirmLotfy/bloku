# BLOKU 2.0 accessibility qualification

The bounded runner is `B2/scripts/v2-accessibility-check.mjs`. It reads the existing qualified-input package, opens an owned Chrome for Testing 156 profile, and inspects the actual options and popup UI. It never builds or modifies `B2/dist`, injects replacement UI/CSS, uses the user's browser profile, browses public websites, or publishes anything.

**Current status: the corrected full eight-locale run passed 289 checks, with 0 failures and 0 skips.** Results below identify the package actually tested. Future runs still require the shared browser-lane grant. This remains bounded automated evidence, not a WCAG conformance claim.

Authoring checks passed: Node syntax validation and the read-only preflight for all eight locales and 113 package files, initially against checksums-manifest SHA-256 `efe04b515af36607c1485ba0cfaf223c39d85c7fe34f15067a2e866444070c67`. Those authoring checks did not launch a browser; subsequent executions are recorded below.

```sh
node --check B2/scripts/v2-accessibility-check.mjs
node B2/scripts/v2-accessibility-check.mjs --check-only
node B2/scripts/v2-accessibility-check.mjs --run --locales en,ar --screenshots
node B2/scripts/v2-accessibility-check.mjs --run --screenshots --expected-checksums 41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2
```

`--check-only` validates inputs without launching Chrome. Omit `--locales` to test `en`, `ar`, `es`, `pt_BR`, `fr`, `de`, `ja`, and `hi`. The optional fingerprint argument refuses a different built package. `--screenshots` captures evidence only for English and Arabic; it never adds screenshots for the other six locales.

## Intended checks

For every locale, the runner inspects all six options sections and a real popup view associated with an owned `http://a11y.bloku.test` fixture. It seeds only ordinary user preferences through the trusted `BLOKU_V2` API: locale, light theme, a disabled focus profile with weekday/daily-allowance fields, selected YouTube presets, a saved element hide, and a local rule. Activity storage remains disabled, and no fabricated counters or historical records are added.

| Area | Actual observation |
| --- | --- |
| Language and direction | Exact document language, explicit direction, computed body direction, translated primary headings, Arabic RTL, and a status region. |
| Accessible controls | Chromium's native accessibility tree exposes nonempty names for interactive button, checkbox, textbox, combobox, link, and related roles. Positive tabindex is rejected. |
| Keyboard focus | At the normal viewport, real Tab presses traverse visible enabled controls in protection, focus, local-rules, and popup views. Each visited element must expose focus through `:focus-visible` or native descendant `:focus-within`, show a nontransparent outline at least 2px wide, and intersect the viewport. Native time fields can contain several Tab stops within one host input; those stops are recorded without assuming a keyboard trap. The report records traversal and any 40-control limit. |
| Normal layout | Options at 1280px and popup content at 380px have no document-level horizontal overflow. |
| Small viewport | Every options section and popup content are checked at a real Chromium-emulated 320px viewport. Contained horizontal navigation scrolling is permitted; document overflow is not. |
| Reduced motion | The browser's `prefers-reduced-motion: reduce` setting is applied. The media query must match and computed CSS animations/transitions must be inactive. |
| Native 200% zoom | Device-metric overrides are cleared, the owned native window is resized, and `chrome.tabs.setZoom(..., 2)` is used. `getZoom` and actual layout/device-pixel changes must confirm native zoom before overflow results are labeled 200%. |

Options navigation uses direct element-rectangle mouse clicks and bounded 100ms polling. It does not depend on Puppeteer's intersection/animation-frame click waits, which were unreliable while the host was idle in earlier qualification work.

Native zoom is deliberately distinct from responsive viewport emulation. A rejected native tab/window API, or accepted zoom with no observed renderer change, is recorded as `SKIP` with the exact reason and metrics. The runner never substitutes CSS `zoom`, transforms, larger font CSS, or device-scale-factor changes for browser zoom. It resets native zoom before moving on. A zoom-supported surface is checked for document overflow at its **observed** CSS viewport width; Chrome may clamp a native popup-sized window differently from a toolbar popover.

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

## Current full execution

The current result is `artifacts/accessibility/bloku-2.0.0-41049e2448c5-fa9vae/report.json`: **289 PASS, 0 FAIL, 0 SKIP**, status `PASS_BOUNDED_AUTOMATED_CHECKS`. It ran from `2026-11-01T22:13:49Z` to `2026-11-01T22:15:09Z` in the owned Chrome for Testing `156.0.8078.80` browser against package `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`. Those UTC timestamps fall on 2 November in the workspace's Africa/Cairo timezone.

All eight locales passed accessible-name, language/direction, normal/320px overflow, reduced-motion, and actual keyboard-outline checks. All **16 native 200% zoom observations** passed, covering options and popup content in every locale, with corresponding overflow checks. No zoom cases were simulated or skipped. The native popup-sized window remained clamped by Chrome to 500 physical viewport pixels before zoom and 250 CSS pixels afterward; the toolbar popover itself remains outside this evidence.

The visible time-input fix was confirmed both in computed state and the English/Arabic screenshots `en-options-focus-time-input-focus.png` and `ar-options-focus-time-input-focus.png`. The report contains ten English/Arabic screenshots in total. The previous outer-outline failures remain in their original evidence directory.

There were zero application-phase runtime errors and zero external network attempts. Four browser-shutdown events were retained separately in `cleanupEvents`. The owned browser/server were closed and the isolated profile was removed. The package and runtime translations matched before and after execution. All report/screenshot `SHA256SUMS` entries were independently verified after cleanup.

- Report SHA-256: `5dfa11eee773baeb4f1d0a3c96f486ffbcdc6d7ae36201e4bd060049777ed501`.
- Qualification runner SHA-256: `37caa0c88edee5bdfa0c4d8e06bbd7aaf46ca63785f542595fc9199105e2646b`.

These results qualify the listed automated observations for the exact package only. The manual and browser-surface limits above remain unchanged.

The preceding corrected run, `artifacts/accessibility/bloku-2.0.0-bf82b25f1d2b-FYtMEw/`, also passed 289 checks with no failures or skips. It is preserved as evidence for its own package. The current run repeats the full matrix after the canonical-import validation guard changed the package fingerprint; the product UI/CSS and qualification runner were unchanged. Use the `41049e2448c5-fa9vae` report for the current package.
