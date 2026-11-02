# BLOKU 2.0.0 RC2 release notes

All extension features are free, without an account, license, subscription or upgrade prompt. This local candidate uses the stock AdGuard Manifest V3 SDK and packaged pinned filters. It remains a candidate, with the outstanding acceptance work recorded in `docs/AUDIT_SUMMARY_20261102.md`; it is not a Store approval or public release announcement.

## Audit changes

- Restored the original espresso/porcelain/burgundy website and extension style, original branding, level cards and a compact intrinsic 380px toolbar popup. Arabic RTL, eight locales, light/dark/system themes and reduced-motion behavior remain.
- Context-menu picking targets the clicked document. Embedded custom hides are scoped to top site plus frame origin. Preview, cancel, undo, editing/deletion and current-site/all-custom-hide restore remain distinct from presets and focus.
- Consumer presets use source URL scope so specified Facebook, LinkedIn and X/Twitter business/settings paths and YouTube embeds do not receive consumer-preset CSS. YouTube autoplay control follows the same top-page scope. Native history events refresh existing content without patching a page's history API; generation checks reject stale refresh replies. Explicit custom hides, network filters and focus are preserved. These narrow guards do not establish authenticated work-app compatibility.
- Settings pages preserve dirty drafts across other-tab changes and delayed replies, reject stale saves/imports, and preserve current operational focus/activity. Import applies only after validation and explicit Save; exports omit timed sessions.
- First install opens one clean localized welcome page. Updates and worker wakes do not repeat it. The uninstall URL is clean/localized; review access is neutral and user-invoked.
- Stock SDK popup handling is admitted only for a specifically supported conversion diagnostic, with remaining conversion/quota errors still fatal. Owned source-scoped popup cases preserve ordinary OAuth-like windows and direct navigation; there is no universal popup/popunder claim.

## Pausing ads and restoring a page

Saved ad pauses remain separate from focus. Existing pages can need a manual reload after SDK reconfiguration, rollback or worker startup, especially with embedded frames. The popup shows **Pause saved · reload needed**, offers **Reload page** and warns to save unfinished work. BLOKU never forces that reload. Current local checks qualify restoration after a fresh committed top-document load; full pre-reload pause effectiveness is not claimed. Focus restrictions remain independent.

## Included controls

Core ad/tracker blocking, six regional packs and optional annoyance filtering; an optimized complete Base alternative when Chrome cannot allocate the full list; per-site pauses; consumer distraction presets for eight services/nine domain keys; selected YouTube feed/player controls; the element picker; timed focus, weekly local-time schedules, groups and daily observed-active-use allowances; optional local activity and versioned settings backup are included.

Optional supported-cookie rejection and clicked-link tracking cleanup remain off until chosen. Unsupported dialogs remain usable and recognized signed links are preserved. The limited DOM privacy preference does not send Sec-GPC and is not complete GPC. No broad canvas/audio spoofing or remote filter subscription is added. Page filtering observations, cosmetic hides, activity and labeled legacy estimates are separate measures.

## Current validation

Final local candidate: fingerprint `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`, Chrome ZIP `e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875`, version 2.0.0 for desktop Chrome 145+.

Foundation 50/50, engine/transaction 14/14, TypeScript and build passed; 144 locale keys, eight Store-copy drafts and 26 packager self-tests were verified. Exact-ZIP runtime: Chrome 145 passed 31; 155 and 158 each passed 29 with two host-idle activity skips; Chrome 156 passed the final 31-case harness with no failures or skips. Stock SDK engine cases passed 21/21 on all four versions for unchanged engine modules. Eight-locale accessibility passed 329 with eight real native-popup 200% checks explicitly skipped. These checks are not screenreader/WCAG or authenticated-workflow certification.

Current 817 Store assets were captured in all eight locales; four representative EN/AR/JA/HI images were visually reviewed as readable, level and correctly mirrored where applicable, with no overflow. Complete owner visual/native-speaker acceptance remains separate.

Older comparative/public/video results identify their own RC1/d2 bytes. Current 817 video checks recorded 27 PASS, 8 LIMITED and 0 FAIL: YouTube playback/seek/fullscreen/comments/recommendations passed; captions/autoplay and Vimeo/Twitch remain limited. No confirmed comparison regression was recorded.

Current 817 heavy-site evidence has two runs of three public observations each, no harness failures/unattempted cases and 13 owned fixture passes per run. A related-film-link misclassification in the first run is retained; the tighter helper reached catalog detail but found no safe watch control. In-player ads/player behavior and popunder prevention remain limited; shared page errors also appeared without the extension.

Current 817 native English/Arabic pending-pause screenshots and the real Arabic reload action are verified at 380 CSS pixels/DPR 2 with no horizontal overflow; 13 real Tab presses reached Open settings, reload cleared the pending flag and preserved the saved pause. This does not qualify 200% zoom.

All 32 final website photos are synced and its check passed 10/10. Final local lab passed 12 cold mobile samples plus 32 localized desktop/mobile surfaces, with CLS 0 and no recorded console/page/external requests. The final protected preview `https://bloku-website-djgxvc51e-mellardoos-projects.vercel.app` passed 12 authenticated CLI route checks while retaining noindex/crawl denial. These are local/HTTP checks, not Lighthouse/field/ranking or hosted visual acceptance: IAB control remained unavailable and the native fallback was safety-rejected. Final source/reproducibility and hosted visual/owner acceptance remain pending; reproduction is conditional on a later completed report and matching inventory. See the audit summary for traceable files, failures, harness revisions and acceptance boundaries.

## Updating and remaining limits

Local migration preserves supported v1 settings before old payment identifiers are removed. Newly free optional controls stay opt-in. Back up settings before manually loading a candidate and use the existing Store item for a normal update. Uninstalling removes local storage; it is not a routine update-recovery instruction. Keep original v1 backups: v2 exports are not promised compatible with 1.1.3. Manual recovery uploads need preserved source, a higher manifest version, migration-safe data handling and fresh validation. The separate official Store rollback workflow requires an owner eligibility/data-safety check; no rollback action or eligibility is asserted.

Changing websites limit ad, video and selector coverage. Public reachability does not qualify account login, Canva editing/export, Meta/Google advertising dashboards, checkout, meetings or private social feeds. No universal compatibility, ad-removal, anonymity, #1 or speed guarantee is made. Native-speaker/screenreader review, actual Store permission-upgrade UX and remaining dependency risks require owner acceptance. Inherited high-severity Zod advisories and dormant SDK paths remain documented; the security audit is not clean.

## Publication and support

Final data-use certification, submission and publication remain with the owner. No Store mutation or package upload occurred during this audit; upload material was prepared. Public bloku.app and the Store still show the prior release, so coordinate the public accurate privacy policy, final website/indexing and 2.0 promotion with Store availability. Current RC2 source publication remains pending; the public RC1 tag is historical.

Optional **Support BLOKU** is website-only through the verified PayPal-hosted one-time EUR link. The supporter chooses the amount; support grants no feature benefit. Link verification is not payment/payout, fee, eligibility or tax acceptance.
