# BLOKU 2.0.0 release candidate

All features are free, without an account, license key, subscription, or upgrade prompt. This candidate replaces the old filter parser with the stock AdGuard Manifest V3 engine and packaged, pinned filter lists. No remote filter subscription or arbitrary user JavaScript is supported.

## Changes

- Core ad/tracker protection, six regional packs, and optional annoyance filtering. A complete optimized base list is available when Chrome cannot allocate the full list; choices and failures are visible.
- Separate ad pause and distraction settings; YouTube Shorts, recommendations, comments, home feed and end-screen controls; presets for eight social/video platforms.
- Element picker with preview, saved site rules, undo, editing and deletion.
- Timed focus sessions (25 minutes by default), weekly local-time schedules, website groups and daily active-use allowances. Focus restrictions combine and remain independent of ad pausing. A local blocked page explains recovery, five-minute breaks and ending sessions.
- Optional supported cookie-dialog rejection, clicked-link tracker cleanup and a clearly labeled limited DOM privacy preference. Full GPC is not provided: the Sec-GPC HTTP header is absent. Broad canvas/audio spoofing has been retired.
- Honest page filtering counts, filter build/source information, optional local usage summaries, and versioned settings export/import. Old statistics remain labeled legacy estimates.
- English, Arabic (RTL), Spanish, Brazilian Portuguese, French, German, Japanese and Hindi. Light, dark and system themes.

## Updating from 1.1.3

Settings migrate locally before old payment identifiers are removed. Enabled state, theme, site exceptions, saved element rules and distraction preferences are retained. Newly free privacy/distraction options remain opt-in. Export settings before manually loading a candidate. Use the existing Store item for a normal public update; uninstalling removes local settings.

The v2 export format is versioned. Settings exports omit timed sessions so restoring a backup cannot restart an old block. Imports replace editable settings after Save, while preserving current usage and matching active sessions. Saved element selectors are editable; imported style declarations and resource URLs are rejected. Keep an original v1 export/profile backup for rollback: v2 exports are not promised to import into 1.1.3. A Store rollback must use the approved previous source with a higher manifest version, preserve v2 data, and be tested before submission; uploading a lower version is not a recovery mechanism.

## Limits

Coverage changes as websites change. No promise is made to remove every video ad on YouTube or Twitch. Login, checkout, captions, seeking, fullscreen, conferences, downloads, real consent vendors and authenticated social feeds require the documented compatibility qualification. Public page reachability alone does not establish those private workflows.

The eight translation catalogs are complete; independent native-speaker review is not claimed. The final ZIP passed all 20 authored runtime checks on Chrome 156, 155 and 158. Chrome 145 passed 19 with one explicit physical-idle activity check skipped; its 21 engine cases passed. Screenshot capture was enabled on 156; the other versions checked layouts without recording screenshots. Earlier host/CDP harness interruptions are superseded by those bounded results. Eight-locale accessibility checks passed 289 cases; this is not a screenreader or WCAG certification. The final 40-site public run had no harness failures, with restricted/partial pages reported separately. YouTube playback, seek, fullscreen and selected distraction controls passed in the bounded public sample; public captions, Vimeo and Twitch playback remain limited.

The pinned SDK has inherited high-severity Zod advisories with no compatible 3.x fix available at the audit. Input limits and validation reduce exposure; residual risk and dormant SDK code paths are recorded in `B2/engine/INTEGRATION.md` and the packaged SBOM. Do not describe the dependency audit as clean.

## Publication

This is a release candidate, not a claim of Chrome Web Store acceptance. Owner controls final submission and publication. Coordinate the website’s public 2.0 promotion with Store availability. Optional donations remain hidden until a verified GitHub Sponsors destination is configured; no features depend on donations.
