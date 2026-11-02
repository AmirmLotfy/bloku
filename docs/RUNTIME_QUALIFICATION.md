# Runtime qualification: PASS — BOUNDED LOCAL RUNTIME CHECK

Observed: 2026-11-02T09:28:10.755Z. Browser: Chrome/156.0.8078.80. Runner SHA-256: `4c3b1bb919f20aba7d49df22f1777493f511e526d6c93ed00b0d26c214960259`. Runtime: v22.13.1, darwin/arm64. Actual package: `artifacts/release-rc2/unpacked`, version `2.0.0`. Manifest SHA-256: `45cde63b043c50f3b5500e9753f513887b4746fbbb862d5309d2e72f06b60b2c`. Packaged checksums manifest SHA-256: `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`. Archive: bloku-2.0.0-chrome.zip, SHA-256: e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875.

| Result | Actual check | Evidence |
| --- | --- | --- |
| PASS | actual dist English UI renders, install records one clean welcome tab, and explicit welcome reload uses owned response | 225 ms |
| PASS | popup theme controls use narrow SET_THEME without replacing other settings | 36 ms |
| PASS | exact-dist stale SAVE_SETTINGS and SAVE_IMPORT reject before state or engine mutation | 15 ms |
| PASS | configured local focus activity accrues from real browser observations | 1289 ms |
| PASS | two options tabs refresh pristine settings and preserve conflicted drafts until explicit discard | 169 ms |
| PASS | edits made during a delayed GET_STATE reply survive automatic external refresh | 131 ms |
| PASS | edits made while Save reply is pending stay dirty and can save against the confirmed base | 3619 ms |
| PASS | popup shows inherited ad pauses and global off state accurately | 6027 ms |
| PASS | starting focus blocks an already-open local SPA despite ad pause | 4505 ms |
| PASS | stale full settings snapshot preserves live focus and activity | 4 ms |
| PASS | five-minute break and ending focus preserve the ad pause | 1401 ms |
| PASS | real operational activity changes do not conflict with revision-checked saves | 31 ms |
| PASS | operational session changes independently preserve live sessions and activity through revision-checked saves | 6418 ms |
| PASS | SDK reconfiguration exposes pending pause, preserves it across SPA/frame events, and explicit reload restores top/frame pause with saved cosmetics | 4766 ms |
| PASS | cross-origin frame hide RPC stays scoped to its top site and frame host | 79 ms |
| PASS | restore all saved hides removes top and frame rules while preserving presets and focus | 3396 ms |
| PASS | actual picker preview, same-host persistence, reload and undo | 690 ms |
| PASS | saved selector editing and deletion change real page content through settings | 84 ms |
| PASS | real same-document SPA history events refresh content configuration without losing explicit hides | 65 ms |
| PASS | a delayed actual content configuration reply cannot restore a removed hide after a newer SPA refresh | 830 ms |
| PASS | real settings file import uses explicit validated action and never replays timers | 167 ms |
| PASS | popup reports recurring focus and settings expose seven weekday controls | 3551 ms |
| PASS | content-origin forged state update and cross-host picker writes are denied | 29 ms |
| PASS | limited DOM privacy preference becomes true and original off state is restored | 23 ms |
| PASS | opt-in clicked-link cleanup removes trackers but preserves signed links | 305 ms |
| PASS | opt-in packaged consent rejects supported fixture without accepting or hiding unsupported dialogs | 679 ms |
| PASS | Arabic settings and popup render RTL without fallback errors | 92 ms |
| PASS | actual worker restart preserves focus/settings and re-marks a paused document until explicit committed reload | 8352 ms |
| PASS | worker wake retains one automatic welcome tab and only the explicit owned reload request is fulfilled | 4 ms |
| PASS | completed UI and content flows emitted no console/runtime errors | 0 ms |
| PASS | website desktop and mobile English/Arabic layouts checked without screenshot capture | 4141 ms |

Detailed machine evidence: `B2/artifacts/qualification/runtime-results.json`. Screenshots: none.

- Only the actual local dist and owned HTTP fixtures were exercised; one automatic clean welcome tab and persisted flag are checked separately from the explicit owned welcome reload.
- bloku.app is denied by launch DNS rules before instrumentation; the first automatic navigation and its initial DNS attempt may precede CDP observation. Only the explicit reload response is fulfilled with script-free owned HTML.
- The popup document was opened at popup dimensions in a tab; native toolbar popup interaction was not tested.
- Network monitoring begins after browser target instrumentation; the first launch milliseconds are not observed.
- Only the exact browser-is-shutting-down message received after owned browser closure starts is separated into cleanupErrors; other late errors remain qualification failures.
- Delayed settings replies were held in an owned options tab. Content-SPA tests additionally observed GET_PAGE_CONFIG in the owned fixture isolated world and held one actual reply unchanged; original Chrome API and selectors are restored in finally. No production hooks or configuration response forgery were added.
- Owned /settings and /feed transitions qualify history-refresh integration and one reordered content reply only. Consumer/business URL exclusions remain separate pure unit checks; no authenticated business or social DOM was exercised.
- No live public video/social website, real customer data, billing, donation, deployment or store submission was used.
- Stock SDK document/frame exemptions are not claimed to survive reconfiguration unchanged. Existing paused pages explicitly require user reload; the reconfiguration-boundary acceptance probes run only after a fresh committed top-document reload. The earlier failing pre-reload run remains archived in .local/audit-20261102/runtime-failed-7b04-20261102T072803Z.
- Activity CAS is skipped only when its positive-observation prerequisite explicitly reports an idle/locked host; no empty activity delta counts as coverage. Session CAS runs independently, and owned CAS sessions are ended before their profile is removed.
- The gate does not establish every supported-site preset, consent vendor, schedule/DST boundary, or 90-day real-time retention behavior.

All browser/server processes and the isolated temporary profile are task-owned and closed/removed by the runner. A bounded pass is not an unconditional production/store qualification. Failures remain explicit and must be resolved by the source owners before a new final package is accepted.
