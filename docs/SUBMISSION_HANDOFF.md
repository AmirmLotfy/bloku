# BLOKU 2.0 submission handoff

This is a prepared release candidate. The owner retains Chrome Web Store upload, submission, certification and publication control. Nothing in this packet establishes Store approval, universal compatibility or a performance ranking.

## Files and identity

Use `artifacts/release/bloku-2.0.0-chrome.zip`, version 2.0.0, with manifest.json at archive root. Keep the existing Store item ID `mjfieeobdnanclichjahkhkkhlipnigj` and Privacy & Security category. The minimum supported desktop Chrome version is 145. The package checksum-manifest fingerprint is `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`; the Chrome ZIP SHA-256 is `320c288293c7438d1044603e17da5405042707e5163ef13e2a425098faa31190`. Verify the final release manifest and SHA256SUMS before upload. Source archives, unpacked build, notices, SBOM, image assets and qualification evidence accompany the candidate.

## Listing preparation

Use the exact localized title, summary and description from `B2/store/locales/<locale>.json`. The English title is **BLOKU — Ad Blocker & Focus** and summary is:

> Block ads and trackers, hide distracting feeds, and schedule focus time. All features free. No account required.

There are five real-UI screenshots per locale in the matching Store image folder. Use English `promo-small-440x280.jpg` and `promo-marquee-1400x560.jpg` for the two global promotional image fields. Other localized promotional tiles are supplementary marketing assets. Preserve the actual logo/icons. No keywords lists, competitor names for ranking, fabricated ratings, user counts, superlatives or video-ad guarantees are authorized.

## Reviewer instructions

No account, purchase, license or special access is needed. Install the candidate and open its popup or options. Default ad/tracker protection starts immediately; regional/annoyance lists and optional privacy/distraction choices can be changed in Protection and Distractions.

To verify independent focus control, add a focus profile for `example.com` in Focus, save it, and start a timed session. Opening that site should show BLOKU's local explanation page. A five-minute break temporarily permits access; End session ends the timed block. Pausing ads alone must not end the focus session. Existing weekly schedules or exhausted allowances can separately keep the site blocked; remove those restrictions when isolating this test.

Use the popup/context-menu element picker on an ordinary HTTP(S) page. Preview and save an element hide, reload, then edit/delete the saved selector or use the offered undo. Chrome-protected pages cannot be modified. Settings export/import requires an explicit Save after the file is validated; importing a backup does not replay old timed sessions.

The About section exposes enabled packaged filter sources and update/build metadata. Blocking counts are current-page native filtering observations, separate from cosmetics and activity. Old v1 totals remain labeled legacy estimates.

## Privacy and executable code

Use `docs/STORE_RELEASE.md` and the packaged privacy policy for the exact permission explanations. Filtering processes URLs, navigation/request/frame context, transient request/response headers and selected page content locally. Header access can include Cookie/Set-Cookie session values despite no cookie-management permission. Optional active-use summaries concern only configured focus sites; history is off by default, with today's allowance counters retained, or up to 90 days if enabled. Logging/telemetry and remote filter subscriptions are disabled.

Review the current dashboard's category definitions and make the owner's accurate data-use certification. Local processing must be described in the policy; it must not be concealed through a blanket assertion that no user data is handled. There is no account, payment feature, advertising-data sale or extension browsing-data upload. The website's hosting and historical financial/support records have their own disclosed scope.

Executable logic, scriptlets, consent rules and filter inputs are packaged. Choose No remotely hosted code for this candidate. Local arbitrary executable rules are rejected; CSP excludes unsafe-eval. GPL correspondence and stock SDK dormant helper-path limitations are documented, rather than represented as a clean security audit.

## Remaining release acceptance

Read the matching qualification reports before submission. Bounded browser/fixture/public-page tests do not establish authenticated login, checkout, conference or account-editing compatibility; independent native-speaker/screenreader review and actual Store upgrade permission UX remain unqualified. Public captions, Vimeo and Twitch playback coverage are limited. The optional privacy preference is DOM-only; Sec-GPC is not sent, so complete GPC is not provided. Inherited high-severity Zod advisories have no compatible 3.x fix; mitigations do not remove residual risk. Performance measurements were mixed and support no fastest/#1 claim.

Keep the candidate unpublished until the owner accepts the remaining evidence limits and required critical workflows. Recheck Google's current policy, permissions and listing help before certifying. Use deferred publication; do not rely on percentage rollout for this audience.

## Website and recovery

The corrected website is staged as an authenticated, unindexed preview; public bloku.app remains on its previous release. Public 2.0 promotion must use the production indexing configuration and align with Store availability. Do not promote a preview whose robots.txt denies all crawling. Copyright/publisher links use `https://frameless.com.eg`; all cards stay level. Optional donations remain hidden until a verified GitHub Sponsors destination exists.

Keep original v1 user backups. v2 exports omit timed sessions and are not promised compatible with 1.1.3. A Store rollback requires the preserved previous source, a higher manifest version, migration-safe handling of v2 data and fresh testing; a lower-version upload is not a rollback. Do not uninstall users' existing extension as an update/recovery instruction, because uninstall removes local storage. Historical payment reconciliation and records remain independently retained; the two configured paid products and new checkout creation are retired.
