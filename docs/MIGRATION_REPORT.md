# BLOKU 2.0 migration and backup contract

Migration runs locally, without contacting a licensing or payment service. Free, active-Premium and expired-Premium status do not change the 2.0 feature set. Newly optional privacy/history controls stay off unless chosen.

## Preserved data

The migration reads legacy enabled/layer state, theme, user site exceptions, saved element selectors, distraction preset selections and old statistics. It normalizes site domains, drops malformed exception entries, labels old statistics as **Legacy v1 estimates**, and stores versioned v2 state. It does not import the old built-in blanket exemptions.

A semantically canonical read-back verifies the saved v2 state before license, device, email and subscription identifiers are removed. The legacy settings object is retained as a recovery source. Failed persistence, malformed v2 state or an unknown newer schema prevents destructive cleanup. Browser object-key reordering is accepted; it is not mistaken for data corruption.

## Checks

Meaningful foundation tests cover fresh installation, legacy saved choices, expired subscriptions, free/active-Premium/expired-Premium parity, repeated migration, failed persistence, identifier cleanup ordering, unknown future schemas, hostile imports, and actual Chrome-style key reordering. Focus/repository tests separately cover overlaps, deadlines, sleep gaps, usage boundaries, history pruning, timezone/DST changes and serialized concurrent updates. Exact results are recorded in the release qualification report; source tests alone are not proof of every in-place browser upgrade.

## Settings exports and imports

The format is `bloku-settings`, version 2. Exported JSON includes editable settings, local activity summaries and clearly labeled legacy estimates. Timed sessions are omitted so a backup cannot unexpectedly resume an old blocking deadline. Export does not change the running installation.

Import is previewed in the UI and applied only when Save is used. It replaces editable preferences, site policies, rules and profiles. Current usage and existing timed sessions with matching profile IDs remain authoritative; importing a file does not replay activity or revive exported timers. Activity in an export is readable/exportable data, not a command to overwrite current allowance counters. Explicit Delete activity remains available.

Files larger than 2 MB are rejected before reading their contents. Worker and parser validation run before applying state. Invalid versions, malformed collections, invalid activity maps/dates, executable filter rules, selector style declarations/resource URLs, and quota/conversion errors cannot be acknowledged as successful settings changes. A failed engine application leaves the last confirmed configuration, or an explicit unknown/error status if recovery cannot be verified.

## Recovery

Keep a v1 profile/export backup before a manual candidate upgrade. V2 exports are not backward-compatible with 1.1.3. For a malformed state, use the local recovery export offered by settings before making changes. Uninstalling removes browser-managed local extension storage; exported files remain on disk. No historical financial records are deleted by migration or uninstalling.

## Real-Chrome seeded-state qualification method

`B2/scripts/v2-migration-check.mjs` requires a separately granted browser lane. It passed syntax validation during preparation; the completed browser run is recorded below. Existing source/unit results above are separate evidence from this browser method.

The default input is the actual frozen `B2/dist`, version 2.0.0, whose checksums-manifest SHA-256 is `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`. The runner checks that exact input and every listed file before execution, then checks for changes afterward. It imports no product TypeScript: the selected package's real background worker performs migration. An exact extracted ZIP may be selected with `BLOKU_EXTENSION_PATH`; the expected checksum hash remains pinned unless explicitly supplied through `BLOKU_EXPECTED_CHECKSUMS_SHA256`.

The browser is isolated Chrome for Testing 156. Each fixture gets one fresh task-owned profile and browser; cases run sequentially. The selected package first initializes normally. A trusted actual options page then replaces only known application-storage keys with synthetic fixture values, retaining the filtering SDK's warm-start caches. The harness detaches worker inspection sessions, explicitly stops the real service worker through CDP, confirms the stop, detaches the controlling inspection session, and wakes the extension with an actual options-page `GET_STATE` message. The results record observed browser/version, exact package/runner/fixture hashes, completed assertions and confirmed worker restarts.

| Synthetic fixture | Main qualification |
| --- | --- |
| Fresh application state | Defaults, free UI marker and newly optional controls off. |
| Legacy free | User-selected disabled state, dark theme, normalized site exceptions, saved selectors/presets and labeled legacy statistics. |
| Legacy active Premium | Inert synthetic identifiers; light theme and disabled legacy network layer preserved; same free capabilities and optional defaults. |
| Legacy expired Premium | Inert expired identifiers; enabled protection and dark theme preserved; no expiry-based feature restriction. |
| Malformed v2 | Explicit failed-initialization/recovery state; original application state and synthetic identifiers unchanged; readable recovery export without identifier disclosure. |
| Future schema | Unsupported-version recovery; original future payload, legacy source and synthetic identifiers retained without destructive cleanup. |

Each successful migration also checks canonical Chrome-storage read-back, identifier cleanup after successful persistence, preservation of legacy recovery inputs, and a second explicit worker restart with the entire v2/application state unchanged. All fixture values are visible in the runner and will be written to a sanitized `fixtures.json` alongside results after execution. Fixture domains end in `.test`; synthetic email addresses end in `example.invalid`; license/subscription/device values are explicitly marked synthetic and do not represent real entitlements.

