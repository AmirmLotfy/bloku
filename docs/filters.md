# Filter sources and maintenance

BLOKU packages filters at build time. It does not fetch new filter lists while the extension runs. Regular builds use the committed originals under `extension/engine/vendor/` and verify each file against `sources.json`.

## Why the originals are committed

The original text is required to reproduce converted network rules, cosmetics, scriptlets and provenance. These files are source inputs, not disposable build output. `sources.json` records the exact FiltersRegistry commit, upstream path, URL and SHA-256 hash for every list. Keep the original copyright and license headers intact.

The pinned set includes AdGuard Base, Tracking Protection, the complete optimized Base alternative, regional lists and Other Annoyances. Upstream filter contributions retain their applicable licenses. See the [notices](../extension/NOTICE.md) and [AdGuard FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry).

## Refresh deliberately

Choose and review an exact 40-character commit from FiltersRegistry. From `extension/`:

```sh
npm run filters:update -- <exact-40-character-FiltersRegistry-commit>
npm run build
npm run check
npm run test:browser
```

Replace the placeholder with the full commit hash. The final command requires `BLOKU_CHROME_PATH` pointing to an official Chrome for Testing executable. The update command downloads the selected original texts and rewrites their provenance. Review the changed files, notices and conversion diagnostics before accepting an update.

A dependency install may access npm; ordinary filter conversion does not access upstream list URLs. Generated resources live under `extension/engine/generated/` and are not committed.

## Conversion and browser limits

The build uses AdGuard's official converter and Node CLI API, including its RE2/WASM validator. Unexpected conversion errors and silent quota truncation are rejected. Deliberately unsupported rules and exclusions are recorded in the generated build report; unsupported syntax must not be described as active protection. Cookie-mutation network rules are excluded because BLOKU does not request the cookies permission.

Chrome rule capacity varies. The complete optimized Base list is an explicit lower-capacity alternative; the build never slices a list to fit. Configuration failures attempt to restore the last confirmed state and surface an error.

Keep focus precedence and failure restoration covered by the stock SDK browser gate after filter or engine changes. Passing local fixtures does not establish universal site compatibility. See [architecture](architecture.md) and the [security policy](../SECURITY.md).
