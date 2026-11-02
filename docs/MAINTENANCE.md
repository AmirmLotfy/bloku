# BLOKU maintenance contract

All extension features remain free. Revenue changes must preserve the free contract, local browsing processing and absence of paid blocking exceptions. No recurring automation or paid service is created by this document.

## Weekly operator review

1. Review Chrome extension release notes, policy changes and the stable/beta channels. Treat future 2027 changes as proposals until Google publishes requirements.
2. Review upstream AdGuard/Autoconsent releases and advisories. Update pinned dependencies deliberately; run migration, converter, engine, runtime and package gates before accepting the lockfile.
3. Refresh packaged lists through the acquisition script. Record upstream revision, hashes, licenses, dates and conversion warnings. Never skip failed downloads, silently trim rules, or ship remotely downloaded executable code.
4. Re-run the fixed compatibility matrix and investigate new breakage. Verify video playback/seek/captions/fullscreen and authenticated critical workflows with disposable test identities where available. Preserve reproducible reports and exact package/browser versions.
5. Review genuine user reports, Store conversion, retained users, uninstalls and reviews through Chrome Web Store reporting; use Search Console for the website. Do not add browsing telemetry or incentivized reviews.

## Before every release

Build from the pinned source/lockfile, qualify the exact generated files and browser lifecycle, archive the checksums/reports and verify source correspondence. Recheck permissions, local-data disclosures, honest listing claims, all eight locales, Arabic RTL, keyboard/zoom/reduced motion, website initial HTML and real 404 responses. Capture screenshots from the qualified build.

Keep owner approval of Store publication. Maintain an unpublished candidate and a tested recovery build; never promise an instantaneous Store rollback. Retain historical financial records and signed reconciliation routes independently of extension feature access.

Reference sources: [Chrome updates](https://developer.chrome.com/docs/extensions/whats-new), [DNR limits and rule behavior](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest), [lifecycle testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing), [accurate Store listings](https://developer.chrome.com/docs/webstore/best-listing), [local user-data disclosures](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq). Listing, local-data disclosure, DNR and lifecycle guidance rechecked 2 November 2026; recheck at submission.

## Prepared CI

`.github/workflows/bloku-qualification.yml` is prepared for pull requests, manual runs and Monday reviews. It pins action commits, grants read-only repository access, runs one browser matrix job at a time, and tests minimum/stable/beta Chrome from the official Chrome for Testing distributor. It does not deploy, publish, update dependencies, change filters, or send messages. It runs only in a repository containing this source with Actions enabled; these local qualification reports claim no hosted run.

`v2-dependency-audit.mjs` stores the full npm advisory report and fails for unexpected advisories or critical severity. The inherited Zod advisory is explicitly labeled residual risk, with an exception review deadline of 1 December 2026; it is never reported as a clean audit. Renewing that review requires a deliberate source change and upstream investigation. Filter revisions still require the operator review above.
