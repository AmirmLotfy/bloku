# Chrome Web Store disclosure review — 2 November 2026

**Owner-review proposals only. No Store field, checkbox, certification, submission or publication was changed by this review.** Compare the actual dashboard definitions and final packaged behavior before entering or certifying any answer. This document is not a completed disclosure form or legal certification.

Reviewed the frozen 2.0 candidate source, packaged privacy policy, manifest, SDK adapter and existing Store release guidance. The observed local checksums-manifest SHA-256 was `817fc857d09b878d0b54613e52e24119ff892316ffc206f59b4d3e9b610d064b`. Source inspection establishes the behavior described below; it does not prove absence of every incidental data type in arbitrary websites.

## Read this before using the checkbox proposals

**Suggested unchecked categories do not mean “BLOKU never handles this information.”** Arbitrary page content, URLs and headers can contain personal, financial, health or communication information. The proposed unchecked rows reflect the absence of a dedicated collection/extraction/account/payment function found in the reviewed extension source. They are inferences for owner review, not an exemption established by Google. If the actual dashboard definition includes incidental handling relevant to this implementation, revise the proposal rather than certifying a narrower claim.

Google's [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), rechecked during this review, treats local processing/storage as handling that requires disclosure. It specifically includes browsing activity, website resources and authentication cookies. The [privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) requires dashboard disclosures and certifications to match the extension and public privacy policy. No upload, cookie-management permission or persistent log is necessary for local handling to occur.

## Proposed category mapping

| Dashboard category | Proposal, pending actual definition | Reason and source pointers |
| --- | --- | --- |
| Web history / web browsing activity | Select | The extension uses URLs, request/navigation/frame context and configured domains. Site rules and activity summaries can persist domains locally. `B2/PRIVACY_POLICY.v2.md:9–11`; `B2/src/background.ts:112–123,181–188,367–374`; `B2/v2-manifest.json:9–15`. This is not a claim of complete Chrome-history database access. |
| Website content | Select | Packaged cosmetics, page controls, consent handling and the element picker inspect/manipulate page DOM and retain chosen selectors. `B2/PRIVACY_POLICY.v2.md:9–11`; `B2/src/content.ts:7–15,31–53`; `B2/src/background.ts:232–243`. Stored selectors differ from persistent storage of entire page contents. |
| User activity | Select | Network/request monitoring and configured-site foreground, idle and active-time observation support blocking and focus allowances. Local summaries retain today's needed counters or optional history up to 90 days. `B2/src/background.ts:112–123`; `B2/src/focus.ts:28–51`; `B2/PRIVACY_POLICY.v2.md:11–13`. This is not advertising analytics or an exact lifetime blocking total. |
| Authentication information | Select | The filtering SDK can transiently handle request/response Cookie and Set-Cookie session values. Lack of the `cookies` permission does not eliminate that handling. `B2/PRIVACY_POLICY.v2.md:9`; `docs/STORE_RELEASE.md:33,61`; `B2/engine/adapter.ts:44–52`. The reviewed disclosure does not assert observation of Authorization headers or persistent credential collection. |
| Location | **Conditional: inspect the exact dashboard help.** Select conservatively if it includes IP addresses and the automatic first-party website hosting flow falls within its scope. | Fresh-install welcome and uninstall goodbye visits expose ordinary user IP/browser headers/access time to the host. The policy already discloses that flow. `B2/PRIVACY_POLICY.v2.md:19`; `docs/STORE_RELEASE.md:35`. No GPS/geolocation function was found; absence of GPS alone does not resolve an IP-inclusive category. Host processing is disclosed; specific log retention was not independently inspected in this review. |
| Personally identifiable information | Proposed unchecked, subject to the prominent incidental-data caveat | No dedicated identity/account fields or identity collection function was found in the reviewed 2.0 extension. Voluntary support records are separate. `B2/PRIVACY_POLICY.v2.md:5,13,21,33`; `docs/STORE_RELEASE.md:35`. Do not turn this into a promise that URLs, selectors, cookies or arbitrary DOM cannot contain identifiers. |
| Financial and payment information | Proposed unchecked, subject to the same caveat | The 2.0 extension has no payment/license-validation function and does not contact the legacy billing backend. Optional PayPal support is a separate website flow; historical financial records do not establish current extension payment collection. `B2/PRIVACY_POLICY.v2.md:5,21,33`; `docs/STORE_RELEASE.md:35,67`. |
| Health information | Proposed unchecked, subject to the same caveat | No dedicated health-data function or extraction was found. General page processing is declared as website content; the owner must resolve any broader dashboard interpretation. `B2/PRIVACY_POLICY.v2.md:9,13`; `B2/src/content.ts:7–15,31–53`. |
| Personal communications | Proposed unchecked, subject to the same caveat | No dedicated email/chat/message capture function was found; the policy distinguishes information voluntarily sent to support. General page processing may encounter such content incidentally. `B2/PRIVACY_POLICY.v2.md:9,13,21`; `B2/src/content.ts:7–15,31–53`. |

