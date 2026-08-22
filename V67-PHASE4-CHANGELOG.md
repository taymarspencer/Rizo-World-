# V67 Phase 4 Changelog

## Scheduler architecture

- `updateDefenseGame(simDt, realDt)` now receives simulation and wall time separately.
- Added runtime `realClock`; gameplay movement, attack cooldowns, enemy mechanics, and wave timing continue to use `clock`.
- Moved UI refresh, checkpoint cadence, target refresh, income flush, child release pacing, and render-pressure decisions onto wall time.

## Wave and spawn control

- Preserved pregenerated packet plans and packet breaks.
- Added stable sorted insertion for `childSpawnQueue`; removed per-frame queue sorting.
- Added `childReleaseMs` budgets: 72 ms normal, 96 ms low.
- Added imminent-child density reservations.
- Removed the boss-only density bypass.
- Added release counters and QA observability.

## Tower targeting

- Added runtime `targetRef` caching alongside stable `targetId`.
- Added `retargetAtReal` and shared `targetSnapshot` refresh.
- Retarget cadence is identical at 1× and 2× in regression testing.
- Attack cooldown and damage timing still accelerate correctly at 2×.

## Visual pressure

- Added explicit `visualBudget()` contracts.
- Normal 2× budget: 17 projectiles, 5 impacts, 55% weather density.
- Low 2× budget: 10 projectiles, 3 impacts, 35% weather density.
- Weather opacity consumes `--defense-weather-density` in the existing rule; no new override block was appended.

## Income and HUD writes

- Added income-event/source aggregation and `lastIncomeBatch` telemetry.
- Income settlement uses wall time and preserves exact totals.
- Pending income still flushes before checkpoint, completion, banking, death, and serialization paths.

## Compatibility

- Checkpoint key advanced from v66 to v67.
- V66, V64, and legacy v42 checkpoint keys remain migration inputs.
- Checkpoint signature schema advanced to v4 while retaining v2 and v3 verification salts.
- Runtime scheduler caches are reconstructed rather than trusted from save data.

## QA and reporting

- Expanded core tests from 11 to 14.
- Expanded static checks from 27 to 36.
- Expanded browser integration checks from 45 to 57.
- Re-ran 76 browser surface checks.
- Added 1×/2× scheduler profiling, deterministic income profiling, and a fresh 10-image V67 gallery.
