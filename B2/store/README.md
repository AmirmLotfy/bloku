# BLOKU 2.0 store material — release candidate

Eight `locales/*.json` files contain localized title, summary, description and five screenshot captions. English uses the approved title and exact 112-character summary. All features are free, without accounts or payments. Descriptions explain supported controls, opt-in privacy features, local processing, permissions, realistic limits and support/privacy links. Donations are not advertised as available while the verified destination is absent.

Validate from B2:

```sh
node store/validate-copy.mjs
node store/validate-ui-locales.mjs
```

The UI validator checks all 120 English keys against seven translations, including placeholders and length constraints. Independent native-speaker review remains outstanding.

`node scripts/v2-store-assets.mjs` captures real built extension UI and composes five screenshots plus two promotional tiles per locale. The asset manifest records exact package/caption/renderer hashes, raw captures and dimensions. See `docs/STORE_ASSETS.md` for capture provenance and review limits. Illustrative owned web fixtures are distinguished from real third-party sites.

Draft status is retained until exact-package qualification and owner review. Text validation and screenshots do not establish universal compatibility, measured performance superiority or Store acceptance. Do not publish the candidate copy against the old Store release. The existing extension ID and owner’s final submission/publication control remain unchanged.

See `docs/STORE_RELEASE.md` for reviewer instructions and disclosures, and `docs/RELEASE_NOTES.md` for migration and known limits.
