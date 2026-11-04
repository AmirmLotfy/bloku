# Architecture

BLOKU contains two independently built projects: a Chrome Manifest V3 extension and a static marketing website. `shared/product.json` provides the website's product metadata. Neither project requires an application account.

## Extension

The service worker in `extension/src/background.ts` coordinates settings, focus, lifecycle events and filtering. Popup and options pages communicate with it through the extension API. Content scripts apply chosen page controls and saved hides.

`extension/engine/adapter.ts` is the sole application owner of filtering mutations. It uses the stock AdGuard SDK and composes user choices through the supported configuration API. Transactions serialize changes, verify the applied rules and persist confirmed state. When an update fails, the engine attempts to restore the last confirmed configuration; an unverified state must not be presented as active protection.

Focus policy excludes focused destinations from applicable exception rules and handles supported important exceptions and redirects through SDK mechanisms. Pausing ads preserves active focus restrictions. Existing matching tabs are redirected only after a confirmed focus change. Focus sessions use persisted deadlines and alarms; schedules use device-local time and allowances use observed foreground activity. Focus remains under the user's control.

Settings migration validates stored results before retiring older identifiers. Editable settings and live session/activity state are handled separately so ordinary saves do not overwrite newer activity. Unknown newer schemas are retained.

## Build pipeline

The engine build verifies original filter hashes, converts them with the official MV3 converter and bundles required script resources locally. Unexpected conversion errors and quota truncation fail the build. The extension build adds UI bundles, locale catalogs, manifest resources, notices, dependency metadata and checksums.

`engine/generated/` and `dist/` are outputs. Original `engine/vendor/` files, package lockfiles and build scripts are source inputs. See [filter maintenance](filters.md) for the acquisition process and [engine integration details](../extension/engine/INTEGRATION.md) for policy and dependency constraints.

Unit tests cover policy, transactions, migration, focus and state behavior. A separate browser gate checks SDK integration with local fixtures, including focus precedence and failure restoration. Its result applies to the exercised cases and browser version.

## Website

ReactDOMServer prerenders localized routes during the Vite build. Production HTML includes visible copy, canonical metadata, locale links and structured data before hydration. Ordinary links handle navigation. The static preview server and hosting configuration return actual 404 responses.

The website includes eight locale catalogs and Arabic RTL. Product screenshots and brand derivatives are committed assets. Optional external funding links are website-only and independent of extension functionality.
