# Rizo Defense v70 — Phase 7 Test Report

## Automated matrix
- Core: 23 / 23
- Static architecture: 70 / 70
- Browser integration: 77 / 77
- UI surfaces / viewport containment: 76 / 76
- Service-worker policy: 4 / 4
- Phase 7 battlefield art: 43 / 43
- Total: 293 / 293

## Phase 7-specific assertions
The art suite verifies:
- all six maps receive the correct structural feature identities;
- development labels remain hidden;
- two build pockets remain present per map;
- authored landmarks retain nonuniform geometry;
- Blizzard and Eclipse use opposite contrast strategies;
- road fill is reduced to 58px;
- route markers remain hidden until trace is requested;
- selected range uses the dedicated ground ellipse;
- tower dimensions remain inside the world-space contract;
- placement validity stays local;
- short-phone/tablet scale remains bounded;
- enemy and health-bar contrast adapts per world;
- no runtime errors occur in the Phase 7 sample.

## Performance preservation
Headless Chromium comparative profile, 390 × 844:

| Metric | 1× | 2× |
| --- | ---: | ---: |
| Average frame time | 16.666 ms | 16.666 ms |
| Worst sampled frame | 16.8 ms | 16.8 ms |
| Max active enemies | 13 | 9 |
| Max projectile nodes | 3 | 2 |
| Max impact/effect nodes | 4 | 5 |
| Target scans/sec | 60.31 | 60.46 |
| HUD writes/sec | 3.85 | 4.46 |
| Income writes/sec | 5.91 | 5.91 |

20-wave host soak:
- DOM node growth: -23
- heap growth: +160,132 bytes
- enemy pool creations: 14 → 14
- projectile pool creations: 26 → 26
- effect pool creations: 8 → 8
- runtime errors: none

These are comparative host measurements, not a substitute for physical-phone profiling.

## Screenshot matrix
Ten fresh Phase 7 captures cover Grove placement, Ember, Moon, Storm landscape, Blizzard contrast, Eclipse contrast, selected range, route tracing, tablet world, and short-phone world. Capture runtime errors: zero.
