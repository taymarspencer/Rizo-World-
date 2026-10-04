# Release engineering verification — candidate 1

2026-10-04 UTC. Repository `taymarspencer/Rizo-World-`. Started at verified `a5b10db4ae19426e09967025baf543237bebe7c1`; `main` stayed at `e5f09048ec472850c44e69cb4f2e98c8006de02b`. `develop` was created from the exact starting SHA without rebuilding or rewriting history.

Candidate build: **`v92-release-candidate-1`**. Application/test fix commit: `f723da69660611571c600387b9eadfe604879bc3`. Its Git tree **`ff1fd32c14168e90342f63d819f9f680e63468da`** exactly matches the locally tested fix tree. The documentation/CI commit layered afterward changes no production artifact files.

## Minimal release-blocking fix

The original Dungeon suite failed twice at the QA completion/homecoming fixture: movement stopped before the open door, then the expected completed-journey button was absent. It had 133 passing checks and two failures before aborting; it did **not** complete 153 checks on that starting build here.

A focused real-browser trace found `input.clear("resize")` coming from `renderAll()` at the hub's ordinary five-second interval. Reflow could change the canvas metrics, cancelling an already held key without a real viewport resize. The minimal fix lets `resize(reason)` update layout while preserving controls for the `render` notification. Actual viewport notifications still clear held input. There is no change to Dungeon art, rooms, dialogue, rewards, story decisions, Defense balance or training behavior.

The existing complete Dungeon suite passed 153/153 after the fix. A regression was then added in the safe, defeated Porter room: hold movement through an explicit hub refresh and a real autosave interval, then perform the same homecoming. Final execution of the 154-check suite is recorded below.

The training contract originally reported 21/22 because two frozen epoch-sized doubles differed by approximately **0.000244 ms**. Its assertion now uses the same less-than-1-ms tolerance already used for remaining time. A real 1-ms advance still fails; the no-jobs-during-pause assertion remains unchanged. No runtime clock was changed.

HTML metadata/boot expectation, hub build constant and worker cache were bumped together. The build tool reports the matching candidate stamp. Exactly four of the 160 production files differ from the starting artifact: `index.html`, `game-v79-defense.js`, `sw.js`, and `modes/dungeon/dungeon-mode.js`.

## Executed local checks

Toolchain: Node **24.19.0**, Python **3.12.14**, Python Playwright **1.51.0**, headless Chromium **134.0.6998.35** on Linux. Browser tools were installed outside the repository; the website has no new runtime dependency. All tests use local data/mocks; advertising remains disabled.

| Command / current suite | Final result | Evidence scope |
| --- | --- | --- |
| All eleven `node tests/*.test.js` programs, each executed | **187/187 pass** | Save/core, Defense, Dungeon, mode host, training boundaries, economy/guards, ad/public contracts, release and worker integrity. |
| `python3 tests/browser-dungeon.py` | **154/154 pass** | Actual HTTP/save/reload, controls, art-backed Threshold paths, homecoming, receipts, recovery, orientation and new autosave/input regression. |
| `python3 tests/save-safety.py` | **37/37 pass** | Legacy/invalid/newer saves, quarantine, backup, reset, imports, blocked writes, multi-tab and House return. |
| `python3 tests/browser-defense-integration.py` | **78/78 pass** | Planning/combat/banking, checkpoints, economy, migration, progression and phone/landscape layout. |
| `python3 tests/mode-contract.py` | **25/25 pass** | Independent mode ownership, lifecycle and missing/unregistered slices. |
| `python3 tests/training-contract.py` | **22/22 pass** | Pet snapshot, clock/jobs/holds, growth conversion, credit and failures. |
| `python3 tests/browser-launch-recovery.py` | **5/5 pass** | Healthy candidate marker, foreground loss and removed-runtime recovery. |
| `python3 tests/browser-v88-training-fixes.py` | **13/13 pass** | Targeted training regressions and reward budgets. |
| `python3 tests/browser-v88-authored.py` | **25/25 pass** | Authored training runs, endings, freeze/restart. |
| `python3 tests/browser-v87-arcade-freeze.py` | **66/66 pass** | Stacked pause/background/ad holds, input, jobs and clocks; no page errors. |
| `python3 tests/browser-public-product.py --directory <candidate-output> --evidence <evidence-directory>` | **150/150 pass** | 320/375/390/430px public pages and actual game, portraits/landscape, content/links/images/focus, real deep 404, offline World/game and unknown-route 503. Zero default external/ad/font/analytics requests and no unexpected runtime/console errors. |
| `python3 tools/build-site.py --out <fresh-candidate-output>` | **160 files; success** | Production links, metadata and asset packaging; no docs/tests/reports/template or fabricated ads.txt. |
| `node --check` on changed runtime/worker; `git diff --check`; workflow YAML parse | **Pass** | Syntax, whitespace and valid workflow structure/read-only permissions. |

