# BLOKU 2.0 publication checkpoint — 2 November 2026

The owner instructed “deploy and publish everything,” then explicitly confirmed the three publisher data-use certifications and submission with automatic publication after Google approval, including the documented testing limits and upstream dependency advisory. This supersedes the earlier policy-only release boundary and the earlier reservation of final Store actions.

## Website: public

The full eight-language website is live at https://bloku.app. Exact staged-and-promoted production deployment: `dpl_H7q7JrQ2r8GeuDGtcwYxLTpSUUuc`, `https://bloku-website-mjk9ga0n3-mellardoos-projects.vercel.app`, project `prj_Wx9myW6YY9CrHAhOUBxH4e9A8SSy` in `mellardoos-projects`. It was prepared from public static output, staged with `--prebuilt --prod --skip-domain`, verified, and promoted without rebuilding. The older protected/crawl-denied preview was not promoted; project authentication protection was unchanged.

The original espresso/porcelain/burgundy direction and level cards remain. The site has the correct https://frameless.com.eg publisher link and the verified optional external PayPal support link. Google Analytics, old Premium marketing/pricing, invented ratings/adoption/savings/ML claims and old publisher links are absent from the newly served website. Separate historical source/evidence archives retain their original contents and are not current marketing.

Because the Store still serves 1.1.3 while 2.0 awaits approval, all pages carry a localized availability notice. Store actions say “View Chrome Web Store” rather than promising an available 2.0 download. Structured data marks the 2.0 offer as pending availability and omits its download URL. After actual public Store version 2.0 is verified, remove this temporary notice and update actions/schema; do not infer approval from this deployment.

The full privacy pages now accurately describe the analytics-free new website while retaining version scope and earlier-extension/license-record disclosures. The previously published packaged policy TXT URL remains reachable. The policy-only transitional disclosure about old website GA is superseded by the full website launch.

## Store: submitted, awaiting approval

Existing extension ID `mjfieeobdnanclichjahkhkkhlipnigj`, version 2.0.0. The publisher’s confirmed certifications were saved, submission was sent, and the initial review rejected the platform-name enumerations in all eight descriptions as **Yellow Argon / excessive keywords**. The lists were removed and replaced with localized supported-feed benefits. One YouTube example remains to explain its actual controls; limitations and privacy wording remain.

All eight descriptions were reloaded and read back exactly against the corrected source. The corrected draft was resubmitted; Google displayed “Your extension was submitted for review” and the actual Status page displayed **Pending review** / “This draft is pending review.” Automatic publication after approval was selected; the safe-static-rules review exemption was not selected. There was no appeal, replacement item, permission change, account/credential change or new package upload.

Pending review is not approval or public 2.0 availability. The submitted Chrome ZIP remains SHA-256 `e3e427cc11ceb8f786bc51a73a349bc0b6096c334bbedf844eecb8f92bd6c875`. Original RC2 source/build/evidence archives and tag remain immutable. Corrected listing text and website source are additive publication inputs, not requalification of changed extension runtime code.

## Verification and limits

- Website TypeScript, lint, production build and 11 tests passed. The changed availability-schema test initially caught the intentionally removed download URL; it was updated to require explicit pending availability, and all checks passed on the final source. The final checks also require eight privacy sections and localized availability notices across all 96 routes.
- Isolated local Chrome verified 16 narrow homepage/privacy surfaces across eight languages, Arabic RTL, no horizontal overflow, keyboard skip access, correct publisher, loaded module scripts and no captured errors or external requests. Browser/server cleanup completed.
- 18 authenticated staged HTTP checks passed; 152 **unauthenticated public** HTTP checks passed, covering all 96 localized routes, every non-HTML public resource, eight localized unknown-path 404s and canonical redirects. Response bytes matched the prepared production files; indexable public pages had no `noindex` response header.
- Actual in-app browser English and Arabic walkthrough passed at 1280 CSS pixels, with no horizontal overflow, correct publisher/PayPal URLs, no analytics scripts or captured console errors, and working reversible interactive-demo switches.
- These are bounded static/browser checks, not field Core Web Vitals, native-speaker, native screen-reader or real-device acceptance. Existing extension workflow/video/accessibility/benchmark limitations and the Zod advisory remain as documented with RC2. Owner confirmation authorized submission with those known limits; it did not eliminate them.

## Recovery and next action

For a critical website regression, restore the previous policy-only deployment with `vercel promote https://bloku-website-41kgvx9ge-mellardoos-projects.vercel.app --scope mellardoos-projects`, then verify https://bloku.app and policy routes. This restores the old marketing with its transitional policy, so use only for recovery, not as the intended final website. Never change the Chrome package or withdraw/resubmit the pending review merely to roll back the website.

Next external step is Google’s review. When public Store version 2.0 is verified, update the website’s temporary availability notice, CTA labels and structured data. If Google rejects the corrected submission, inspect its specific new reason before making another change; preserve current evidence and never repeatedly resubmit unchanged metadata.

Private account screenshots, authenticated headers, raw browser account text, project-link metadata and credentials are excluded from published evidence. Public status and hashes, corrected Store locale files, exact website source/output, and separate local/staged/public verification reports form the launch addendum.
