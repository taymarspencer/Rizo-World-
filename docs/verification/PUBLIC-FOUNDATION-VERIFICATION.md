# Public foundation verification — v92

Date: 2026-10-04. Starting remote `7a64fe6763d81da017458d64d8956abb33e41d48`, branch `claude/rizo-codebase-audit-yuqlns`. Executed against the isolated checkout and its packaged static site. No application, deployment, live advertisement, consent decision or production-traffic generation was performed.

## Executed checks

| Command / suite | Result | Scope |
|---|---|---|
| Every `tests/*.test.js` with Node | **187/187**, eleven programs | Save/core contracts, Defense, Dungeon, mode host, training boundaries, Worker B economy, Worker J guards, release integrity, service worker, new ad boundary and public contracts |
| `python3 tests/browser-dungeon.py` | **153/153** | Real HTTP/localStorage/reloads; actual Rizo, opening, art-backed Threshold journey, controls including simultaneous touch actions, pause/holds, saves/receipts, First Knot, real homecoming, update and missing-mode recovery |
| `python3 tests/save-safety.py` | **37/37** | Invalid/newer/legacy saves, protected original bytes, multi-tab handling, House resident return, import/storage failure |
| `python3 tests/browser-defense-integration.py` | **78/78** | Defense planning/combat/banking, migration, checkpoints, economy, context isolation, layout and progression |
| `python3 tests/mode-contract.py` | **25/25** | Independent mode contracts and preserved unregistered slices |
| `python3 tests/training-contract.py` | **22/22** | Training registration, lifecycle, reward conversion and failures |
| `python3 tests/browser-launch-recovery.py` | **5/5** | Matching release, resume surface loss, actual removed-runtime fixture, visible recovery |
| `python3 tests/browser-v88-training-fixes.py` | **13/13** | Targeted training regressions |
| `python3 tests/browser-v88-authored.py` | **25/25** | Forage, Courier, Rain Walk, authored endings and freeze/restart |
| `python3 tests/browser-v87-arcade-freeze.py` | **66/66** | Shared pause/background/ad overlaps, timer/jobs/input and existing Arcade modes |
| `python3 tests/browser-public-product.py --directory <production-output> --evidence <review-directory>` | **150/150** | New public/product regression; see below |
| `python3 tools/build-site.py --out <fresh-output>` | **Success: 160 production files** | Links, metadata, loaded files and packaging; no docs/tests/reports/ad template or bogus ads.txt |
| `node --check` on hub, bootstrap, ad core and H5 provider; `git diff --check` | **Pass** | Syntax and whitespace |

Browser toolchain: Python Playwright 1.51.0 with its installed Chromium 134, Linux headless. Dependencies were installed as temporary QA tools, not game runtime dependencies. The agent-browser CLI could not start its daemon in this environment, so the existing direct Playwright test workflow was used. Tests previously pinned to `/usr/bin/chromium` now use Playwright's installed browser; a Rain Walk test waits for the actual decision state rather than assuming an animation frame ran within 120ms. No assertions about gameplay outcomes were removed.

The public suite visits World, Journal, About, Guide, Privacy and Terms **with JavaScript disabled** at 320, 375, 390 and 430px. It checks content, named links, loaded images, overflow, normal scrolling, selectable copy and primary touch navigation. It also checks skip/focus navigation, reduced motion, doubled prose size, deep 404 and absent ads.txt.

At each width it opens the actual game over HTTP, checks first-arrival World navigation, Den care without ads, sheet focus/background isolation, House identity, Dungeon physical controls and movement/flare, portrait/landscape sizing, pause/return, Defense controls in both orientations, placement/combat/menu and Arcade lifecycle holds. Default play produced **no JavaScript exceptions, console errors or external ad/analytics/font requests**. Offline checks stop the local origin as well as marking the browser offline, verify cached public/game content, and reject unknown routes with unavailable status rather than a fake successful game.

Manual visual review included the public World at 320/390px and actual Den/Hearth captures. Captures are native browser renders, not concept art. Reducing capture resolution from 2× to 1× changed their combined PNG size from 984,481 to **329,516 bytes**; the runtime artwork itself is untouched.

The first orientation test exposed an intrinsic auto grid row retaining portrait height. A single sizing rule in `public-game.css` bounds the device's row to the host viewport. Final rotation checks pass; the Dungeon module/styles were not edited. A worker-route test likewise exposed the need to limit offline game fallback to the actual root/index rather than every path ending with a slash.

## Performance evidence and limits

Executed `python3 tests/profile-public-product.py --directory <production-output>` against a fresh local HTTP origin: one cold-cache sample per page, 390×844, 4× CPU slowdown, 150ms latency, 200,000 bytes/s download, service workers blocked and all external requests rejected. Local responses were **uncompressed**. These are lab observations, not field Core Web Vitals, an INP measurement, Lighthouse scores or approval criteria.

| Sample | LCP | CLS | DOMContentLoaded | Resources / transferred bytes | Largest long task |
|---|---:|---:|---:|---:|---:|
| Public World | 524ms | 0 | 217ms | 3 / 300,192 | 71ms |
| First game arrival | 8,096ms | 0.0516 | 14,183ms | 56 / 2,603,873 | 165ms |

Both samples loaded without page errors or external requests; the game reached a healthy boot. **The game's constrained cold-load time is a remaining performance concern.** The public entry is much lighter. Production hosting should negotiate Brotli/gzip and use correct revalidation/cache headers; rerun on that deployed configuration before drawing conclusions from the uncompressed preview. A measured mode-loading project may follow, with boot/load-order/save/update regression coverage. This pass did not refactor mature mode loading to chase a synthetic score.

## Preservation

- `modes/dungeon/`, `modes/defense/`, `training/`, `core/rizo-save-core.js` and `docs/dungeon/story/` have no source changes from the starting checkpoint.
- Hub state version remains 22; v2 save keys, mode schemas, canonical pet identity, receipts and manifest `id` / `start_url` / scope remain compatible. Changing origins still requires deliberate export/import.
- Narrative v0.1 SHA-256: `953e6d9c869c992681a6c69b169808f2a02c2ba8e828aca1b21960d702c01105`.
- Narrative v0.2 SHA-256: `4c0f3bc4a145649a113f689bfc25357f15b43af287c02d1ebf8e9a6b3b078b96`.
- The Defense browser suite regenerates a historical report containing timestamps/random QA IDs. That incidental report was restored to its starting bytes; this verification document records the executed result without unrelated report churn.

## Not covered

Physical iOS Safari/Android Chrome, standalone PWA lifecycle under OS memory pressure, real notch/browser-chrome safe areas, complete assistive-technology gameplay, production host/header/DNS/TLS/crawler reachability, field percentiles, a real CMP and Google SDK/account integration remain release tasks. Automated local mocks validate the callback boundary; Google's official mock SDK path is documented for later owner-confirmed integration and was not invoked with an unverified account.

Historical browser/capture/profile scripts throughout the repository were not all rerun. The current eleven Node and ten browser suites above ran; older release snapshots are retained as history. See [PUBLISHER-READINESS.md](../current/PUBLISHER-READINESS.md) for public beta, AdSense and H5 gates.
