# BLOKU 2.0 release candidates

The artifact writer packages an **already-built** `B2/dist`. It does not run a build, copy notices into dist, refresh checksums, change browser metadata, qualify extension behavior, deploy, or submit to the store.

Run from the repository root, after the coordinator has frozen the intended inputs:

```sh
node B2/scripts/v2-release-artifacts.mjs --self-test
node B2/scripts/v2-release-artifacts.mjs --check-only
node B2/scripts/v2-release-artifacts.mjs
```

`--self-test` uses tiny temporary fixtures only. `--check-only` reads inputs and creates no release files. `--extension-only` omits the source archive; use only for a bounded candidate check, not as a replacement for corresponding source. `--include-website-source` adds a separate website source archive.

## Build contract

The builder must include these files **before computing `checksums.json`**:

- `LICENSE`, copied from the repository root.
- `NOTICE.md`, copied from `B2/NOTICE.v2.md`.
- `PRIVACY_POLICY.md`, copied from `B2/PRIVACY_POLICY.v2.md`.
- `third-party/LICENSE.Autoconsent` and `engine/LICENSE.AdGuard`.
- `engine/filter-sources.json`, copied from the pinned `B2/engine/vendor/sources.json`.
- `engine/build-report.json`, identifying a non-gate build and the matching filter revision.
- `SBOM.json`.

The artifact script rejects missing files. It compares the distribution's root license, BLOKU notices/privacy policy, and filter-source metadata with the current audited source. If those have changed since qualification, rebuild and requalify; do not patch the old dist or regenerate hashes by hand.

The root package, source manifest, and built root MV3 manifest must be version `2.0.0`. Every manifest asset and wildcard resource must exist; local HTML asset references are also checked. All eight Chrome `_locales` and runtime locale files must exist. Checksums must be valid SHA-256 values and cover every packaged file exactly, except `checksums.json` itself.

Chrome can create `_metadata/` after loading an unpacked extension. This is the only allowed unhashed input subtree: it is explicitly reported and omitted from the ZIP, never deleted from the qualified input directory. `_metadata` must not be listed in `checksums.json`. Any other missing, changed, unlisted, or forbidden file makes packaging fail. Backend files, environment files, dependencies, generated gate outputs, ruleset/filter 9000, probe/fixture files, test source and source maps cannot enter the Chrome submission ZIP.

## Output

Files are written under ignored `artifacts/release/`:

| File | Contents |
| --- | --- |
| `bloku-2.0.0-chrome.zip` | Validated distribution files, with `manifest.json` at ZIP root. |
| `bloku-2.0.0-source.zip` | Explicitly selected 2.0 extension source and build inputs. |
| `bloku-2.0.0-website-source.zip` | Optional, separately selected website source and shared files. |
| `release-manifest.json` | Archive hashes, input hashes, filter revision, excluded browser metadata, and explicit candidate status. |
| `SHA256SUMS` | SHA-256 checksums of the produced archives and release manifest. |

ZIP creation uses Python 3's standard library, sorted file entries, no directory entries or absolute archive paths, a fixed `1980-01-01 00:00:00` timestamp, regular-file permissions `0644`, and `0755` only for the explicit executable artifact script. Entries are stored without compression so byte reproducibility does not depend on a zlib version. A second archive read verifies every entry's bytes, order, timestamps, and permissions. Source changes between hashing and writing cause refusal instead of silently packaging different bytes.

Publication status is always `CANDIDATE_NOT_RELEASE_QUALIFIED`. A successful archive check verifies integrity and packaging boundaries, not runtime behavior. Qualification belongs to the coordinator and must refer to the final archive/input hashes. No current time, local absolute path, or machine-specific source path is put into the manifest. Input text is checked for workstation home-directory paths.

## Corresponding source boundary

The extension source archive includes the root license, audited 2.0 README/notices/privacy policy, package and lockfile, `v2-manifest.json`, presets, icons, shared product/design files, `B2/src` including tests/locales, engine TypeScript source/tests, pinned filter vendor files, the source acceptance fixture, and an explicit list of `v2-*` build/test/artifact scripts. It includes this document, the public qualification summaries and submission handoff. Private billing and deployment records are excluded. The gate **source fixture** belongs in corresponding source; compiled gate output and ruleset 9000 never belong in the submission.

The archive excludes legacy paid-extension root files, the backend, private billing/production-state documents, dependencies, deployment metadata, environment files, caches, builds, prior artifacts, and source symlinks. The old repack script and legacy filters/data are not selected. The included package scripts must use the audited 2.0 paths; the coordinator owns that update. The README must identify BLOKU 2.0 and explain `build:v2` before a source archive is accepted.

The optional website source archive selects only its source/public/scripts/tests, package/lock/config, README, shared files, and root license. It excludes `.vercel`, `.ssr`, dist, node_modules, validation screenshots, and operational reports.

## Verification sequence

1. Finish the source, notices, package scripts and metadata in their owning files.
2. Run the coordinated final build so those inputs are included before hashing.
3. Run the approved runtime/behavior gates against the exact built bytes.
4. Run artifact `--check-only`, then create the candidates.
5. Verify `SHA256SUMS` and inspect the ZIP-root manifest. Run any remaining exact-package acceptance checks and record their limits against these hashes.
6. Leave store upload and publication with the owner.

Repeated artifact creation from identical selected inputs produces identical ZIP bytes. A changed source archive or candidate hash invalidates any evidence that depended on the old artifact. The writer does not claim a public source repository, live release, license review, or store acceptance.
