# Runtime qualification: PASS — BOUNDED LOCAL RUNTIME CHECK

Observed: 2026-11-02T05:04:10.160Z. Browser: Chrome/156.0.8078.80. Actual package: `/Users/frameless/Desktop/Extensions/Bloku/artifacts/release/unpacked`, version `2.0.0`. Manifest SHA-256: `a6cb0e15e225182f7c3545c671a338c77a7be3dc87d361b0a1b4470a1a7bef4f`. Packaged checksums manifest SHA-256: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`. Archive: bloku-2.0.0-chrome.zip, SHA-256: 320c288293c7438d1044603e17da5405042707e5163ef13e2a425098faa31190.

| Result | Actual check | Evidence |
| --- | --- | --- |
| PASS | actual dist English options and popup render without errors | 259 ms |
| PASS | configured local focus activity accrues from real browser observations | 1310 ms |
| PASS | popup shows inherited ad pauses and global off state accurately | 6050 ms |
| PASS | starting focus blocks an already-open local SPA despite ad pause | 6031 ms |
| PASS | stale full settings snapshot preserves live focus and activity | 3 ms |
| PASS | five-minute break and ending focus preserve the ad pause | 1800 ms |
| PASS | saved content hide toggles while network ads remain paused | 28 ms |
| PASS | actual picker preview, same-host persistence, reload and undo | 1243 ms |
| PASS | saved selector editing and deletion change real page content through settings | 586 ms |
| PASS | real settings file import uses explicit validated action and never replays timers | 343 ms |
| PASS | popup reports recurring focus and settings expose seven weekday controls | 4029 ms |
| PASS | content-origin forged state update and cross-host picker writes are denied | 38 ms |
| PASS | limited DOM privacy preference becomes true and original off state is restored | 31 ms |
| PASS | opt-in clicked-link cleanup removes trackers but preserves signed links | 309 ms |
| PASS | opt-in packaged consent rejects supported fixture without accepting or hiding unsupported dialogs | 735 ms |
| PASS | Arabic settings and popup render RTL without fallback errors | 347 ms |
| PASS | actual worker termination and UI wake preserve committed settings, usage and focus | 4609 ms |
| PASS | instrumented runtime made no outbound billing or telemetry requests | 0 ms |
| PASS | completed UI and content flows emitted no console/runtime errors | 0 ms |
| PASS | website desktop and mobile English/Arabic screenshots captured from local preview | 4218 ms |

Detailed machine evidence: `B2/artifacts/qualification/runtime-results.json`. Screenshots: `B2/artifacts/qualification/runtime-options-en.png`, `B2/artifacts/qualification/runtime-popup-en.png`, `B2/artifacts/qualification/runtime-blocked.png`, `B2/artifacts/qualification/runtime-options-ar.png`, `B2/artifacts/qualification/runtime-popup-ar.png`, `B2/artifacts/qualification/runtime-website-en-desktop.png`, `B2/artifacts/qualification/runtime-website-en-mobile.png`, `B2/artifacts/qualification/runtime-website-ar-desktop.png`, `B2/artifacts/qualification/runtime-website-ar-mobile.png`.

- Only the actual local dist and owned HTTP fixtures were exercised.
- The popup document was opened at popup dimensions in a tab; native toolbar popup interaction was not tested.
- Network monitoring begins after browser target instrumentation; the first launch milliseconds are not observed.
- No live public video/social website, real customer data, billing, donation, deployment or store submission was used.
- The gate does not establish every supported-site preset, consent vendor, schedule/DST boundary, or 90-day real-time retention behavior.

All browser/server processes and the isolated temporary profile are task-owned and closed/removed by the runner. A bounded pass is not an unconditional production/store qualification. Failures remain explicit and must be resolved by the source owners before a new final package is accepted.
