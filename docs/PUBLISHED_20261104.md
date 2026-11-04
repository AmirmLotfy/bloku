# BLOKU 2.0.0 public release — 4 November 2026

BLOKU — Ad Blocker & Focus, existing extension ID `mjfieeobdnanclichjahkhkkhlipnigj`, is publicly available as version **2.0.0**. The live public Chrome Web Store listing was inspected on 4 November 2026 and displayed version 2.0.0, updated November 4, with eight languages and the corrected description. The publisher also supplied Google's publication notice. No further submission, certification, package upload or publication action was needed.

Install: https://chromewebstore.google.com/detail/mjfieeobdnanclichjahkhkkhlipnigj

Website: https://bloku.app

## Website publication alignment

The temporary approval notice and its unused translations/styles were removed from all eight website languages. Localized Add to Chrome / reinstall buttons are restored. Software structured data now declares Published, InStock and the Store download URL for version 2.0.0. Privacy disclosures, original visual direction, level cards, correct publisher destination and optional external PayPal support remain.

Exact staged-and-promoted production deployment: `dpl_4XEcXR6srY3iYYA7Y1qKreBWZHdn`, `https://bloku-website-oxb354j6p-mellardoos-projects.vercel.app`. Verified project `prj_Wx9myW6YY9CrHAhOUBxH4e9A8SSy` in `mellardoos-projects`. Production was prepared from public static files, staged with `--prebuilt --prod --skip-domain`, verified, then promoted without rebuilding or weakening access protection.

Recovery target: `dpl_H7q7JrQ2r8GeuDGtcwYxLTpSUUuc`, `https://bloku-website-mjk9ga0n3-mellardoos-projects.vercel.app`. For a critical website regression, promote that recorded production deployment with the same explicit team scope, then verify the public domain. It contains the old waiting notice, so use only for recovery and correct that notice before considering recovery complete. Do not alter the published extension merely to recover the website.

## Verification

- TypeScript, lint, build and 11 website tests passed. The existing release-availability assertions now require the published Store URL, InStock metadata, localized install controls, and absence of obsolete waiting notices across all 96 routes.
- The exact prepared output passed 16 narrow local Chrome homepage/privacy surfaces across eight locales, Arabic RTL, no horizontal overflow, keyboard skip access, zero captured page/console errors and zero external requests. The owned browser/server closed cleanly.
- 18 authenticated staged HTTP checks passed. After promotion, 152 unauthenticated public HTTP checks passed: all localized routes, non-HTML resources, localized 404s and canonical redirects. Response bodies matched the prepared files and indexable pages had no noindex response header.
- The actual in-app-browser English/Arabic walkthrough confirmed the restored install labels, removed notice, 1280px layout without horizontal overflow, Published/InStock software metadata and zero captured console errors.

The first staged verification attempt could not start because the pinned verification CLI was absent from the npm cache. The pinned official tool was restored and the complete checks passed. That original tooling failure is retained privately and is not represented as a site failure or a passing check.

## Packages and evidence boundaries

The original submitted Chrome ZIP is unchanged: SHA-256 `e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875`. Store publication and website alignment introduced no extension runtime, engine, filter, permission or manifest changes. Original RC1/RC2 tags, packages and earlier evidence remain historical snapshots. The stable release provides this original Chrome package plus corresponding current public source, website output, evidence and checksums.

Store approval does not establish universal effectiveness, ranking, field performance, native-speaker/screen-reader acceptance or untested authenticated business workflows. Existing RC2 qualification limits and the documented upstream Zod advisory remain. This milestone did not perform another engine build, dependency/security audit or expanded extension runtime qualification.

Only selected safe reports, Store product/version metadata and public website screenshots are published. No account screenshots, authentication headers, credential/configuration files, backend files, dependency caches or private checkout history enter the public archives.
