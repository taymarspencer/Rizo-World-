# V67 Phase 4 Economy Balance Table

Phase 4 changes settlement cadence, not the strategic prices established earlier. Full economy tuning belongs to Phase 5.

| System | Current rule | Phase 4 treatment | Status |
|---|---|---|---|
| Starting cash | 220 across worlds | unchanged | structurally stable; tuning deferred |
| Upgrade costs | 110 / 180 / 280 / 420 | unchanged and canonical | solved structurally |
| Golden multiplier | capped at 1.22 | unchanged | solved structurally |
| Wave bonus | `24 + clearedWave × 4`, plus heart/efficiency bonuses | unchanged | tunable in Phase 5 |
| Permanent Embers | cleared wave, kills, bosses, perfect waves, then soft cap | unchanged | progression-safe |
| Kill income | exact per kill | aggregated into real-time batches | solved in Phase 4 |
| HUD cash writes | formerly coupled to simulation cadence | 5.91 writes/sec in deterministic 1× and 2× profile | solved in Phase 4 |
| Pending income | exact accumulator | force-flushed before save/end transitions | solved |
| Placement/selling phase rules | existing Phase 2 model | unchanged | Phase 5 review |

The batching layer never changes the total reward. It only reduces repeated state and HUD mutations.
