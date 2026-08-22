# V64 Performance Budgets and Measurements

## Runtime budgets

| Budget | Normal | Low |
|---|---:|---:|
| Active enemies | 14 | 9 |
| Visible projectiles | 26 | 16 |
| Impact effects | 8 | 5 |
| Target towers | 8 | 8 |
| Hard tower cap | 10 | 10 |
| Target refresh | 120 ms | 160 ms |
| UI refresh | 120 ms | 180 ms |
| Income flush | 150 ms | 180 ms |

At 2× speed, active density is never allowed above nine, even when adaptive quality recovers from low to normal. In low mode, the 2× target is lower. Combat simulation and exact damage/income math continue while excess visuals are skipped or pooled.

## Measured headless-Chromium stress run

Environment: 390×844 CSS viewport, real `requestAnimationFrame` timing on the build host. This is comparative browser QA, not a physical-iPhone benchmark.

| Metric | 1× | 2× |
|---|---:|---:|
| Duration | 6.5 s | 6.5 s |
| Average frame | 17.777 ms | 16.798 ms |
| P95 frame | 33.3 ms | 16.7 ms |
| Worst frame | 50 ms | 33.4 ms |
| Estimated FPS | 56.3 | 59.5 |
| Max active enemies | 13 | 9 |
| Max visible projectiles | 2 | 3 |
| Max impact effects | 4 | 5 |
| Target scans/sec | 33.38 | 83.08 |
| HUD writes/sec | 4.00 | 5.23 |
| Runtime errors | 0 | 0 |

The 1× run stayed within its normal 14-enemy ceiling and peaked at 13. The 2× run was deliberately held to nine active enemies, confirming fast-forward does not increase visual density.

## Pool/leak test

Twenty repeated stress waves were loaded, resolved, and cleared while tracking node creation.

- Enemy nodes created: 14 → 14
- Projectile nodes created: 26 → 26
- Impact nodes created: 8 → 8
- Active enemy DOM after clear: 0
- Active projectile DOM after clear: 0
- Defense-world DOM: 227 → 204 (-23)
- Measured JS heap delta: 385,816 bytes
- Runtime errors: 0

A positive heap delta in one synthetic browser run is not itself proof of a leak. The stronger evidence is that all three node-creation counters stayed flat across all 20 reuse cycles and active combat nodes returned to zero. Physical iOS memory profiling remains required before claiming device-specific memory behavior.
