# Security policy

Report suspected vulnerabilities privately to [support@bloku.app](mailto:support@bloku.app). Include the affected version, reproduction steps, impact and a minimal example when possible. Do not include credentials or personal browsing data. Please allow time for investigation before public disclosure.

## Known dependency limitation

The pinned stock AdGuard SDK dependency tree currently includes **Zod 3.24.4**, affected by the high-severity advisory [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). A supported upstream SDK fix is pending; BLOKU does not force an incompatible Zod 4 override.

Engine inputs are bounded before SDK validation: 256,000 UTF-8 bytes and 5,000 lines of local rules, 200 focus domains and 1,000 site exceptions. Filter resources are pinned build inputs. These bounds reduce exposure; they are not an upstream patch or a claim that the advisory is resolved.

The existing advisory exception requires review by **1 December 2026**. `npm run audit:dependencies` in `extension/` records npm's current report and fails for unexpected advisories or an expired exception. No clean security audit is claimed. See [engine integration details](extension/engine/INTEGRATION.md) for additional inherited dependency limitations.

## Design boundaries

Filtering uses the stock AdGuard SDK through one serialized adapter. Failed configuration changes attempt to restore the last confirmed state. Filter sources and script resources are packaged at build time; the extension does not download executable filtering logic at runtime. Local settings and rule imports are validated before application.

For data handling, see the [privacy policy](extension/PRIVACY.md). Report ordinary site breakage and support requests through [support@bloku.app](mailto:support@bloku.app).
