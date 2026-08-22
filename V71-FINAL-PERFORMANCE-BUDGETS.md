# Rizo Defense v71 — Performance Budgets and Final Host Profile

## Enforced budgets

| Tier | Active enemies 1× | Active enemies 2× | Projectiles 1× | Projectiles 2× | Impacts 1× | Impacts 2× | Target refresh | UI refresh | Child release |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Normal | 14 | 9 | 26 | 17 | 8 | 5 | 120 ms | 120 ms | 72 ms |
| Low | 9 | 7 | 16 | 10 | 5 | 3 | 160 ms | 180 ms | 96 ms |

## Final comparative host measurement
Environment: headless Chromium, 390×844 CSS viewport, real `requestAnimationFrame`. This is useful comparative QA, not a physical-iPhone benchmark.

| Metric | 1× | 2× |
|---|---:|---:|
| Average frame | 16.666 ms | 16.666 ms |
| P95 frame | 16.78 ms | 16.8 ms |
| Worst sampled frame | 16.8 ms | 16.8 ms |
| Estimated FPS | 60.0 | 60.0 |
| Max active enemies observed | 13 | 9 |
| Target scans/sec | 60.31 | 60.46 |
| Target snapshots/sec | 10.62 | 13.69 |
| HUD writes/sec | 4.0 | 4.46 |
| Weather visual scale | 1 | 0.55 |

The important invariant holds: 2× simulation advances about twice as far while active density is lower and target-scan cadence does not double.

## Income scheduler
Both 1× and 2× settled the deterministic 120-coin stream exactly, with 0 pending income and 13 cash writes over 2.2 real seconds (5.91 writes/sec).

## 50-wave soak
- enemy pool creation: 14 → 14
- projectile pool creation: 26 → 26
- impact pool creation: 8 → 8
- active enemy DOM after clear: 0
- active projectile DOM after clear: 0
- DOM node growth: -23
- measured JS heap change: 441,586 bytes
- runtime errors: 0

The stable creation counters support pool reuse. Heap is a short host measurement and is not treated as a multi-hour mobile-memory guarantee.
