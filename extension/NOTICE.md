# BLOKU 2.0 notices

BLOKU extension code is copyright © 2026 Frameless and distributed under GNU GPL version 3 only. The original BLOKU name and logo remain Frameless brand assets; upstream project names identify their respective authors and do not imply endorsement.

The extension uses AdGuard's open-source filtering libraries, converter, scriptlets and resources. Exact package versions and license identifiers are recorded in SBOM.json. The AdGuard GPL-3.0 license is included at engine/LICENSE.AdGuard. Compiled filters are derived from the pinned AdGuard FiltersRegistry revision recorded in engine/filter-sources.json; the original source text, copyright and license headers remain available in the corresponding source archive. Upstream filter contributions and dependencies retain their applicable licenses and notices.

Optional cookie-choice handling uses DuckDuckGo Autoconsent, distributed under Mozilla Public License 2.0. Its license is included at third-party/LICENSE.Autoconsent. Packaged rules are used only for supported opt-out flows. BLOKU does not provide a privileged generic evaluation bridge or download consent logic at runtime.

Filter conversion diagnostics, deliberate exclusions (including cookie-mutation rules), SDK/converter versions and source revision are in engine/build-report.json. A rule being excluded or unsupported must not be represented as successfully enabled protection. Browser rule capacity and website changes can limit coverage.

No Acceptable Ads program or paid blocking exception is included. All extension features are free. Optional external donations on the website do not alter filtering. Source/build instructions accompany the matching BLOKU source release. Contact: support@bloku.app.
