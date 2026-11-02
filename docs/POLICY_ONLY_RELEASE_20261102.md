# Privacy-policy-only release — 2 November 2026

The owner approved publishing the updated privacy policy now while coordinating the full BLOKU 2.0 marketing launch with Chrome Web Store availability. This is a separate website release; it does not change or certify the extension package or submit the Store draft.

## Scope and source

Eight static policy pages describe BLOKU 2.0's local processing, request/frame/header context, incidental session identifiers, storage, optional history and controls, packaged filters, support, historical payments, and optional PayPal support. Transitional text distinguishes earlier extension versions and explicitly discloses Google Analytics on the retained old website. The policy pages themselves have no JavaScript, analytics, embedded payments, forms or preference storage. Hosting still receives ordinary HTTP request information.

`Bloku-Website/scripts/prepare-policy-release.mjs` builds the isolated Build Output API directory from the current production baseline and the eight translated RC2 website privacy pages. `policy-transition-copy.json` supplies the transitional disclosures. The packaged extension policy text is included verbatim as a separate downloadable document; the HTML policy adds the current website and earlier-version context.

Ten existing public assets are preserved byte for byte. The old HTML shell gains only a content-hashed, same-origin navigation script: the retained React Router would otherwise show the obsolete bundled privacy page on internal navigation. The script routes only privacy navigation to the new static pages, including browser history navigation. Existing marketing copy, analytics, theme behavior, SPA content and non-policy fallback remain during this transition. Their retained historical claims are not newly qualified or endorsed by this policy release.

## Deployment and recovery

Verified team: `mellardoos-projects` (`team_uUEimuLcXhW5AeImgUsFxmDe`). Project: `bloku-website` (`prj_Wx9myW6YY9CrHAhOUBxH4e9A8SSy`).

Previous production: `dpl_2qGLLKMzfgYS87WCscXkqfkGGDUo`, `https://bloku-website-o4qdau7ha-mellardoos-projects.vercel.app`. Its uploaded source contained a stale generated snapshot; the actually served HTML and its referenced JavaScript were captured as the authoritative public baseline. The baseline manifest records this distinction.

Staged production: `dpl_GVa6kdZR11w1YphUmL5JH1hFYqku`, `https://bloku-website-41kgvx9ge-mellardoos-projects.vercel.app`, created with `vercel deploy --prebuilt --prod --skip-domain --scope mellardoos-projects`. It is a production build, not the full V2 preview.

Before assigning the public domain, verify all eight policy responses, ten retained assets, seven retained SPA routes, five canonical redirects and three new resources against their local hashes. Authenticated staged responses do not prove public availability. Promote this exact production deployment only after those checks pass. Then repeat the checks without authentication on `https://bloku.app` and inspect the actual English and Arabic pages in the browser.

If a critical regression is found after promotion, restore the recorded prior production deployment using `vercel promote https://bloku-website-o4qdau7ha-mellardoos-projects.vercel.app --scope mellardoos-projects`, then verify the domain mapping and old public hashes. Recovery would also restore the old policy, so resolve the policy regression before Store submission. Do not change project access protection, delete deployments, or substitute the full V2 preview.

An earlier unpromoted candidate (`dpl_5QS5eDuLSqAkv7jVWuphg82uJuJ2`) failed the Portuguese case-redirect assertion because Vercel routes default to case-insensitive matching. Explicit `caseSensitive` flags resolve the overlap. The failed candidate and its original evidence are retained privately; its checks are not represented as final-build acceptance.

## Acceptance boundaries

The local isolated Chrome check passed 16 policy surfaces at 320 and 1280 CSS pixels across all eight locales, with Arabic RTL, image loading, canonical/hreflang metadata, no horizontal overflow, keyboard focus, no policy scripts/storage/cookies/external requests, and zero captured policy console/page errors. Nine navigation cases covered retained SPA rendering, the real old footer link and programmatic SPA privacy navigation. Local routing emulation does not establish hosted routing; hosted HTTP and actual browser verification are separate release evidence.

This does not establish native screen-reader or native-speaker acceptance, field Core Web Vitals, Store approval, universal ad/video effectiveness, or authenticated business-site compatibility. RC2 qualification limitations and the outstanding dependency advisory remain unchanged. Final Store certifications, submission and publication remain with the owner.

## Published result

The exact staged production deployment was promoted after all 33 staged HTTP assertions passed. The public domain then resolved to `dpl_GVa6kdZR11w1YphUmL5JH1hFYqku` and passed the same 33 checks **without authentication**: eight policies, ten retained assets, seven retained SPA routes, five canonical redirects and three new resources. Public policies return HTTP 200 with the expected HTML, CSP and content type, with no `noindex` header.

Actual in-app-browser verification passed on `https://bloku.app/privacy` and `https://bloku.app/ar/privacy`: eight sections, no scripts, loaded images, 1280px viewport with no horizontal overflow, correct English/Arabic language and RTL direction, and the correct Frameless publisher destination. The actual old marketing footer opened the new static policy, and no browser console errors were captured in this walkthrough. The original full V2 preview remains separate.

Public policies: `/privacy`, `/ar/privacy`, `/es/privacy`, `/pt-br/privacy`, `/fr/privacy`, `/de/privacy`, `/ja/privacy`, `/hi/privacy`. The old marketing still includes Premium pricing and historical unsupported claims until the coordinated V2 marketing launch; this policy-only release does not represent their removal.

Evidence: `artifacts/release-policy-20261102/bloku-privacy-policy-2026-11-02.zip` and its separate `POLICY_SHA256SUMS`. Original RC2 archives and source tag are unchanged. The additive packet includes source helpers and exact policy/baseline inputs, deployed output, separate local/staged/public reports and recovery instructions; it excludes private authentication responses and account screenshots.
