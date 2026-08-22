# Rizo Defense v68 — Economy Balance

## Core table

| System | v68 rule |
|---|---|
| Starting cash | 220 on every world |
| Standard planning refund | 70% |
| New-placement undo | 100% for 5 real seconds while selling is permitted |
| Upgrades | 110 / 180 / 280 / 420 |
| First eligible world upgrade | 20% off → first upgrade 90 |
| Golden global cap | +22% maximum |
| Permanent Ember raw formula | clearedWave×8 + kills×1.1 + bosses×25 + perfectWaves×3 |
| Ember late-run soft cap | first 1600 full value; excess contributes 35% |
| Wave clear | 24 + clearedWave×4 + up to 10 heart bonus + 8 efficiency bonus |

## Deployment curve

| Paid tower index | Cost |
|---:|---:|
| 1 | 150 |
| 2 | 200 |
| 3 | 270 |
| 4 | 360 |
| 5 | 500 |
| 6 | 670 |
| 7 | 920 |
| 8 | 1250 |

The first active Rizo copy remains free. Duplicate copies add a surcharge. Deployment pricing is centralized so this curve can be tuned without checkpoint/runtime formula drift.

## Golden stacking

| Golden towers | Global multiplier | Wave 20 / Lv3 active payout |
|---:|---:|---:|
| 0 | 1.00× | — |
| 1 | 1.10× | 168 |
| 2 | 1.13× | 148 |
| 3 | 1.16× | 128 |
| 5 | 1.22× | 87 |
| 10 | 1.22× | 87 |

The active payout stops gaining wave value after cleared Wave 40. The global multiplier reaches its 1.22× ceiling at five Golden towers.

## Nominal cash simulation

This is a **planning model**, not a win-rate simulation. It assumes every planned enemy and split child is popped, no hearts are lost, and tower count qualifies for the efficiency bonus.

| Through wave | Nominal cumulative run cash earned |
|---:|---:|
| 5 | 1,122 |
| 10 | 3,543 |
| 20 | 13,762 |
| 30 | 32,309 |
| 40 | 59,868 |
| 50 | 92,361 |

### Interpretation

The structure is substantially healthier: harder maps no longer multiply cash, tower count is physically bounded, construction is phase-gated, Golden cannot multiply indefinitely, and permanent rewards soften late.

The simulation also exposes a remaining tuning surface rather than hiding it: the inherited per-enemy wave multiplier can still create a large cash surplus in very long successful runs. That does **not** increase DOM density because tower and enemy budgets remain enforced, but it can reduce the strategic value of cash late. This curve should be tuned from real play data rather than silently changing combat difficulty and rewards together in the same pass.

Full machine-readable table: `reports/phase5-economy-simulation.json`.