Every browser HTTP(S) connection is routed through a task-owned loopback proxy that refuses HTTP and CONNECT without forwarding. Host resolution maps all names to `NOTFOUND`, and attached page/worker targets additionally block HTTP requests. This covers the brief debugger-detached worker-restart interval without requiring public-site access. Initial network-observer attachment gaps are recorded as a method limit; zero observed attempts must not be described as a complete startup packet capture. Profiles and browsers are cleaned after every case; the denying proxy closes at the end. A failed assertion stops the remaining fixtures with explicit failure evidence rather than retrying indefinitely.

Ready commands, **only after the coordinator grants the heavy browser lane**:

```sh
node B2/scripts/v2-migration-check.mjs --run
```

For an already extracted exact package:

```sh
BLOKU_EXTENSION_PATH=/absolute/path/to/extracted-extension node B2/scripts/v2-migration-check.mjs --run
```

Running without `--run` only describes the prepared fixture set; it does not launch Chrome. A qualification run appends its actual results here and writes sanitized `B2/artifacts/migration-qualification/<run-id>/{fixtures,results}.json`. Public reports use repository-relative or redacted input paths; private profile directories are removed rather than published.

This qualifies **browser-local seeded legacy application state only**. It does not install or execute the original 1.1.3 binary, perform a Chrome Web Store 1.1.3-to-2.0 update, exercise permission/re-enable prompts, test concurrent old-version writes or establish downgrade compatibility. The warm v2 SDK cache also means this is not a first-ever SDK-cache performance measurement. No real customer state, license-server request, payment action or production change is part of the method.


## Browser-local seeded migration run — 2026-11-01T22:13:01.622Z

**PASS — BROWSER-LOCAL SEEDED STATE ONLY**. Observed browser: Chrome/156.0.8078.80; installed version: 2.0.0. Verified package input: `B2/dist`; checksums manifest SHA-256: `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2`; runner SHA-256: `08bef0321987574af33db17010e9c2e1acaf157050521ddb404ddefe04356598`; fixture manifest SHA-256: `68b5b2ed3f8953cf8ca4054844d4a2d7a05c79b4957b3f89d853f34152e2d30e`. All 112 package files were checked before execution; unchanged afterward: true.

| Result | Synthetic input | Assertions completed | Explicit worker restarts | Failure |
| --- | --- | --- | --- | --- |
| PASS | fresh | 33 | 2 | — |
| PASS | legacy-free | 36 | 2 | — |
| PASS | legacy-active-premium | 36 | 2 | — |
| PASS | legacy-expired-premium | 36 | 2 | — |
| PASS | malformed-v2 | 27 | 1 | — |
| PASS | future-schema | 27 | 1 | — |

Sanitized fixtures and machine results: `B2/artifacts/migration-qualification/2026-11-01T22-12-18-952Z/fixtures.json` and `B2/artifacts/migration-qualification/2026-11-01T22-12-18-952Z/results.json`. All fixture values are synthetic. Private browser profiles are removed and are not report artifacts.

- This executes the actual verified package in isolated CFT 156 profiles, one browser at a time.
- Legacy application storage is seeded from a trusted v2 options page after a fresh v2 startup; SDK caches from that warm startup remain.
- Synthetic active/expired identifiers are inert fixtures, not real entitlements. No original 1.1.3 binary, license server or customer state is used.
- This is not a Chrome Web Store 1.1.3-to-2.0 update, permission/re-enable UX, old-binary write compatibility, or v1 downgrade test.
- Worker inspection sessions are detached before explicit worker stop; a trusted options message wakes migration. New worker initial network monitoring has an attachment gap.
- All browser HTTP(S) is routed through a task-owned loopback proxy that denies every HTTP/CONNECT request without forwarding. All host resolution maps to NOTFOUND, and observed HTTP requests are additionally blocked. No external site or HTTP fixture is used.
- No real billing/account/donation operation, deployment or store submission is performed.

Observed extension/page HTTP attempts blocked: 0. Browser transport requests denied by the loopback proxy: 0. Cleanup errors: 0. A bounded browser-local pass does not qualify actual Store-update or permission UX.


### Post-run source pin and evidence freeze

The runner’s default input pin now matches the qualified `41049e2448c58ef339a8f2912c50041423cf7bfcefa36c0cfa99e1c34783f4c2` package, so the plain command above selects the current candidate. The actual run selected this same hash explicitly through `BLOKU_EXPECTED_CHECKSUMS_SHA256`; its machine results are preserved unchanged, including the executed runner SHA-256 `08bef0321987574af33db17010e9c2e1acaf157050521ddb404ddefe04356598`. Updating only the default hash constant changed the current runner SHA-256 to `4374be7090b50063bef6de2f6a96ce6fe5cc1a633db9db8a0c12ea486ed33764`; it changed no extension bytes, fixture definitions, assertions or recorded results. No further browser run was performed for this source-default update.

Final bounded outcome: **6/6 synthetic cases passed, 195 assertions completed, 10 explicit worker stop/wake cycles** on Chrome `156.0.8078.80`, with 112 package files verified and unchanged, zero observed HTTP attempts, zero proxy transport requests and zero cleanup errors. All private migration profiles were removed. This remains browser-local seeded-state evidence, **not a Store update or permission/re-enable UX certification**.
