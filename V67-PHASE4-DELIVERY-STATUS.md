# V67 Phase 4 Delivery Status

## Fully solved in this phase

- Separate simulation and real-time control clocks.
- 2× speed no longer doubles target-scan cadence, income settlement cadence, UI cadence, or checkpoint cadence.
- Split children enter one bounded scheduler, release gradually, and obey active-density limits.
- Imminent child spawns reserve density before normal packet spawns are admitted.
- Boss entries no longer bypass the active-enemy cap.
- Tower targets are cached by runtime reference and refreshed on a wall-time schedule.
- Target selection shares a throttled active-enemy snapshot.
- Projectile, impact, and weather visual budgets drop at 2× speed without altering combat math.
- Income remains exact while cash writes are batched at a real-time cadence.
- V66 signed checkpoints remain accepted and migrate to V67 checkpoint schema 4.
- Build ID, checkpoint key, service-worker cache, tests, profile, and screenshot gallery match V67.

## Structurally improved but still tunable

- Packet sizes, gaps, and breaks are centralized and capped, but final feel still needs human playtesting across early, mid, and endless runs.
- The normal and low performance budgets are enforced, but physical-device profiling may justify lower caps on older iPhones.
- Target refresh is stable at 1× and 2×; its 120/160 ms values remain balance knobs.
- Visual budgets are explicit; effect quality can be tuned after art and UI phases.

## Intentionally deferred

- Phase 5 economy rebalance and combat-phase purchase/sell rules.
- Phase 6 UI foundation and stylesheet consolidation.
- Phase 7 battlefield art cohesion and deeper world differentiation.
- Server-authoritative competitive records.

## Unable to verify here

- Physical iPhone thermals, Safari memory reporting, haptic feel, and battery drain.
- Real-device behavior after a multi-hour background/foreground cycle.

The host benchmark and device matrix use headless Chromium. Those results are comparative engineering evidence, not a physical-iPhone claim.
