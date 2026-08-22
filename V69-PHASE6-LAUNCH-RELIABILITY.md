# Phase 6 Launch Reliability / White-Screen Fix

## Failure identified
Earlier releases changed the contents of files that retained `v64` names while the service worker treated those same URLs as cache-first. During an update, a browser could combine new HTML with an older cached runtime. That creates a credible blank-screen/mixed-build failure mode. The automatic PWA install gate could also look like the site was forcing a download/install flow.

## Fix
- v69 uses new CSS/core/runtime filenames.
- Core boot files are network-first with `cache: no-store` and cached fallback.
- HTML navigation is network-first.
- Required shell cache installation is atomic; optional art is best effort.
- `boot-v70-phase7.js` verifies page/runtime build identity and exposes visible recovery.
- Cache reset removes Rizo service workers/caches only; local save storage is preserved.
- Automatic install gate is disabled; Settings retains explicit Install Help.
- `_headers` explicitly declares HTML/JS/CSS/manifest MIME types and no-cache behavior for runtime resources.

## Verification boundary
The container's Chromium is administrator-blocked from connecting to localhost, so a genuine HTTP service-worker lifecycle could not be run here. A VM-based service-worker policy test verifies the exact stale-cache decision path, and normal browser suites verify the complete v69 runtime inline. Physical Safari deployment remains required before calling the device-specific incident empirically closed.
