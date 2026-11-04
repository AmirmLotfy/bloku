# BLOKU 2.0 privacy policy

Effective for the 2.0 extension. Last updated: 2 November 2026.

BLOKU is an ad-blocking and distraction-control extension published by Frameless. Every feature is free and no account or license is required.

## Data handled locally

BLOKU processes website addresses, network request and frame context, and page content locally as necessary to filter ads/trackers, hide selected elements, apply privacy choices, and enforce the focus rules you configure. The filtering library observes requests, navigation and transient request/response headers in addition to Chrome's native declarative blocking. Headers can include Cookie/Set-Cookie session values. These are processed locally, not retained in persistent request logs, uploaded by BLOKU or modified through cookie-management APIs. This is data handling even though it stays on your device.

Settings, filter state, site exceptions, saved selectors (including top-site/frame scopes for embedded-page hides), local rules, focus profiles and session deadlines are stored in extension storage. Daily allowances use observed active time only for sites you have explicitly configured. Long observation gaps, idle periods and unfocused windows are not counted. By default, only today's counters needed for allowances are retained. If you enable local activity history, summaries are retained for up to 90 days. Turning history off removes older summaries. You can delete local activity or export settings from the extension.

Current-page matched-rule counts are not exact lifetime totals. Migrated version 1 statistics remain labeled legacy estimates. Persistent request logging and telemetry are disabled. The extension does not record form values, passwords, payment details, or personal communications for its own purposes.

## Network and third parties

BLOKU does not automatically send browsing history, request logs, page content, focus activity, or settings to Frameless, AdGuard, DuckDuckGo or a telemetry service. Filter data, scripts and consent rules are packaged in the extension. Chrome obtains extension updates through Google's normal update service.

A fresh installation opens the localized BLOKU welcome page once. Updates, browser restarts and worker wakes do not reopen it. Uninstalling can open the localized goodbye page. These website visits expose ordinary hosting metadata such as IP address, browser headers and access time; no identifier, visited-site URL, settings or activity is appended to the URLs. They are separate from local browsing-history processing.

Opening a support, privacy or review link is a deliberate user action. The destination website handles that visit under its own policy and normal HTTP/server logging. Support emails contain the information you choose to send; review diagnostic details before sharing. The website offers optional one-time PayPal contributions with no additional extension features; PayPal handles that separate payment under its own policy. No payment service is embedded in the extension and no browsing context is appended to these links.

The use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements. Local data is used only for the disclosed ad-blocking, privacy-choice and distraction/focus functions. It is not sold, used for advertising, or used for credit decisions.

## Permissions and controls

Normal-web host access, scripting, request/navigation observation and declarative filtering provide blocking and page controls. Storage supports local state and packaged filters. Active-tab and context-menu access provide user-invoked page actions. Alarms and idle detection support schedules and active-time allowances. BLOKU does not request cookie-management, arbitrary user-script or production debugging permissions.

Cookie-dialog rejection, a limited script-readable privacy preference, tracking-link cleanup and YouTube autoplay controls are optional. The limited preference exposes navigator.globalPrivacyControl to page scripts but does not send the Sec-GPC HTTP header; BLOKU 2.0 does not provide complete GPC support. Unsupported dialogs remain usable. Privacy signals do not guarantee a website's compliance, and BLOKU does not promise anonymity or complete fingerprint protection.

## Retention and removal

Uninstalling removes Chrome-managed local extension storage. Any settings files you exported remain wherever you saved them. Old billing/support records are separate from extension storage and must be retained or removed according to their applicable purpose and requirements; uninstalling does not delete those records. BLOKU 2.0 does not contact the legacy billing backend.

Questions or data requests: support@bloku.app. The current website policy is https://bloku.app/privacy.
