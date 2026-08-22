# V67 Phase 4 Performance Budgets

## Enforced budgets

| Tier | Active enemies at 1× | Active enemies at 2× | Projectiles at 1× | Projectiles at 2× | Impacts at 1× | Impacts at 2× | Target refresh | UI refresh | Child release |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Normal | 14 | 9 | 26 | 17 | 8 | 5 | 120 ms | 120 ms | 72 ms |
| Low | 9 | 7 | 16 | 10 | 5 | 3 | 160 ms | 180 ms | 96 ms |

Boss waves share the same admission system and are capped at approximately one boss plus the remaining budget. Split children, boss adds, and delayed spawns cannot bypass the cap.

## Host profile

Environment: headless Chromium, 390×844 CSS viewport, real `requestAnimationFrame`. This is comparative host QA.

| Metric | 1× | 2× |
|---|---:|---:|
| Average frame | 16.666 ms | 16.666 ms |
| P95 frame | 16.7 ms | 16.7 ms |
| Worst frame | 16.8 ms | 16.8 ms |
| Estimated FPS | 60.0 | 60.0 |
| Peak active enemy nodes | 13 | 9 |
| Peak projectile nodes | 3 | 2 |
| Peak impact nodes | 4 | 5 |
| Target scans/sec | 60.31 | 60.31 |
| Shared target snapshots/sec | 10.62 | 13.54 |
| HUD writes/sec | 3.85 | 4.62 |
| Enemy position writes/sec | 197.38 | 231.69 |
| Projectile position writes/sec | 12.62 | 12.62 |

The important invariant is not that every visual write remains identical. It is that 2× does not double target scanning or object density, while the simulation advances approximately twice as far.

## Income write profile

A deterministic 120-coin stream settled exactly at both speeds:

| Speed | Real time | Simulation time | Settled | Pending | Cash writes | Writes/sec |
|---|---:|---:|---:|---:|---:|---:|
| 1× | 2.2 s | 2.2 s | 120 | 0 | 13 | 5.91 |
| 2× | 2.2 s | 4.4 s | 120 | 0 | 13 | 5.91 |

## Long-session cleanup profile

Across 20 forced waves:

- enemy nodes created: 14 → 14
- projectile nodes created: 26 → 26
- impact nodes created: 8 → 8
- active enemy nodes after clear: 0
- active projectile nodes after clear: 0
- DOM node growth: -23
- measured heap growth: +393,685 bytes

The stable creation counts show pool reuse. The heap number is a short headless-host sample and is not treated as a mobile memory guarantee.
