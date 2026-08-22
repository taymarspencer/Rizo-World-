# Rizo Defense v71 — Architecture Summary

## Runtime boundaries
- `index.html`: application shell and Defense DOM structure.
- `defense-core-v71.js`: canonical Defense limits, phases, budgets, economy helpers, signatures, migration helpers, clamps, and deterministic calculations.
- `game-v71-phase8-final-release.js`: application runtime, Defense scheduler/simulation, UI rendering, checkpoint integration, overlay/state coordination, cinematic hooks, and QA factory.
- `launch-v71-phase8-final-release.css`: consolidated UI/battlefield component and responsive contracts.
- `boot-v71-phase8.js`: build-identity/startup watchdog and recovery behavior.
- `sw.js`: release cache and network/cache strategy.

## Defense state model
The active run carries explicit `currentWave`, `clearedWave`, `phase`, packet indexes, child queue, real/control clock, simulation clock, density/performance state, pending income, cached targeting data, and checkpoint-safe canonical run statistics.

`DEFENSE_PHASES`: planning → countdown → combat ↔ packet-break → wave-complete → planning, with paused/run-complete terminal handling. Invalid transitions are rejected unless an internal migration/QA path explicitly forces them.

## Scheduler
Wave composition is pregenerated as packets. The scheduler admits enemies only when density budgets allow, preserves short packet breaks, reserves capacity for imminent split children, and routes split/add spawns through the same admission system.

## Targeting
Towers hold a cached target/reference and real-time retarget deadline. A shared target snapshot is refreshed at the performance-tier cadence, reducing repeated full-array work without changing shot timing.

## Economy authority
All critical rules are centralized in DefenseCore: starting cash, deployment costs, upgrade table, planning refund/undo, world opening discount, Golden global and active income caps, reward soft-cap helpers, and density/visual budgets. Runtime UI consumes these functions rather than maintaining parallel formulas.

## Save trust boundary
Whole-state envelopes and Defense checkpoints carry lightweight signatures. Imported values are clamped; unknown IDs are rejected; tower spending and enemy combat values are reconstructed; invalid checkpoints fail closed to conservative verified progress.

## UI and overlays
One Defense shell owns HUD, battlefield, controls, roster, and contextual surface layer. Blocking sheets are mutually exclusive and set background gameplay regions inert. Named z-index layers replace arbitrary Defense z-index escalation.

## Cinematic layer
Phase 8 adds one persistent `#defenseMoment` host. Events provide kind/title/copy/priority/duration; the host changes semantic state rather than creating per-event overlay trees. Terminal moments freeze the run through `RUN_COMPLETE` before recap. Reduced motion keeps status copy while suppressing motion.