## Processing, storage and transmission are different facts

- **Transient local processing:** URLs, navigation/frame context, page DOM and potentially authentication-cookie header values. This is handling even when not logged or uploaded.
- **Persistent local state:** settings, site policies, selectors and local rules, focus profiles/deadlines, allowance counters and optional activity summaries. See `B2/PRIVACY_POLICY.v2.md:11` and `B2/src/focus.ts:28–51` for retention boundaries.
- **Disabled SDK retention/features:** `declarativeLogEnabled: false`, `collectStats: false`, scriptlet debugging off and stealth/cookie mutation features off in `B2/engine/adapter.ts:44–52`. These settings do not establish that the SDK never receives headers or other request context.
- **Separate website/provider/support handling:** automatic clean lifecycle visits, deliberate external links, support email, optional website PayPal payments and historical records are disclosed in `B2/PRIVACY_POLICY.v2.md:19–23,33`. No identifier, visited-site URL, settings or local activity is appended to lifecycle URLs. A normal HTTP request still exposes hosting metadata.

## Existing dashboard state and reusable material

The coordinator's earlier authenticated walkthrough reported version **1.1.3**, old Premium copy and selected **Personally identifiable information** / **Financial and payment information** categories. That observed old state is documented at `docs/STORE_RELEASE.md:39`; it is not this review's 2.0 proposal and not an RC2 certification. Do not copy or clear those choices automatically.

Use `docs/STORE_RELEASE.md:31–41` for the current privacy/limited-use and remote-code review context, and `docs/STORE_RELEASE.md:43–61` for concrete permission-purpose material. Compare the final ZIP's manifest against `B2/v2-manifest.json:9–15` before using those justifications. The current policy's Limited Use statement is at `B2/PRIVACY_POLICY.v2.md:23`; keeping that statement in a policy does not itself complete the dashboard certification.

The owner must review each actual certification statement against the disclosed single purpose, permitted data use/transfers and implemented behavior. No permission justification, checkbox proposal or absence of telemetry in this packet authorizes automatic certification. Before submission, the accurate candidate policy must also be publicly reachable at the Store's configured policy URL; a protected preview alone does not satisfy that publication boundary (`docs/STORE_RELEASE.md:65`).

## Review result and stop boundary

No unsupported blanket “all categories unchecked because processing is local” instruction was found in the selected current materials. `docs/STORE_RELEASE.md:37` expressly warns against it, and the packaged policy acknowledges local handling. The remaining decisions concern the actual dashboard definitions, incidental-data interpretation, the conditional IP/location boundary, public-policy alignment and the owner's final truthful certification.

This documentation-only task performed no browser/heavy check, account readback or Store mutation. Existing source/package/runtime results remain bounded by their own hashes and reports. Ownership returns to the coordinator after this document is checked; no continuation or provider action is implied.
