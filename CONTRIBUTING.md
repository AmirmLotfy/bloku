# Contributing to BLOKU

Bug reports, focused fixes, accessibility improvements and translation corrections are welcome. For questions, contact [support@bloku.app](mailto:support@bloku.app).

## Report an issue

Include the BLOKU and Chrome versions, steps to reproduce, expected behavior and what happened. For filtering issues, provide a public example URL when possible and identify enabled filter lists. Remove personal data from screenshots and logs. Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Make a change

Keep pull requests focused and explain the user-visible change and checks performed. Use Node.js 22.12+ and the committed npm lockfiles. Follow the [extension](extension/README.md) or [website](website/README.md) setup guide.

For extension changes, build before running `npm run check`. Changes to filtering policy, SDK configuration or focus precedence also need the browser integration gate with an official Chrome for Testing executable. For website changes, run `npm run check` and inspect relevant pages on desktop and mobile, including Arabic RTL when the layout changes.

Preserve the eight locale catalogs and their placeholders. Keep all features free, optional website support independent of features, and product claims limited to supported behavior. Keep filtering mutations inside the stock SDK adapter; do not introduce a second DNR writer or silently drop filters to fit quota limits.

Do not commit generated builds, dependency directories, browser profiles, credentials or local reports. Original filter texts under `extension/engine/vendor/` are intentional source inputs; retain their license headers and update them only through the documented [filter maintenance process](docs/filters.md).

The project uses [GPL-3.0-only](LICENSE). Upstream contributions and components retain their applicable notices. BLOKU names and artwork remain Frameless brand assets.