All suites above were rerun against the candidate after the runtime fix/stamp: **187 Node + 575 browser = 762 passing checks**. The earlier full run and its failures are not counted as passing evidence. Historical capture/profile/browser scripts outside these current release suites were not all rerun. Incidental regenerated tracked Defense reports were returned to their prior bytes; current outcomes are recorded here.

Manual inspection of native World captures at 320/390px confirmed the authored content and images remain usable. This is Chromium evidence, not a physical iPhone or a complete screen-reader audit.

## Performance warning reproduced

`python3 tests/profile-public-product.py --directory <production-output>` ran on the starting production artifact before the control fix. It used the documented 390×844 viewport, 4× CPU slowdown, 150-ms latency, 200,000 bytes/s download, cold cache, worker blocked and uncompressed local HTTP. One sample per page; no field percentiles or INP claim.

| Page | LCP | CLS | DOMContentLoaded | Resource bytes |
| --- | --- | --- | --- | --- |
| World | 488 ms | 0 | 194 ms | 300,192 |
| First game arrival | 8,064 ms | 0.0516 | 14,087 ms | 2,603,873 |

Both loaded without page errors/external requests and the game reached healthy boot. This reproduces the prior approximately 524-ms / 8.1-s / 14.2-s warning. The tiny input guard is not a performance optimization. Production Brotli/gzip and real-device cold-load measurement remain explicit launch gates; no large loading refactor was attempted.

## Preservation and integrity

- `modes/defense/`, `training/`, `core/rizo-save-core.js`, Dungeon art/content/scenery/view/input/styles, the four existing public-foundation documents and all of `docs/dungeon/story/` have no changes from `a5b10db4...`.
- Hub state version remains 22; save keys, envelope/signature rules, mode schemas, pet identity, receipts and PWA `id` / `start_url` / scope remain unchanged.
- Narrative v0.1 SHA-256 remains `953e6d9c869c992681a6c69b169808f2a02c2ba8e828aca1b21960d702c01105`; v0.2 remains `4c0f3bc4a145649a113f689bfc25357f15b43af287c02d1ebf8e9a6b3b078b96`.
- Candidate artifact fingerprint: sorted JSON map of relative paths to file SHA-256, serialized with Python `json.dumps(map, sort_keys=True)`, then SHA-256: **`e13f2a53197ed6f77ab8d16fb2485d8dbbd88f587810355156a2cc205c05bfc9`**. There are 160 files.

## GitHub verification and open launch gates

The new `.github/workflows/release-candidate.yml` runs these eleven Node and ten browser programs plus packaging on canonical-branch pushes and PRs targeting `develop` or `main`. It uses read-only repository permissions, no secrets, pinned official action commits and the same Playwright/browser generation. It archives logs/captures and, only on success, the static artifact for seven days. It never merges or deploys. Its hosted outcome must be read from the current commit's Actions run; YAML validation alone is not a claim of hosted success.

The [hosted push run for `3ed9020bfd20f8d088c690296804043a6304cde2`](https://github.com/taymarspencer/Rizo-World-/actions/runs/37173106885) completed successfully. Its decoded logs contain all 21 successful suite summaries, totaling **762**, and the 160-file candidate build. Its verified static artifact and QA evidence are available for seven days. A fresh checkout of that remote commit rebuilt the identical artifact fingerprint above. The initial report's aggregate of 862 was a counting error; the individual suite results were correct. This documentation-only correction changes no artifact file. Newer run results must still be checked before approving their exact commits.

Draft [PR #7, `develop` → `main`](https://github.com/taymarspencer/Rizo-World-/pull/7), is the release review gate. PR #6 was closed with an explanatory archival comment after its exact head was proved to be an ancestor; its branch is intact. PRs #1–#5 stay open because they retain unique history, with their heads, bases, titles, bodies and draft states unchanged. All twelve original branch heads were rechecked unchanged. No branch was deleted. See [the complete branch/PR classification](../current/HISTORY-AND-RELEASE-AUDIT.md).

Public-beta gates still open: physical iOS/Android and standalone lifecycle, constrained real-device/compressed-host performance, root/primary-hostname decision, chosen host's actual headers/404/compression, old-origin save export/import, operator/support/privacy details and shipped-asset rights. DNS/TLS/canonical/crawler/update verification follows the separately authorized host setup. Ads/account/CMP/reward-placement gates are separate and do not prevent an intentionally ad-free beta. See [deployment preparation](../current/DEPLOYMENT-PREPARATION.md).

This pass does not merge `main`, deploy a site, modify DNS, enable ads or settle the ten Dungeon narrative decisions.
