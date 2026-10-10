# Exact verification record

All 16 Node suites and all 21 browser release suites have a passing accepted
result. The eight Dungeon browser suites contain **1,025 checks**; the Node
suites contain **368 checks**. Art was also inspected in native phone frames.

The JSON records contain the exact commands, arguments, elapsed times and exit
codes for each execution: [initial release run](release-results.json),
[final art rechecks](final-review-results.json), [capture supplements / first retry](retry-results.json),
and [accepted ancillary checks / final build](accepted-results.json).
[Evidence recovery executions](evidence-recovery-results.json) record the
serial recaptures used to replace damaged export files. Every delivered
native image subsequently passed its dimension and decoded-pixel hash check.

The initial failed logs remain available. Accepted results below use the final
art rechecks where appropriate. No assertions or thresholds were relaxed.

| Suite | Accepted result | Log |
| --- | --- | --- |
| `ads-boundary.test.js` | 14/14 advertising boundary checks passed | [Log](final-ads-boundary.test.js.log) |
| `core-contracts.test.js` | 28/28 core contract checks passed | [Log](final-core-contracts.test.js.log) |
| `defense-core.test.js` | 32/32 core tests passed. | [Log](final-defense-core.test.js.log) |
| `dungeon-actor-direction.test.js` | Dungeon actor direction: 39 checks passed | [Log](final-dungeon-actor-direction.test.js.log) |
| `dungeon-cast-render.test.js` | Dungeon cast art: 63 render smoke checks passed | [Log](final-dungeon-cast-render.test.js.log) |
| `dungeon-core.test.js` | 86/86 dungeon core checks passed | [Log](accepted-dungeon-core.test.js.log) |
| `dungeon-input.test.js` | 26/26 dungeon input checks passed | [Log](final-dungeon-input.test.js.log) |
| `dungeon-kit.test.js` | 6/6 dungeon kit checks passed | [Log](final-dungeon-kit.test.js.log) |
| `home-core.test.js` | 9/9 home rule checks passed | [Log](final-home-core.test.js.log) |
| `mode-host.test.js` | 11/11 mode host checks passed | [Log](final-mode-host.test.js.log) |
| `public-product.test.js` | 8/8 public product contract checks passed | [Log](final-public-product.test.js.log) |
| `release-integrity.test.js` | 7/7 release integrity checks passed | [Log](final-release-integrity.test.js.log) |
| `service-worker-policy.test.js` | 10/10 service-worker policy checks passed | [Log](final-service-worker-policy.test.js.log) |
| `training-boundaries.test.js` | 13/13 training boundary checks passed | [Log](final-training-boundaries.test.js.log) |
| `worker-b-economy.test.js` | 9/9 Worker B economy tests passed. | [Log](final-worker-b-economy.test.js.log) |
| `worker-j-defense-guard.test.js` | 7/7 Worker J guard tests passed. | [Log](final-worker-j-defense-guard.test.js.log) |
| `browser-dungeon-character-lab` | 125/125 passed | [Log](final-character-lab.log) |
| `browser-home-world` | 115/115 Home / Train / Go browser checks passed | [Log](browser-home-world.log) |
| `browser-home-alive` | Exit 0 (all assertions) | [Log](browser-home-alive.log) |
| `browser-visual-uphaul` | 72/72 visual uphaul checks passed | [Log](browser-visual-uphaul.log) |
| `browser-dungeon` | 390/390 dungeon checks passed | [Log](final-dungeon.log) |
| `browser-dungeon-controls` | 185/185 dungeon controls checks passed | [Log](browser-dungeon-controls.log) |
| `browser-dungeon-cohesion` | 69/69 cohesion checks passed | [Log](browser-dungeon-cohesion.log) |
| `browser-dungeon-depth` | 45/45 depth checks passed | [Log](final-depth.log) |
| `browser-dungeon-gamefeel` | 63/63 game-feel checks passed | [Log](browser-dungeon-gamefeel.log) |
| `browser-dungeon-escape` | 88/88 escape checks passed | [Log](browser-dungeon-escape.log) |
| `browser-dungeon-reading` | 60/60 reading checks passed | [Log](browser-dungeon-reading.log) |
| `save-safety` | 37/37 save-safety checks passed | [Log](save-safety.log) |
| `browser-defense-integration` | 78/78 browser integration checks passed | [Log](accepted-browser-defense-integration.log) |
| `mode-contract` | 25/25 mode-contract checks passed | [Log](mode-contract.log) |
| `training-contract` | 22/22 training-contract checks passed | [Log](training-contract.log) |
| `browser-launch-recovery` | 5/5 launch recovery checks passed | [Log](browser-launch-recovery.log) |
| `browser-v88-training-fixes` | 13/13 training fix checks passed | [Log](browser-v88-training-fixes.log) |
| `browser-v88-authored` | 25/25 authored arcade browser checks passed | [Log](browser-v88-authored.log) |
| `browser-v87-arcade-freeze` | 66/66 v87 arcade freeze checks passed | [Log](accepted-browser-v87-arcade-freeze.log) |
| `browser-public-product` | 150/150 public product checks passed; Chromium only; evidence: /tmp/rizo-final-public | [Log](final-public-product.log) |
| `browser-world-first` | 77/77 World-first routing checks passed; Chromium only | [Log](browser-world-first.log) |

## Investigated failures

- [PR #43 original CI failure](pr43-failure.log): Boss line sampled at 5050ms, below the 5125ms minimum. Its existing 1.4 dialogue weight became 1.5. The reading assertion is intact.
- [First local depth run](browser-dungeon-depth.log): 43/45. The post-victory fixture left a live Porter; its story flag alone did not settle Core. The strict settled/0hp setup now matches actual victory. [Final depth](final-depth.log): 45/45.
- [First Defense run](browser-defense-integration.log) and [unchanged retry](retry-browser-defense-integration.log): 77/78. Absolute clocks included different live setup frames from separate pages. The fixture now measures before/after deltas for the same controlled two-second interval in one evaluation. The original cadence and clock assertions remain intact. [Accepted run](accepted-browser-defense-integration.log): 78/78; real clocks both 2s, simulation clocks 2s/4s.
- [First arcade pause run](browser-v87-arcade-freeze.log): 65/66, rhythm resume sample 0.59s → 0.87s against a 0.25s bound. [Unchanged serial retry](accepted-browser-v87-arcade-freeze.log): 66/66, samples 0.52s → 0.60s. No arcade source or test code changed. This remains a scheduling-sensitive wall-clock check.

## Capture and source verification

- Main gameplay: 93/93 frames per version; 31 scenes at each of the three widths.
- Opening: 18 frames and 12/12 checks per version.
- Collector comics: six frames per version.
- Native Lab: 20 sheets per version plus eight isolated colour/value/silhouette strips per version.
- The speaking/fitting supplement replaces six frames per version with the correct dialogue and interaction anchors.
- [Protected function hashes](protected-art.json) show unchanged Latch, Latch portraits, flame, jars, Draftling and Needle.
- [Final production build](accepted-build.log): 166 files; fingerprint `781104f8d97c3b81a63b5fd91390cc1c891309e89ad358363ac0be8d01d071dc`. It matches the final tested art package.

Chromium 134 / Playwright 1.51.0 on Linux; phone emulation. No physical iPhone
or Safari/WebKit verification, merge or deployment.
