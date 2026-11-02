# Native popup sizing correction — 2 November 2026

## Evidence and cause

The owner reported the real Chrome toolbar popup collapsing into a narrow column, with a stacked badge/title and clipped controls. The coordinator's native capture `artifacts/audit-20261102/native-popup-restore.jpg` independently shows that symptom. The prior accessibility runner opened popup content in an extension tab at supplied widths; its documented boundary explicitly excluded Chrome's real toolbar popover. Those tab checks did not qualify native preferred sizing.

The source rule `.popup{width:380px;max-width:100vw}` constrained the body to Chrome's provisional popup viewport while Chrome was calculating preferred document size. That viewport dependency allowed the initial narrow size to remain narrow. The source fix removes that dependency and sets the intrinsic preferred width on the actual popup document root.

## Source correction and scope

Read the `adapt` and required `frontend-design` skills. The coordinator supplied the already approved context: a Chrome desktop extension for quick ad/site/focus controls, burgundy light/dark themes, eight languages including Arabic RTL, level cards, mouse and keyboard use. This is an adaptation of the existing approved design, without a new visual direction.

- `B2/src/ui/popup.html` adds `popup-document` on the html root.
- `B2/src/ui/styles.css` gives that root an explicit 380px width and minimum width with no viewport-based maximum. Its body uses auto width so it fits the root content box and any native vertical scrollbar.
- Popup grid tracks use `minmax(0,1fr)` and children can shrink within the available content width. Buttons, badges and long host/status text wrap; the logo retains its dimensions.
- Ordinary document vertical overflow remains scrollable. No overflow-hidden rule masks content, no fixed content height clips controls, and no CSS zoom/scale simulates browser zoom.
- All new rules are popup-scoped. Options-page responsive rules, colors, Arabic direction and reduced-motion behavior are unchanged. `popup.ts`, options, locale behavior and network/filtering logic are outside this specialist's ownership.

This is a source-only patch. No build, browser run or test was performed in this lane; the coordinator owns rebuilding and genuine native toolbar verification. The symptom is observed; native sizing recovery is not yet claimed.

## Required native acceptance after rebuild

1. Load the rebuilt exact package in the task-owned Chrome profile, open an ordinary page, and click the actual toolbar action. Do not substitute opening `popup.html` in a tab or passing an assumed 380px test viewport.
2. Record the actual native popup surface dimensions and root/body `clientWidth`, `scrollWidth`, `innerWidth`, devicePixelRatio and browser zoom. At ordinary zoom, the popup should resolve to approximately 380 CSS pixels rather than the collapsed approximately 110px width. Long content must not create document-level horizontal overflow. Allow only genuine native scrollbar differences.
3. Repeat in all eight interface languages, with particular attention to Arabic RTL, long German/French labels and Hindi/Japanese text. Check light and dark themes. Brand, free badge, host heading, checkbox, pause/picker/restore controls, focus controls and settings entry must remain readable and operable.
4. At actual 200% browser zoom, observe the real toolbar popup width rather than assuming the result. The intended 380 CSS-pixel document requests about 760 device-independent pixels at 2× zoom, within Chrome's nominal 800px popup width cap. Record actual clamping, available display size and viewport; real platform behavior decides acceptance.
5. For a content-rich state (supported-site presets, saved hides and active focus session), verify native vertical scrolling reaches the final action/status, and real Tab/Shift+Tab navigation scrolls focused controls into view with visible outlines. No horizontal clipping or keyboard trap may be concealed by a screenshot of the upper section alone.
6. Close/reopen the native popup, change active tab/site, and repeat after a worker wake. Confirm the width remains stable and controls still act on the current site. Preserve state changes for the coordinator's existing regression checks.

The old forced 320px/250px extension-tab popup checks conflict with a 380px intrinsic native document by design. Keep options-page small-width tests, and qualify popup resizing through actual toolbar surfaces and observed native zoom. A simulated narrow tab does not supersede the owner's native failure or establish this fix.

## Evidence boundary

After the source patch, only static inspection is authorized in this lane. A rebuilt manifest/hash, native screenshots, measured dimensions, all-language results and real keyboard/scroll observations must be attached by the coordinator before marking the native issue fixed. Existing prior-package tab/a11y results remain historical evidence with their stated limits.

## Native verification and owner visual correction

The rebuilt `6faeb453ee21995f4676654a7af5caebcec855db9a4d98dd7b553cd728e2b4e2` package was opened through the actual toolbar and Command+Shift+K in an owned Chrome 156 profile. English dark and Arabic RTL native captures show the 380 CSS-pixel layout at approximately 760 physical screenshot pixels on this Retina display. Real Tab navigation reached the last Open settings action and scrolled it into view. This verifies the original collapse is corrected in that package, not all locales/zoom states.

The owner then explicitly preferred the original V1 popup and website visual experience (screenshot at 09:05). V2 now restores the warm espresso/porcelain palette, burgundy primary actions, compact header with sun/moon and settings controls, protection switch, and three status tiles. V1 payment gates and fabricated savings remain retired. The three tiles show user-requested current-page network-rule matches (a dash before inspection), exact saved selector count for this site, and remaining minutes of active timed focus sessions. Network matches include native rule matches and are not labelled exact ads, trackers, bandwidth or lifetime totals.

Detailed distraction, protection and focus controls use native details/summary disclosure. Keyboard focus and disclosure expansion are preserved across narrow settings updates. Source now has trusted SET_THEME and revision-checked SAVE_IMPORT actions in addition to SAVE_SETTINGS; no page-script authorization or competing DNR writer is added.

Native screenshots of the restored style: `artifacts/audit-20261102/native-popup-restored-en-dark.jpg`, `native-popup-restored-en-light.jpg`, `native-popup-restored-ar-light.jpg`. Page-count inspection returned zero for the owned fixture, and filtering-health/reload disclosure opened normally. These screenshots precede the final settings-race/focus-retention source refinements, which still require a fresh build and regression check. Full native 200% zoom and all eight native toolbar locales are not yet qualified.

## Current RC2 bounded acceptance

Checksum-manifest `d2c42c347c329a47296ed2eb389cb948dd85694c9d64dbd3c73995f6039c2e06`: all28 real runtime checks passed, with no failure or skip. The current engine keeps Chrome's document-bound allowance limitation. Existing paused documents are marked pending after actual SDK reconfiguration, rollback attempts or startup; only a subsequent top-document commit clears the marker. SPA and child-frame commits do not. The popup shows localized pending status and a prominent manual reload, without automatically discarding unfinished work. After the explicit reload, owned top/frame network probes succeed, saved cosmetic hides remain, and unrelated focus continues. Worker-stop/startup also re-marks a separate paused document and clears only after explicit committed reload. This is transparent support for a navigation-dependent pause; unchanged live-frame allowance survival is not claimed.

All eight locale content/keyboard/layout checks passed329 checks,0failures,8documented native-popup200%zoom skips. Evidence: `artifacts/accessibility/bloku-2.0.0-d2c42c347c32-PiK95E/report.json`. Collapsed and expanded native disclosures are tested at intrinsic380px; options retain320px and real200%browser zoom. These content-in-tab checks supplement, not replace, the separate native toolbar evidence above. The current pending-reload popup still needs a fresh native screenshot; exact-archive/cross-version checks remain separately recorded gates.
