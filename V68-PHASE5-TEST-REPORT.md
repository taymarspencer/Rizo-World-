# Rizo Defense v68 — Phase 5 Test Report

## Result

**213 / 213 automated checks passed.**

| Suite | Result |
|---|---:|
| Core economy/state tests | 21 / 21 |
| Static architecture/source audit | 46 / 46 |
| Browser gameplay/integration | 70 / 70 |
| Surface/viewport checks | 76 / 76 |

## Phase 5 regressions specifically covered

- all worlds begin at 220 cash
- canonical kill rewards remain positive and map-invariant
- five-second 100% placement undo
- 70% refund after undo expiry
- combat locks placement/selling/ordinary upgrades
- packet breaks permit upgrades without reopening construction
- first eligible world upgrade is discounted once
- tower panel communicates the world discount
- v67 checkpoint migration reconstructs one legitimate opening discount
- explicit deployment and upgrade pricing
- Golden global cap and duplicate active diminishing returns
- permanent rewards are map-invariant and soft-capped
- pending income flushes before checkpoint/save paths
- all Phase 2 progression-integrity and Phase 4 scheduler regressions remain green

## Surface verification

76/76 surface checks passed across 320×568, 390×844, 844×390, and 768×1024 for tower panel, field menu, powers, intel, field guide, records, and lobby. The larger integration suite also checks the required 360×640, 375×667, 430×932, and 1024×768 geometries.

## Performance host profile

| Metric | 1× | 2× |
|---|---:|---:|
| Average frame time | 16.666 ms | 16.666 ms |
| Worst frame | 16.8 ms | 16.8 ms |
| Max active enemies | 13 | 9 |
| Density cap | 14 | 9 |
| Target scans/sec | 60.31 | 60.46 |
| HUD writes/sec | 3.69 | 4.46 |

Income batching settled 120/120 queued cash at both speeds with 5.91 cash writes/sec. The 20-wave host soak ended with zero active enemy/projectile DOM nodes and no increase in pooled node creation counts.

These figures are **headless Chromium host measurements**, not physical iPhone claims.

## Screenshot automation

10/10 v68 gallery states captured with zero runtime errors.
