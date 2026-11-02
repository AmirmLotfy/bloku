# Performance review and limits

The recorded five-variant comparison is in `PUBLIC_QUALIFICATION.md`, tied to its exact older checksum-manifest hash. Later UI/import/copy fixes are separately qualified. The measured results do not support a fastest or number-one claim.

Across five eligible measured pages, BLOKU used less browser CPU than the no-extension control on BBC/Amazon and more on YouTube/MDN/Wikipedia. Peak summed Chrome RSS was approximately 241–503 MiB higher than the control. This includes all processes belonging to the test browser and may double-count shared pages; it is not extension-private memory. BLOKU’s RSS was below official AdGuard on BBC/Amazon and above it on YouTube/MDN/Wikipedia. Live-site variability, three samples, different fresh-install defaults, optional permission choices and page-cache/process history limit inference.

A bounded source review found one guarded SDK instance, one start followed by serialized configuration, and statistics, persistent declarative logging, debug scriptlets and stealth features disabled. The stock SDK intentionally maintains JavaScript filtering machinery alongside Chrome DNR and retains conversion metadata for correctness. Its indexed storage uses per-list locks and checksum caching. No clear accidental duplicate instance, proven leak, or justified safe source optimization was found.

The products do not perform equal filtering work: default enabled static rule counts were BLOKU 197,943, uBOL 18,870 and AdGuard 70,804. Rule count is neither an effectiveness score nor a direct memory predictor. Removing SDK metadata or silently downgrading lists to improve a benchmark would not be justified by these observations.

Future optimization should use reproducible cold/warm profiles, an idle/suspended service-worker condition, controlled ad/legitimate-resource ground truth, and extension/process attribution before changing the default tier. Keep existing correctness, focus precedence and rollback gates. Do not infer steady-state private memory or real browsing speed from a short-window RSS maximum.
