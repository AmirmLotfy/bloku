# Bloku 2 filtering integration

The runtime consumes stock `@adguard/tswebextension` 6.0.1 and
`@adguard/dnr-converter` 2.0.0. `adapter.ts` is the only application owner of
dynamic/session/static filtering mutations. UI, schedules, migration and content
features must call its serialized `apply()` API; they must not write DNR rules.

`EngineInput` contains `adsEnabled`, `enabledLists`, `siteExceptions`,
`focusDomains`, and `userRules`. `EngineStatus.ok` acknowledges a verified applied
state. On error, `state` is the previous confirmed state only when restoration
succeeded; `restored` identifies that outcome. A null state means protection
could not be verified. Never present a failed requested configuration as active.

## Packaged resources

`scripts/v2-update-filters.mjs <40-character-registry-commit>` is the explicit
network maintenance command. It records source URLs and SHA-256 hashes in
`vendor/sources.json`; source lists are committed. Normal builds verify those
hashes and work without downloading filter lists. The official converter CLI API
initializes the upstream RE2/WASM validator; using its browser API alone in Node
would incorrectly reject valid regex rules.

The converter emits compact DNR rules, original text, metadata and source maps.
Unsupported MV3 network syntax is enumerated in `build-report.json` and
`converter-diagnostics.log`; it is not advertised as fully supported. New or
unexpected errors and quota truncation fail the build. Cookie network rules are
excluded because Bloku does not request the cookies permission. Packaged
scriptlets and raw script-function maps are built locally. Local editor input
accepts network rules and CSS element-hiding selectors, and rejects executable,
cookie/response-mutation and style-injection rules. No remote subscriptions or
runtime code downloads are implemented.

The full base and tracking packs exceed Chrome's guaranteed 30,000 static-rule
capacity. The complete official optimized base pack is an explicit alternative;
it converted to 27,931 static rules including metadata in the initial gate.
Selection is explicit. Insufficient capacity retains the last verified state and
returns an error; lists and rule arrays are never silently sliced.

## Focus precedence

Focus uses normal SDK `$document,important` rules. Site and local exception rules
receive `to=~focused.domain` exclusions in their effective copy, preserving
ancestor-domain exceptions for unaffected siblings. Important exceptions and redirects that
actually converted to static DNR are identified from the upstream source map.
During focus, SDK-supported `$badfilter` cancels those originals, and constrained
replacements preserve their behavior outside focused destinations. Original
stored settings and filter sources are unchanged. User `$badfilter` overrides
are rejected during active focus to prevent equivalent-syntax bypasses.

Pausing ads leaves the SDK enabled whenever focus domains remain. A local
document blocking page is configured through the supported SDK API. The
production controller also redirects already-open matching tabs after confirmed
application. Alarm state is reconciled against absolute timestamps; bounded
foreground activity observations survive worker suspension in storage.session.

## Privacy and dependency limitations

The stock engine observes webRequest/webNavigation events, including transient
request/header context. It uses native DNR for network blocking. Bloku disables
filtering logs, cosmetic hit collection and scriptlet debugging; it does not
retain full request logs or send extension telemetry. Production counters use
Chrome's badge and explicit current-page inspection, not lifetime estimates.

The inherited Zod 3 dependency has an unresolved high-severity advisory
GHSA-mrhx-c7xc-m3w5. Bloku does not force an incompatible Zod 4 override. Local
engine input is bounded before SDK validation (256,000 UTF-8 bytes / 5,000 lines,
200 focus domains, 1,000 site exceptions); filter resources are pinned build
inputs. These restrictions reduce exposure but are not an upstream patch.
`js-yaml` is overridden to compatible 3.15.2. Its JavaScript-tag constructor
helpers remain in the stock bundle; the scriptlets redirect parser uses
`safeLoad`, selected resources are trusted and local, and CSP omits unsafe-eval.
Stock `logEval` scriptlet helpers also remain; selected initial pack sources do
not request them. This is bounded source inspection, not a scanner-clean claim.

## Engine acceptance evidence — 2026-11-01

Chrome for Testing 156.0.8078.80, isolated disposable profile:

- 21/21 browser cases passed: production-permission startup; third-party and
  first-party behavior; initiator/resource scopes; packaged CSS/raw script/
  scriptlet execution; important static exception precedence; parent/user
  exception precedence with unaffected siblings; exact-site exceptions;
  important packaged/local redirects; independent ad pause/focus;
  conversion failure restoration; 1,001-regex quota restoration; full real-pack
  focus; optimized-pack capacity/focus; every optional regional/annoyance pack
  loaded with optimized base and active focus.
- 9/9 policy/transaction unit tests passed.
- 22/22 foundation/migration/focus/repository tests passed at this checkpoint.
- Strict TypeScript checks passed for adapter/policy/transaction/background/
  blocked-page sources. Full extension packaging passed.

Reproduce with `npm ci`, `npm run test:engine`, `npm run test:foundation`,
`npm run test:engine:browser`, and `npm run build:v2`. The browser gate expects
Chrome for Testing under `engine/.cache/browser` or `BLOKU_CHROME_PATH`.
Generated outputs, browser profiles and downloaded browser binaries are ignored
by Git. `gate-generated/gate-results.json` is the executable test report.

The fixture gate is not a general internet-site compatibility benchmark. Full
product UI, upgrade, worker lifecycle, consent and regional-pack qualification
are separate acceptance checks; do not infer those from this engine result.
