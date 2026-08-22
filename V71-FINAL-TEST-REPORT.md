# Rizo Defense v71 — Final Automated Test Report

## Result
**310 / 310 automated checks passed.**

| Suite | Passed |
|---|---:|
| Defense core | 23 / 23 |
| Static architecture/integrity | 70 / 70 |
| Browser gameplay/integration | 77 / 77 |
| Required viewport/surface matrix | 76 / 76 |
| Service-worker policy | 4 / 4 |
| Phase 7 battlefield-art regression | 43 / 43 |
| Phase 8 final/cinematic regression | 17 / 17 |

## Phase 8-specific coverage
The final suite verifies the single cinematic host, event priority, actual boss entrance hook, danger state, perfect-wave treatment, terminal bank/defeat lifecycle, cleared-vs-reached exploit protection, reduced-motion behavior, 320×568 containment, pointer transparency, and 100-event DOM reuse with zero host-node growth.

## Required viewport coverage
The browser suites cover 320×568, 360×640, 375×667, 390×844, 430×932, 844×390 landscape, tablet portrait, and tablet landscape, including roster, tower panel, field menu, powers, drag/invalid placement, packet break, boss state, 2× speed, low-performance behavior, Blizzard, Eclipse, bank/death, checkpoint restoration, and large-value stress.

## Save/exploit replay
Automated tests confirm unfinished-wave bank/death exclusion, conservative history migration, signed save edit detection, invalid checkpoint fail-closed behavior, unknown ID rejection, derived upgrade/reward reconstruction, legacy v2/v3/v4 checkpoint verification, v67→v5 opening-economy migration, Golden cap, pending-income flush before checkpoint, and child-queue completion blocking.

## Launch/cache verification
The service-worker policy suite verifies versioned release cache behavior, network-first required runtime policy, stale-cache fallback decisions, and optional best-effort shell caching. The normal browser harness loads the complete v71 runtime inline. A real deployed Safari service-worker lifecycle is outside this environment.

## Performance
Final 1×/2× host profile and 50-wave soak are documented in `V71-FINAL-PERFORMANCE-BUDGETS.md` and `reports/phase8-performance-profile.json`. No runtime errors occurred in the measured profiles.

## Screenshot release gallery
10 / 10 fresh v71 captures completed with zero runtime errors. See `reports/screenshots/v71-phase8/Rizo-Defense-v71-phase8-contact-sheet.jpg`.
